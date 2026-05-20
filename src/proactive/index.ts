/**
 * Proactive Mode — JARVIS autonomous tick loop.
 *
 * When active, the model receives periodic <tick> prompts and can
 * act without waiting for user input. Activated via:
 *   - CLI flag: --proactive
 *   - Env var: CLAUDE_CODE_PROACTIVE=1
 *   - Slash command: /proactive
 */

type ActivationSource = 'command' | 'env' | 'flag'
type Listener = () => void

let active = false
let paused = false
let contextBlocked = false
let nextTickAt: number | null = null
let tickInterval = 30_000 // 30s default
let source: ActivationSource | null = null

const listeners = new Set<Listener>()

function notify(): void {
  for (const fn of listeners) {
    try {
      fn()
    } catch {}
  }
}

export function isProactiveActive(): boolean {
  return active
}

export function isProactivePaused(): boolean {
  return paused || contextBlocked
}

export function activateProactive(src: ActivationSource): void {
  if (active) return
  active = true
  paused = false
  contextBlocked = false
  source = src
  scheduleNextTick()
  notify()
}

export function deactivateProactive(): void {
  active = false
  paused = false
  contextBlocked = false
  nextTickAt = null
  source = null
  notify()
}

export function pauseProactive(): void {
  if (!active) return
  paused = true
  nextTickAt = null
  notify()
}

export function resumeProactive(): void {
  if (!active) return
  paused = false
  scheduleNextTick()
  notify()
}

export function setContextBlocked(blocked: boolean): void {
  contextBlocked = blocked
  if (!blocked && active && !paused) {
    scheduleNextTick()
  }
  notify()
}

export function getNextTickAt(): number | null {
  return nextTickAt
}

export function getTickInterval(): number {
  return tickInterval
}

export function setTickInterval(ms: number): void {
  tickInterval = Math.max(5_000, Math.min(ms, 300_000))
}

export function getActivationSource(): ActivationSource | null {
  return source
}

export function subscribeToProactiveChanges(cb: Listener): () => void {
  listeners.add(cb)
  return () => {
    listeners.delete(cb)
  }
}

/** Reset to initial state (testing only) */
export function __resetForTesting(): void {
  active = false
  paused = false
  contextBlocked = false
  nextTickAt = null
  tickInterval = 30_000
  source = null
  listeners.clear()
}

function scheduleNextTick(): void {
  if (!active || paused || contextBlocked) {
    nextTickAt = null
    return
  }
  nextTickAt = Date.now() + tickInterval
}

/**
 * Called by the run loop after each turn completes.
 * Returns true if a tick should be injected.
 */
export function shouldTick(): boolean {
  if (!active || paused || contextBlocked) return false
  if (nextTickAt === null) return false
  if (Date.now() >= nextTickAt) {
    scheduleNextTick()
    return true
  }
  return false
}
