/**
 * KeyPool — API key rotation with cooldown.
 *
 * Encapsulates the "pool of N keys with round-robin and 429 cooldown" pattern.
 * No external dependencies — pure logic, easy to test.
 *
 * Usage:
 *   const pool = new KeyPool({
 *     keys: ['sk-1', 'sk-2', 'sk-3'],
 *     rotation: 'round-robin',
 *     cooldownMs: 60_000,
 *   })
 *
 *   const key = pool.pick()                 // 'sk-1'
 *   await callApi(key)
 *   pool.markSuccess(key, { tokens: 1234 })
 *
 *   // on 429:
 *   pool.markCooldown(key)
 *   const next = pool.pick()                // 'sk-2' (sk-1 is cooling down)
 *
 * Stats:
 *   pool.getStats() → per-key stats for the /cost dashboard
 */

export type RotationStrategy = 'round-robin' | 'least-recent'

export type KeyPoolOptions = {
  keys: string[]
  rotation?: RotationStrategy
  cooldownMs?: number
  /** Human-readable name for logs/dashboard (e.g. "zen-pool"). */
  name?: string
}

export type KeyStats = {
  key: string
  /** Last 4 chars only — never log the full key. */
  shortName: string
  requests: number
  successes: number
  errors429: number
  totalTokens: number
  inCooldownUntil: number | null
  lastUsedAt: number | null
}

export type PoolStats = {
  name: string
  totalKeys: number
  activeKeys: number
  cooldownKeys: number
  rotation: RotationStrategy
  perKey: KeyStats[]
}

type InternalKeyState = {
  key: string
  requests: number
  successes: number
  errors429: number
  totalTokens: number
  inCooldownUntil: number | null
  lastUsedAt: number | null
}

const DEFAULT_COOLDOWN_MS = 60_000

function maskKey(key: string): string {
  if (key.length <= 8) return '****'
  return `${key.slice(0, 4)}...${key.slice(-4)}`
}

export class KeyPool {
  private readonly name: string
  private readonly rotation: RotationStrategy
  private readonly cooldownMs: number
  private readonly states: Map<string, InternalKeyState> = new Map()
  private readonly keyOrder: string[] = []
  private cursor = 0

  constructor(options: KeyPoolOptions) {
    if (!options.keys || options.keys.length === 0) {
      throw new Error('KeyPool requires at least one key')
    }
    this.name = options.name ?? 'unnamed'
    this.rotation = options.rotation ?? 'round-robin'
    this.cooldownMs = options.cooldownMs ?? DEFAULT_COOLDOWN_MS

    // Dedupe keys, preserve first-seen order.
    const seen = new Set<string>()
    for (const key of options.keys) {
      if (!key || seen.has(key)) continue
      seen.add(key)
      this.keyOrder.push(key)
      this.states.set(key, {
        key,
        requests: 0,
        successes: 0,
        errors429: 0,
        totalTokens: 0,
        inCooldownUntil: null,
        lastUsedAt: null,
      })
    }
  }

  /**
   * Pick the next available key from the pool.
   * Throws if all keys are in cooldown — caller should fall back to another pool or surface the error.
   */
  pick(): string {
    const now = Date.now()
    const tried = new Set<string>()

    if (this.rotation === 'least-recent') {
      // Sort by lastUsedAt asc (never-used first), filter cooldown.
      const candidates = this.keyOrder
        .map((k) => this.states.get(k)!)
        .filter((s) => !this.isCoolingDown(s, now))
        .sort((a, b) => (a.lastUsedAt ?? 0) - (b.lastUsedAt ?? 0))
      if (candidates.length === 0) {
        throw new KeyPoolExhaustedError(this.name, this.keyOrder.length)
      }
      const chosen = candidates[0]!
      chosen.requests += 1
      chosen.lastUsedAt = now
      return chosen.key
    }

    // Round-robin: advance cursor until we find an available key or exhaust.
    for (let i = 0; i < this.keyOrder.length; i++) {
      const idx = (this.cursor + i) % this.keyOrder.length
      const key = this.keyOrder[idx]!
      const state = this.states.get(key)!
      if (tried.has(key)) continue
      tried.add(key)
      if (this.isCoolingDown(state, now)) continue
      this.cursor = (idx + 1) % this.keyOrder.length
      state.requests += 1
      state.lastUsedAt = now
      return state.key
    }

    throw new KeyPoolExhaustedError(this.name, this.keyOrder.length)
  }

  markSuccess(key: string, opts?: { tokens?: number }): void {
    const state = this.states.get(key)
    if (!state) return
    state.successes += 1
    if (opts?.tokens && Number.isFinite(opts.tokens)) {
      state.totalTokens += opts.tokens
    }
  }

  /** Place a key in cooldown for cooldownMs (use after a 429 / quota error). */
  markCooldown(key: string, durationMs?: number): void {
    const state = this.states.get(key)
    if (!state) return
    state.errors429 += 1
    state.inCooldownUntil = Date.now() + (durationMs ?? this.cooldownMs)
  }

  /** Force-clear cooldown for tests or manual recovery. */
  resetCooldown(key: string): void {
    const state = this.states.get(key)
    if (!state) return
    state.inCooldownUntil = null
  }

  hasAvailable(): boolean {
    const now = Date.now()
    for (const state of this.states.values()) {
      if (!this.isCoolingDown(state, now)) return true
    }
    return false
  }

  size(): number {
    return this.keyOrder.length
  }

  getStats(): PoolStats {
    const now = Date.now()
    const perKey: KeyStats[] = this.keyOrder.map((k) => {
      const state = this.states.get(k)!
      return {
        key: state.key,
        shortName: maskKey(state.key),
        requests: state.requests,
        successes: state.successes,
        errors429: state.errors429,
        totalTokens: state.totalTokens,
        inCooldownUntil: state.inCooldownUntil,
        lastUsedAt: state.lastUsedAt,
      }
    })
    const cooldownKeys = perKey.filter(
      (k) => k.inCooldownUntil !== null && k.inCooldownUntil > now,
    ).length
    return {
      name: this.name,
      totalKeys: this.keyOrder.length,
      activeKeys: this.keyOrder.length - cooldownKeys,
      cooldownKeys,
      rotation: this.rotation,
      perKey,
    }
  }

  private isCoolingDown(state: InternalKeyState, now: number): boolean {
    return state.inCooldownUntil !== null && state.inCooldownUntil > now
  }
}

export class KeyPoolExhaustedError extends Error {
  constructor(
    public readonly poolName: string,
    public readonly poolSize: number,
  ) {
    super(`KeyPool "${poolName}" exhausted: all ${poolSize} keys are in cooldown.`)
    this.name = 'KeyPoolExhaustedError'
  }
}

/**
 * Expand `api_keys_env` glob pattern over process.env.
 *
 * Pattern syntax: a single `*` matches any suffix. Examples:
 *   "ZEN_API_KEY_*"    matches ZEN_API_KEY_1, ZEN_API_KEY_2, ZEN_API_KEY_FOO
 *   "OPENROUTER_KEY_*" matches OPENROUTER_KEY_A, OPENROUTER_KEY_B
 *
 * Returns the values (not the variable names), filtering empty/undefined.
 * Returns [] if pattern is invalid or no matches found.
 */
export function expandKeysFromEnv(pattern: string): string[] {
  if (!pattern || !pattern.includes('*')) return []
  const [prefix, suffix] = pattern.split('*', 2) as [string, string]
  const out: string[] = []
  for (const [name, value] of Object.entries(process.env)) {
    if (!name.startsWith(prefix)) continue
    if (suffix && !name.endsWith(suffix)) continue
    if (typeof value === 'string' && value.length > 0) {
      out.push(value)
    }
  }
  return out
}
