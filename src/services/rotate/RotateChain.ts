/**
 * RotateChain — ordered provider list with automatic failover.
 *
 * The chain walks through providers in order:
 *   NVIDIA (primary) → Zen (fallback 1) → Groq (fallback 2)
 *
 * Each provider has its own CircuitBreaker. When a provider fails,
 * the chain tries the next one. If all fail, a friendly error is returned.
 *
 * The chain is configured via env vars and instantiated once at boot.
 */
import { CircuitBreaker, type CircuitState } from './circuitBreaker.ts'

// ── Failure classification ──

export type FailureKind = 'transient' | 'rate-limit' | 'timeout' | 'auth' | 'server-error'

export function classifyError(err: unknown): FailureKind {
  if (err instanceof Response) {
    if (err.status === 429) return 'rate-limit'
    if (err.status === 401 || err.status === 403) return 'auth'
    if (err.status >= 500) return 'server-error'
    return 'transient'
  }

  const msg = String(err)
  if (msg.includes('429') || msg.includes('rate limit') || msg.includes('rate_limit')) return 'rate-limit'
  if (msg.includes('401') || msg.includes('unauthorized') || msg.includes('auth')) return 'auth'
  if (msg.includes('503') || msg.includes('service unavailable') || msg.includes('5xx')) return 'server-error'
  if (msg.includes('timeout') || msg.includes('timed out') || msg.includes('abort')) return 'timeout'
  return 'transient'
}

// ── Provider descriptor ──

export type ProviderEntry = {
  id: string
  label: string
  baseURL: string
  model: string
  apiKey: string
  circuitBreaker: CircuitBreaker
}

export type ProviderEntryConfig = {
  id: string
  label: string
  baseURL: string
  model: string
  apiKey: string
  /** Circuit breaker threshold (default: 3). */
  threshold?: number
  /** Circuit breaker cooldown in ms (default: 300_000). */
  cooldownMs?: number
}

// ── Event types ──

export type RotateEvent =
  | { kind: 'attempt'; provider: string; position: number }
  | { kind: 'skip'; provider: string; reason: string; circuitState: CircuitState }
  | { kind: 'fail'; provider: string; error: string; failureKind: FailureKind }
  | { kind: 'success'; provider: string }
  | { kind: 'all-exhausted'; lastError: string }

export type RotateEventCallback = (event: RotateEvent) => void

// ── RotateChain class ──

export class RotateChain {
  private readonly providers: ProviderEntry[]
  private readonly onEvent: RotateEventCallback | null
  private providerIndex: number = 0

  constructor(configs: ProviderEntryConfig[], onEvent?: RotateEventCallback) {
    this.onEvent = onEvent ?? null
    this.providers = configs.map((cfg) => ({
      ...cfg,
      circuitBreaker: new CircuitBreaker({
        name: cfg.id,
        threshold: cfg.threshold ?? 3,
        cooldownMs: cfg.cooldownMs ?? 300_000,
        onStateChange: (name, from, to, reason) => {
          this.onEvent?.({
            kind: 'skip',
            provider: name,
            reason: `circuit ${from} → ${to}: ${reason}`,
            circuitState: to,
          })
        },
      }),
    }))
  }

  /** All provider IDs in order. */
  getProviderIds(): string[] {
    return this.providers.map((p) => p.id)
  }

  /** Get the currently active provider (or null if none). */
  getActiveProvider(): ProviderEntry | null {
    if (this.providerIndex < 0 || this.providerIndex >= this.providers.length) return null
    return this.providers[this.providerIndex]
  }

  /**
   * Find the next alive provider starting from position `startAt`.
   * Returns null when all are exhausted.
   */
  findNextAlive(startAt: number = 0): { provider: ProviderEntry; index: number } | null {
    for (let i = startAt; i < this.providers.length; i++) {
      const p = this.providers[i]
      if (p.circuitBreaker.allowRequest()) {
        return { provider: p, index: i }
      }
      this.onEvent?.({
        kind: 'skip',
        provider: p.id,
        reason: `circuit is ${p.circuitBreaker.getState()}`,
        circuitState: p.circuitBreaker.getState(),
      })
    }
    return null
  }

  /**
   * Try the next provider in the chain.
   * Returns a provider + index, or null if all are exhausted.
   */
  tryNext(): { provider: ProviderEntry; index: number } | null {
    // Start from current position + 1 (or 0 if first call)
    const start = this.providers.length > 0 && this.providerIndex < this.providers.length - 1
      ? this.providerIndex + 1
      : 0
    const found = this.findNextAlive(start)

    if (found) {
      this.providerIndex = found.index
      this.onEvent?.({
        kind: 'attempt',
        provider: found.provider.id,
        position: found.index,
      })
    } else {
      this.onEvent?.({ kind: 'all-exhausted', lastError: 'No providers available' })
    }

    return found
  }

  /**
   * Find a specific provider by ID in the chain.
   * Returns null if not found.
   */
  getProvider(id: string): ProviderEntry | undefined {
    return this.providers.find((p) => p.id === id)
  }

  /**
   * Reset the chain back to the first provider.
   * Call this on a new session / retry.
   */
  resetToFirst(): void {
    this.providerIndex = 0
  }

  /**
   * Reset all circuit breakers to closed.
   */
  resetAll(): void {
    for (const p of this.providers) {
      p.circuitBreaker.reset()
    }
    this.providerIndex = 0
  }

  /**
   * Report a failure on the current provider.
   * The circuit breaker will track consecutive failures.
   *
   * Returns the failure kind for the caller to decide next action.
   */
  reportFailure(error: unknown): FailureKind {
    const provider = this.getActiveProvider()
    if (!provider) return 'transient'

    const kind = classifyError(error)
    const reason = String(error)

    this.onEvent?.({
      kind: 'fail',
      provider: provider.id,
      error: reason.slice(0, 200),
      failureKind: kind,
    })

    switch (kind) {
      case 'auth':
        // Permanent open — no retry will help
        provider.circuitBreaker.openPermanent(`auth error: ${reason.slice(0, 100)}`)
        break
      case 'server-error':
      case 'transient':
        provider.circuitBreaker.reportFailure()
        break
      case 'rate-limit':
      case 'timeout':
        // Don't count toward circuit breaker threshold, but do skip this provider for this query
        break
    }

    // Advance to the next alive provider so the next call to getActiveProvider()
    // returns the next one in the chain.
    provider.circuitBreaker.allowRequest() // may transition open → half-open if cooldown elapsed
    this.tryNext()

    return kind
  }

  /**
   * Report success on the current provider.
   * Resets the circuit breaker's failure count.
   */
  reportSuccess(): void {
    const provider = this.getActiveProvider()
    if (!provider) return

    provider.circuitBreaker.reportSuccess()
    this.onEvent?.({
      kind: 'success',
      provider: provider.id,
    })
  }

  /** Get all providers and their circuit states (for diagnostics). */
  getStatus(): Array<{ id: string; label: string; state: CircuitState; failureCount: number; cooldownMs: number }> {
    return this.providers.map((p) => ({
      id: p.id,
      label: p.label,
      state: p.circuitBreaker.getState(),
      failureCount: p.circuitBreaker.getFailureCount(),
      cooldownMs: p.circuitBreaker.cooldownRemaining(),
    }))
  }
}
