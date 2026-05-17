/**
 * circuitBreaker — per-provider circuit breaker for the Rotate Chain.
 *
 * Three states:
 *   closed    → normal operation, requests pass through
 *   open      → failures exceeded threshold, requests are blocked
 *   half-open → after cooldown, one probe request is allowed
 *
 * If the probe succeeds → back to closed.
 * If the probe fails   → back to open (restart cooldown).
 */

export type CircuitState = 'closed' | 'open' | 'half-open'

export type CircuitBreakerOptions = {
  /** Provider identifier (e.g. "nvidia", "zen", "groq"). */
  name: string
  /** Consecutive failures before opening the circuit. Default: 3. */
  threshold?: number
  /** Milliseconds to wait before transitioning open → half-open. Default: 300_000 (5 min). */
  cooldownMs?: number
  /**
   * If true, the circuit stays permanently open (for 401/auth errors).
   * Only a manual reset can close it. Default: false.
   */
  permanent?: boolean
  /** Called when circuit state changes. */
  onStateChange?: (name: string, from: CircuitState, to: CircuitState, reason: string) => void
}

type InternalState = {
  state: CircuitState
  failureCount: number
  openedAt: number | null
  permanent: boolean
}

export class CircuitBreaker {
  readonly name: string
  private readonly threshold: number
  private readonly cooldownMs: number
  private readonly onStateChange?: (name: string, from: CircuitState, to: CircuitState, reason: string) => void
  private state: InternalState

  constructor(opts: CircuitBreakerOptions) {
    this.name = opts.name
    this.threshold = opts.threshold ?? 3
    this.cooldownMs = opts.cooldownMs ?? 300_000
    this.onStateChange = opts.onStateChange
    this.state = {
      state: 'closed',
      failureCount: 0,
      openedAt: null,
      permanent: opts.permanent ?? false,
    }
  }

  /** Returns the current circuit state. */
  getState(): CircuitState {
    return this.state.state
  }

  /** Returns current consecutive failure count. */
  getFailureCount(): number {
    return this.state.failureCount
  }

  /**
   * Check if the circuit allows a request.
   * Returns true for closed / half-open (probe).
   * Returns false for open (still in cooldown).
   */
  allowRequest(): boolean {
    const s = this.state

    if (s.state === 'closed') return true

    if (s.state === 'open') {
      if (s.permanent) return false
      if (s.openedAt !== null && Date.now() - s.openedAt >= this.cooldownMs) {
        this.transitionTo('half-open', 'cooldown elapsed')
        return true
      }
      return false
    }

    // half-open → allow the probe
    return true
  }

  /**
   * Report a successful request.
   * Closes the circuit (resets failure count).
   */
  reportSuccess(): void {
    const s = this.state
    if (s.state === 'half-open') {
      this.transitionTo('closed', 'probe succeeded')
    } else if (s.state === 'closed') {
      // Reset failure count on success (standard pattern)
    }
    this.state.failureCount = 0
  }

  /**
   * Report a failed request.
   * If failures reach threshold, opens the circuit.
   * If already half-open and probe fails, back to open.
   */
  reportFailure(): void {
    const s = this.state

    if (s.permanent && s.state !== 'closed') {
      // Already open permanently — no change needed
      return
    }

    if (s.state === 'half-open') {
      // Probe failed — back to open, reset cooldown
      this.transitionTo('open', 'half-open probe failed')
      return
    }

    s.failureCount += 1

    if (s.failureCount >= this.threshold) {
      this.transitionTo('open', `failure threshold reached (${s.failureCount}/${this.threshold})`)
    }
  }

  /** Force-open the circuit permanently (e.g. on 401 auth error). */
  openPermanent(reason?: string): void {
    this.state.permanent = true
    this.transitionTo('open', reason ?? 'permanent failure')
  }

  /** Manually reset the circuit to closed. */
  reset(): void {
    const s = this.state
    this.state = {
      state: 'closed',
      failureCount: 0,
      openedAt: null,
      permanent: false,
    }
    if (s.state !== 'closed') {
      this.onStateChange?.(this.name, s.state, 'closed', 'manual reset')
    }
  }

  /** Time remaining in cooldown (ms). 0 if not open or cooldown elapsed. */
  cooldownRemaining(): number {
    const s = this.state
    if (s.state !== 'open' || s.openedAt === null || s.permanent) return 0
    const remaining = this.cooldownMs - (Date.now() - s.openedAt)
    return remaining > 0 ? remaining : 0
  }

  private transitionTo(newState: CircuitState, reason: string): void {
    const from = this.state.state
    this.state.state = newState
    if (newState === 'open') {
      this.state.openedAt = Date.now()
    }
    this.onStateChange?.(this.name, from, newState, reason)
  }
}
