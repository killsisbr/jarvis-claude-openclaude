/**
 * cycleRecorder — append-only JSONL instrumentation for smart routing decisions.
 *
 * Every API call that passes through smart routing gets a single-line JSON
 * record appended to a session-scoped JSONL file. The record captures:
 *
 *   - Routing decision (category, target, reason)
 *   - Provider used (baseURL, masked key)
 *   - Outcome (success / rate_limit / error)
 *   - Token counts + latency
 *
 * The `/cost` command reads these records to render a per-session dashboard.
 *
 * Design:
 *   - Append-only (no reads during writes — safe for concurrent async)
 *   - One file per session, stored next to the transcript
 *   - No dependencies on analytics / telemetry — local-only data
 *   - Sync writes via appendFileSync for simplicity (JSONL lines are tiny)
 */

import { appendFileSync, mkdirSync } from 'node:fs'
import { join } from 'node:path'

export type CycleRecord = {
  /** ISO timestamp of the API call start. */
  ts: string
  /** 1-indexed turn within the session. */
  turn: number
  /** 5-category classification from smart routing. */
  category: string
  /** Target string, e.g. "zen-pool:claude-sonnet-4". */
  target: string
  /** Human-readable routing reason. */
  reason: string
  /** Provider base URL (for grouping in the dashboard). */
  baseURL: string
  /** Masked API key (e.g. "sk-a...7890") — never the full key. */
  maskedKey: string
  /** Outcome: 'success', 'rate_limit', 'error', or 'pending'. */
  outcome: 'success' | 'rate_limit' | 'error' | 'pending'
  /** Wall-clock milliseconds for the API call (0 if pending/error). */
  latencyMs: number
  /** Total tokens consumed (input + output), if known. */
  tokens?: number
  /** Input tokens, if broken out by the API response. */
  inputTokens?: number
  /** Output tokens, if broken out by the API response. */
  outputTokens?: number
  /** Error message when outcome is 'error'. */
  errorMsg?: string
}

/**
 * Mask an API key for safe logging/display.
 * "sk-abcdef1234567890" → "sk-a...7890"
 */
export function maskKey(key: string): string {
  if (!key || key.length < 8) return key ? '***' : ''
  return `${key.slice(0, 4)}...${key.slice(-4)}`
}

let sessionLogDir: string | null = null
let sessionLogPath: string | null = null

/**
 * Initialize the cycle recorder for this session.
 * Call once at session start. Safe to call multiple times (idempotent).
 *
 * @param logDir - Directory where the JSONL file will be written.
 *                 Typically the session transcript directory.
 */
export function initCycleRecorder(logDir: string): void {
  if (sessionLogPath) return // already initialized
  sessionLogDir = logDir
  mkdirSync(logDir, { recursive: true })
  sessionLogPath = join(logDir, 'routing-cycles.jsonl')
}

/**
 * Record a completed routing cycle. Appends one JSON line to the session log.
 * No-op if initCycleRecorder hasn't been called (graceful for tests / dry runs).
 */
export function recordCycle(record: CycleRecord): void {
  if (!sessionLogPath) return
  try {
    appendFileSync(sessionLogPath, JSON.stringify(record) + '\n')
  } catch {
    // Swallow write errors — instrumentation must never crash the main loop.
  }
}

/**
 * Create a "start" snapshot for a routing cycle. The caller fills in outcome
 * fields after the API call completes.
 */
export function startCycleRecord(fields: {
  turn: number
  category: string
  target: string
  reason: string
  baseURL: string
  apiKey: string
}): CycleRecord {
  return {
    ts: new Date().toISOString(),
    turn: fields.turn,
    category: fields.category,
    target: fields.target,
    reason: fields.reason,
    baseURL: fields.baseURL,
    maskedKey: maskKey(fields.apiKey),
    outcome: 'pending',
    latencyMs: 0,
  }
}

/**
 * Finalize a cycle record with outcome data and write it.
 */
export function completeCycleRecord(
  record: CycleRecord,
  outcome: {
    kind: 'success' | 'rate_limit' | 'error'
    latencyMs: number
    tokens?: number
    inputTokens?: number
    outputTokens?: number
    errorMsg?: string
  },
): void {
  record.outcome = outcome.kind
  record.latencyMs = outcome.latencyMs
  if (outcome.tokens !== undefined) record.tokens = outcome.tokens
  if (outcome.inputTokens !== undefined) record.inputTokens = outcome.inputTokens
  if (outcome.outputTokens !== undefined) record.outputTokens = outcome.outputTokens
  if (outcome.errorMsg) record.errorMsg = outcome.errorMsg
  recordCycle(record)
}

/** Get the current session log path (for the /cost command). Null if uninitialized. */
export function getCycleLogPath(): string | null {
  return sessionLogPath
}

/** Reset state (for tests). */
export function _resetForTest(): void {
  sessionLogDir = null
  sessionLogPath = null
}
