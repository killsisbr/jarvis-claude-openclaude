import { formatTotalCost } from '../../cost-tracker.js'
import { currentLimits } from '../../services/claudeAiLimits.js'
import type { LocalCommandCall } from '../../types/command.js'
import { isClaudeAISubscriber } from '../../utils/auth.js'
import { getCycleLogPath } from '../../services/api/cycleRecorder.js'

/**
 * Build a smart routing stats section from the cycle-recorder JSONL log.
 * Returns an empty string when smart routing is not active / no data.
 */
function formatSmartRoutingStats(): string {
  const logPath = getCycleLogPath()
  if (!logPath) return ''

  let raw: string
  try {
    const { readFileSync, existsSync } = require('node:fs')
    if (!existsSync(logPath)) return ''
    raw = readFileSync(logPath, 'utf-8')
  } catch {
    return ''
  }

  const lines = raw.trim().split('\n').filter(Boolean)
  if (lines.length === 0) return ''

  type Rec = {
    category: string
    baseURL: string
    outcome: string
    latencyMs: number
    tokens?: number
  }

  const records: Rec[] = []
  for (const line of lines) {
    try { records.push(JSON.parse(line)) } catch { /* skip */ }
  }
  if (records.length === 0) return ''

  // Aggregate by category
  const byCategory = new Map<string, { count: number; tokens: number; latencyMs: number; successes: number }>()
  let totalTokens = 0

  for (const r of records) {
    const key = r.category || 'unknown'
    const entry = byCategory.get(key) ?? { count: 0, tokens: 0, latencyMs: 0, successes: 0 }
    entry.count++
    entry.tokens += r.tokens ?? 0
    entry.latencyMs += r.latencyMs
    if (r.outcome === 'success') entry.successes++
    byCategory.set(key, entry)
    totalTokens += r.tokens ?? 0
  }

  // Aggregate by provider (baseURL)
  const byProvider = new Map<string, { count: number; tokens: number }>()
  for (const r of records) {
    const key = r.baseURL || 'default'
    const entry = byProvider.get(key) ?? { count: 0, tokens: 0 }
    entry.count++
    entry.tokens += r.tokens ?? 0
    byProvider.set(key, entry)
  }

  const out: string[] = []
  out.push('\n\n── Smart Routing ──')

  const catOrder = ['simple', 'strong', 'code', 'reasoning', 'vision']
  for (const cat of catOrder) {
    const entry = byCategory.get(cat)
    if (!entry) continue
    const avgMs = entry.count > 0 ? Math.round(entry.latencyMs / entry.count) : 0
    const tokStr = entry.tokens > 0 ? ` | ${entry.tokens.toLocaleString()} tok` : ''
    out.push(`  ${cat.padEnd(10)} ${String(entry.count).padStart(3)} calls | ${String(avgMs).padStart(5)}ms avg${tokStr}`)
  }

  if (byProvider.size > 1) {
    out.push('')
    for (const [url, entry] of byProvider) {
      const short = url.replace(/^https?:\/\//, '').replace(/\/v1\/?$/, '')
      out.push(`  ${short.slice(0, 32).padEnd(32)} ${String(entry.count).padStart(3)} calls | ${entry.tokens.toLocaleString()} tok`)
    }
  }

  // Savings estimate
  const simpleTurns = byCategory.get('simple')
  if (simpleTurns && simpleTurns.tokens > 0) {
    const savedDollars = ((3.0 - 0.25) * simpleTurns.tokens) / 1_000_000
    if (savedDollars > 0.001) {
      out.push(`  Savings from simple routing: ~$${savedDollars.toFixed(3)}`)
    }
  }

  return out.join('\n')
}

export const call: LocalCommandCall = async () => {
  const routingStats = formatSmartRoutingStats()

  if (isClaudeAISubscriber()) {
    let value: string

    if (currentLimits.isUsingOverage) {
      value =
        'You are currently using your overages to power your Claude Code usage. We will automatically switch you back to your subscription rate limits when they reset'
    } else {
      value =
        'You are currently using your subscription to power your Claude Code usage'
    }

    if (process.env.USER_TYPE === 'ant') {
      value += `\n\n[internal-only] Showing cost anyway:\n ${formatTotalCost()}`
    }
    return { type: 'text', value: value + routingStats }
  }
  return { type: 'text', value: formatTotalCost() + routingStats }
}
