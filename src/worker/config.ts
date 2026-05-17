/**
 * config — carregamento de configuração do worker.
 *
 * Ordem de precedência:
 * 1. ~/.jarvis/settings.json (novo)
 * 2. .openclaude-profile.json (legacy)
 * 3. Fallback: env vars (OPENAI_BASE_URL, OPENAI_API_KEY, etc.)
 *
 * Smart routing + agentModels são carregados de settings.json quando disponível.
 * API keys são expandidas de env vars com pattern matching (ZEN_API_KEY_*, etc.).
 */

import { homedir } from 'node:os'
import { join } from 'node:path'
import { existsSync, readFileSync } from 'node:fs'
import type { WorkerConfig } from './worker-core.ts'
import type { SmartRoutingConfig } from '../services/api/smartModelRouting.ts'
import type { AgentModelsMap } from '../services/api/providerResolver.ts'

export type LoadedConfig = WorkerConfig & {
  source: 'settings-json' | 'legacy-profile' | 'env-fallback'
  settingsPath: string | null
}

/**
 * Carrega a configuração do worker.
 * Retorna WorkerConfig totalmente populada + metadados sobre a origem.
 */
export function loadConfig(): LoadedConfig {
  // Tentar settings.json novo
  const settingsPath = join(homedir(), '.jarvis', 'settings.json')
  if (existsSync(settingsPath)) {
    try {
      const json = JSON.parse(readFileSync(settingsPath, 'utf-8'))
      const config = parseSettingsJson(json)
      return {
        ...config,
        source: 'settings-json',
        settingsPath,
      }
    } catch (err) {
      console.warn(`[config] Erro ao ler ${settingsPath}: ${err instanceof Error ? err.message : String(err)}`)
    }
  }

  // Tentar legacy .openclaude-profile.json
  const legacyPath = '.openclaude-profile.json'
  if (existsSync(legacyPath)) {
    try {
      const json = JSON.parse(readFileSync(legacyPath, 'utf-8'))
      const config = parseSettingsJson(json)
      return {
        ...config,
        source: 'legacy-profile',
        settingsPath: legacyPath,
      }
    } catch (err) {
      console.warn(`[config] Erro ao ler ${legacyPath}: ${err instanceof Error ? err.message : String(err)}`)
    }
  }

  // Fallback: env vars
  return {
    ...parseFallbackEnv(),
    source: 'env-fallback',
    settingsPath: null,
  }
}

/**
 * Parse settings.json (novo formato).
 * Detecta smartRouting + agentModels + expande env vars.
 */
function parseSettingsJson(json: any): WorkerConfig {
  const smartRouting = json.smartRouting as SmartRoutingConfig | undefined
  const agentModels = parseAgentModels(json.agentModels ?? {})

  return {
    fallback: {
      baseURL: process.env['OPENAI_BASE_URL'] ?? 'https://api.deepseek.com/v1',
      apiKey: process.env['OPENAI_API_KEY'] ?? 'sk-placeholder',
      model: process.env['OPENAI_MODEL'] ?? 'deepseek-chat',
    },
    smartRouting: smartRouting && smartRouting.enabled ? smartRouting : undefined,
    agentModels: Object.keys(agentModels).length > 0 ? agentModels : undefined,
    systemPrompt: json.systemPrompt,
  }
}

/**
 * Parse agentModels e expande api_keys_env com pattern matching.
 *
 * Input:
 *   { "zen": { "base_url": "...", "api_keys_env": "ZEN_API_KEY_*", ... } }
 *
 * Output (com env vars):
 *   { "zen": { ..., "api_keys": ["zen-key-1", "zen-key-2", ...] } }
 */
function parseAgentModels(models: Record<string, any>): AgentModelsMap {
  const result: AgentModelsMap = {}

  for (const [providerName, modelEntry] of Object.entries(models)) {
    if (!modelEntry || typeof modelEntry !== 'object') continue

    const baseUrl = modelEntry.base_url as string | undefined
    const model = modelEntry.model as string | undefined

    if (!baseUrl) continue

    // Resolver api_keys: env var direto vs pattern matching
    let apiKeys: string[] = []

    if (modelEntry.api_key && typeof modelEntry.api_key === 'string') {
      // Single key
      apiKeys = [modelEntry.api_key]
    } else if (modelEntry.api_keys && Array.isArray(modelEntry.api_keys)) {
      // Array direct
      apiKeys = modelEntry.api_keys.filter((k) => typeof k === 'string')
    } else if (modelEntry.api_keys_env && typeof modelEntry.api_keys_env === 'string') {
      // Pattern matching: "ZEN_API_KEY_*" → ["ZEN_API_KEY_1", "ZEN_API_KEY_2", ...]
      apiKeys = expandEnvPattern(modelEntry.api_keys_env)
    }

    if (apiKeys.length === 0) {
      console.warn(`[config] Provider "${providerName}" tem 0 chaves. Pulando.`)
      continue
    }

    result[providerName] = {
      base_url: baseUrl,
      api_keys: apiKeys,
      model,
      rotation: modelEntry.rotation as 'round-robin' | 'least-recent' | undefined,
      cooldown_ms: modelEntry.cooldown_ms as number | undefined,
    }
  }

  return result
}

/**
 * Expande padrão de env var: "ZEN_API_KEY_*" → array de valores.
 *
 * Procura por ZEN_API_KEY_1, ZEN_API_KEY_2, ... até achar gaps.
 * Ordena por índice numérico.
 */
function expandEnvPattern(pattern: string): string[] {
  if (!pattern.includes('*')) {
    // Sem wildcard, trata como nome literal
    const val = process.env[pattern]
    return val ? [val] : []
  }

  const prefix = pattern.replace('*', '')
  const keys: string[] = []

  // Procurar ZEN_API_KEY_1, 2, 3, ... até achar uma brecha
  for (let i = 1; i <= 100; i++) {
    const envVar = `${prefix}${i}`
    const val = process.env[envVar]
    if (!val) {
      // Se não encontrar a chave N, assume que terminamos
      // (permite gaps: KEY_1, KEY_2, (KEY_3 missing), KEY_4 — para por aqui)
      if (i > 1) break
      continue
    }
    keys.push(val)
  }

  return keys
}

/**
 * Fallback quando settings.json não existe.
 * Usa env vars: OPENAI_BASE_URL, OPENAI_API_KEY, OPENAI_MODEL.
 */
function parseFallbackEnv(): WorkerConfig {
  const baseURL = process.env['OPENAI_BASE_URL']
  const apiKey = process.env['OPENAI_API_KEY']

  if (!baseURL || !apiKey) {
    console.error('[config] Fallback env vars não configurados. Defina OPENAI_BASE_URL e OPENAI_API_KEY.')
    process.exit(1)
  }

  return {
    fallback: {
      baseURL,
      apiKey,
      model: process.env['OPENAI_MODEL'] ?? 'deepseek-chat',
    },
    smartRouting: undefined,
    agentModels: undefined,
  }
}

/**
 * Mostra config carregada (sem expor chaves completas).
 */
export function logConfig(config: LoadedConfig): void {
  console.log('[config] Configuração carregada')
  console.log(`  Fonte: ${config.source}`)
  if (config.settingsPath) {
    console.log(`  Arquivo: ${config.settingsPath}`)
  }
  console.log(`  Fallback: ${config.fallback.baseURL} | ${config.fallback.model}`)
  if (config.smartRouting?.enabled) {
    console.log(`  SmartRouting: ATIVO`)
  }
  if (config.agentModels) {
    const providers = Object.keys(config.agentModels)
    console.log(`  Providers: ${providers.join(', ')}`)
    for (const [name, entry] of Object.entries(config.agentModels)) {
      const keyCount = (entry.api_keys || []).length
      console.log(`    ${name}: ${keyCount} chave(s), rotação=${entry.rotation ?? 'default'}`)
    }
  }
}
