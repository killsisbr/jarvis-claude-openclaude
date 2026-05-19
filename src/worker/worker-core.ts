/**
 * JarvisWorker — núcleo headless do JARVIS.
 *
 * Substitui o loop Ink/React para ambientes sem terminal interativo.
 * Usa os mesmos módulos do JARVIS CLI (KeyPool, SmartRouting, CycleRecorder)
 * mas expõe uma interface HTTP-friendly: processPrompt() → WorkerResponse.
 *
 * Princípio: o worker NÃO depende de nenhum import de Ink, React ou chalk.
 */

import {
  trySmartRoute,
  reportOutcome,
  getPoolCache,
  type SmartRouteResult,
} from '../services/api/smartRoutingBridge.ts'
import type { SmartRoutingConfig, RoutingCategory } from '../services/api/smartModelRouting.ts'
import type { AgentModelsMap } from '../services/api/providerResolver.ts'
import {
  initCycleRecorder,
  startCycleRecord,
  completeCycleRecord,
} from '../services/api/cycleRecorder.ts'
import {
  getOrCreateSession,
  updateSession,
  getStats,
  evictExpiredSessions,
  type Session,
} from './session-store.ts'
import { getDatabase } from './db/schema.ts'
import {
  extractRelevantLearnings,
  formatLearningsContext,
  registerLearningFromResponse,
} from './learning-context.ts'
import { initializeIndex } from './vectordb/orama-store.ts'
import { extractUserPreferences, formatUserPreferences } from './services/preference-extractor.ts'
import { getSmartCache } from './services/smart-cache.ts'
import { recordRoutingMetric } from './db/routing-metrics.ts'
import { createHash } from 'node:crypto'
import { join } from 'node:path'
import { homedir } from 'node:os'

export type WorkerConfig = {
  /** Provider de fallback quando smart routing não está configurado. */
  fallback: {
    baseURL: string
    apiKey: string
    model: string
  }
  /** Configuração de smart routing (opcional). */
  smartRouting?: SmartRoutingConfig | null
  /** Map de providers para smart routing (opcional). */
  agentModels?: AgentModelsMap | null
  /** System prompt injetado em todas as sessões. */
  systemPrompt?: string
  /** Diretório de logs. Default: ~/.jarvis/worker-logs */
  logDir?: string
}

export type WorkerResponse = {
  reply: string
  sessionId: string
  cost: number
  model: string
  tokens: { input: number; output: number }
  latencyMs: number
  category: RoutingCategory | 'default'
}

export type WorkerStats = {
  sessionsActive: number
  sessionsTotal: number
  costToday: number
  uptime: number
  queriesTotal: number
  pools: Array<{
    name: string
    activeKeys: number
    cooldownKeys: number
    totalKeys: number
  }>
}

const MODEL_COST_PER_1M: Record<string, { input: number; output: number }> = {
  'claude-sonnet-4-5': { input: 3.0, output: 15.0 },
  'claude-haiku-4-5': { input: 0.8, output: 4.0 },
  'claude-opus-4-5': { input: 15.0, output: 75.0 },
  'deepseek-chat': { input: 0.27, output: 1.1 },
  'gpt-4o-mini': { input: 0.15, output: 0.6 },
  default: { input: 1.0, output: 5.0 },
}

export class JarvisWorker {
  private readonly config: WorkerConfig
  private readonly startedAt: Date
  private queriesTotal: number = 0
  private logDir: string

  constructor(config: WorkerConfig) {
    this.config = config
    this.startedAt = new Date()
    this.logDir = config.logDir ?? join(homedir(), '.jarvis', 'worker-logs')
    initCycleRecorder(this.logDir)

    // Initialize SQLite database (Fase 4)
    getDatabase()

    // Initialize Orama vector index (Fase 8.2) in background
    initializeIndex().catch((err) => {
      console.warn('[worker] Orama initialization failed, vector search disabled:', err instanceof Error ? err.message : String(err))
    })

    // Limpar sessões expiradas a cada 15 min
    setInterval(() => evictExpiredSessions(), 15 * 60 * 1000)
  }

  async processPrompt(userMessage: string, userId: string): Promise<WorkerResponse> {
    const session = getOrCreateSession(userId)
    const turnNumber = session.turnCount + 1
    const t0 = Date.now()

    // Adicionar mensagem do usuário ao histórico
    const messages = [
      ...session.messages,
      { role: 'user' as const, content: userMessage },
    ]

    // Resolver provider via smart routing ou fallback
    const routeResult = trySmartRoute({
      userText: userMessage,
      turnNumber,
      smartRoutingConfig: this.config.smartRouting,
      agentModels: this.config.agentModels,
    })

    const provider = routeResult?.override ?? this.config.fallback
    const model = provider.model ?? this.config.fallback.model
    const category = (routeResult?.decision.category ?? 'default') as RoutingCategory | 'default'
    const target = routeResult?.target ?? 'fallback'
    const reason = routeResult?.decision.reason ?? 'fallback provider'

    // Iniciar registro do ciclo
    const cycleRecord = startCycleRecord({
      turn: turnNumber,
      category,
      target,
      reason,
      baseURL: provider.baseURL,
      apiKey: provider.apiKey,
    })

    let reply = ''
    let inputTokens = 0
    let outputTokens = 0
    let outcome: 'success' | 'rate_limit' | 'error' = 'success'
    let errorMsg: string | undefined
    let fromCache = false

    try {
      // Build system prompt to calculate hash
      const builtMessages = await this.buildMessages(messages, session, userId)
      const systemPrompt = builtMessages[0]?.content || ''
      const systemPromptHash = createHash('sha256').update(systemPrompt).digest('hex')

      // Check SmartCache
      const cache = getSmartCache()
      const cacheEntry = await cache.getCachedContext(userId, userMessage, model, systemPromptHash)

      let result
      if (cacheEntry) {
        // Use cached context
        fromCache = true
        console.log(`[worker] Cache hit for ${userId}: similarity=${(cacheEntry.similarity * 100).toFixed(1)}%`)

        // Return cached reply (simulated - in real implementation would use cached messages)
        result = {
          reply: cacheEntry.context.messages[cacheEntry.context.messages.length - 1]?.content || 'Cached response',
          inputTokens: 0,
          outputTokens: 0,
        }
      } else {
        // Call LLM and cache result
        result = await this.callLLM({
          baseURL: provider.baseURL,
          apiKey: provider.apiKey,
          model,
          messages: builtMessages,
        })

        // Cache the context for future use
        await cache.cacheContext({
          user_id: userId,
          model,
          system_prompt_hash: systemPromptHash,
          messages: [...messages, { role: 'assistant' as const, content: result.reply }],
          last_message: userMessage,
          hit_count: 0,
          last_used_at: Date.now(),
        })
      }

      reply = result.reply
      inputTokens = result.inputTokens
      outputTokens = result.outputTokens
      outcome = 'success'

      // Register learnings from successful response
      if (!fromCache) {
        await registerLearningFromResponse(userId, userMessage, reply, category)
      }

      if (routeResult) {
        reportOutcome(target, { kind: 'success', apiKey: provider.apiKey, tokens: inputTokens + outputTokens }, this.config.agentModels)
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      errorMsg = msg
      outcome = msg.includes('429') || msg.includes('rate') ? 'rate_limit' : 'error'

      if (routeResult && outcome === 'rate_limit') {
        reportOutcome(target, { kind: 'rate_limit', apiKey: provider.apiKey }, this.config.agentModels)
      }

      // Resposta de erro amigável
      reply = outcome === 'rate_limit'
        ? 'Limite de requisições atingido. Tentando novamente em breve.'
        : `Erro ao processar: ${msg}`
    }

    const latencyMs = Date.now() - t0
    const cost = this.estimateCost(model, inputTokens, outputTokens)

    completeCycleRecord(cycleRecord, {
      kind: outcome,
      latencyMs,
      inputTokens,
      outputTokens,
      tokens: inputTokens + outputTokens,
      errorMsg,
    })

    // Atualizar sessão com resposta do assistente
    const updatedMessages = [
      ...messages,
      { role: 'assistant' as const, content: reply },
    ]
    updateSession(session.id, {
      messages: updatedMessages,
      turnCount: turnNumber,
      tokenCount: session.tokenCount + inputTokens + outputTokens,
      costUsd: session.costUsd + cost,
      lastActiveAt: new Date(),
    })

    this.queriesTotal++

    // Record routing metrics for Auto-Evolve optimization
    try {
      const successRate = outcome === 'success' ? 1.0 : 0.0
      recordRoutingMetric(
        model,
        String(category),
        [latencyMs],  // latencies array
        [cost],       // costs array
        outcome === 'success' ? 1 : 0,  // success count
        1             // total count
      )
    } catch (err) {
      console.error('[worker] Erro ao registrar métrica de routing:', err)
    }

    return {
      reply,
      sessionId: session.id,
      cost,
      model,
      tokens: { input: inputTokens, output: outputTokens },
      latencyMs,
      category,
    }
  }

  getStats(): WorkerStats {
    const sessionStats = getStats()
    const pools = Array.from(getPoolCache().values()).map((pool) => {
      const s = pool.getStats()
      return {
        name: s.name,
        activeKeys: s.activeKeys,
        cooldownKeys: s.cooldownKeys,
        totalKeys: s.totalKeys,
      }
    })

    return {
      sessionsActive: sessionStats.active,
      sessionsTotal: sessionStats.total,
      costToday: sessionStats.costToday,
      uptime: Math.floor((Date.now() - this.startedAt.getTime()) / 1000),
      queriesTotal: this.queriesTotal,
      pools,
    }
  }

  private async buildMessages(
    history: { role: 'user' | 'assistant'; content: string }[],
    _session: Session,
    userId?: string,
  ) {
    let systemPrompt = this.config.systemPrompt ?? [
      'Você é o JARVIS, um assistente de IA especializado em desenvolvimento de software.',
      'Seja conciso, preciso e direto. Responda em português quando o usuário escrever em português.',
    ].join(' ')

    // Inject relevant learnings and preferences if userId provided
    if (userId) {
      const userMessage = history.length > 0 ? history[history.length - 1].content : ''

      // Extract learnings
      const learnings = await extractRelevantLearnings(userId, userMessage)
      if (learnings.length > 0) {
        const learningContext = formatLearningsContext(learnings)
        systemPrompt += learningContext
      }

      // Extract and inject preferences (Proactive Learning)
      const prefs = await extractUserPreferences(userId, userMessage)
      if (prefs.length > 0) {
        const prefsContext = formatUserPreferences(prefs)
        systemPrompt += prefsContext
      }
    }

    return [
      { role: 'system' as const, content: systemPrompt },
      ...history,
    ]
  }

  private async callLLM(opts: {
    baseURL: string
    apiKey: string
    model: string
    messages: { role: 'system' | 'user' | 'assistant'; content: string }[]
  }): Promise<{ reply: string; inputTokens: number; outputTokens: number }> {
    const url = `${opts.baseURL.replace(/\/$/, '')}/chat/completions`

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${opts.apiKey}`,
      },
      body: JSON.stringify({
        model: opts.model,
        messages: opts.messages,
        max_tokens: 2048,
        temperature: 0.7,
      }),
    })

    if (!response.ok) {
      const body = await response.text().catch(() => '')
      throw new Error(`HTTP ${response.status}: ${body.slice(0, 200)}`)
    }

    const data = (await response.json()) as {
      choices: Array<{ message: { content: string } }>
      usage?: { prompt_tokens: number; completion_tokens: number }
    }

    const reply = data.choices?.[0]?.message?.content ?? ''
    const inputTokens = data.usage?.prompt_tokens ?? 0
    const outputTokens = data.usage?.completion_tokens ?? 0

    return { reply, inputTokens, outputTokens }
  }

  private estimateCost(model: string, inputTokens: number, outputTokens: number): number {
    const rates =
      MODEL_COST_PER_1M[model] ??
      // tentativa de match parcial (ex: "deepseek-chat-v3" → "deepseek-chat")
      Object.entries(MODEL_COST_PER_1M).find(([k]) => model.startsWith(k))?.[1] ??
      MODEL_COST_PER_1M['default']!

    return (inputTokens * rates.input + outputTokens * rates.output) / 1_000_000
  }
}
