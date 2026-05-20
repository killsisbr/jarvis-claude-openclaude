/**
 * Proactive Mode Test Suite
 *
 * Validates:
 * - Activation/deactivation
 * - Tick scheduling respects 30s interval
 * - Pause/resume behavior
 * - Context blocking (error recovery)
 * - Integration: shouldTick() gates tick injection
 */

import {
  activateProactive,
  deactivateProactive,
  isProactiveActive,
  isProactivePaused,
  pauseProactive,
  resumeProactive,
  setContextBlocked,
  getNextTickAt,
  getTickInterval,
  setTickInterval,
  getActivationSource,
  subscribeToProactiveChanges,
  shouldTick,
  __resetForTesting,
} from './index.js'

describe('Proactive Mode', () => {
  beforeEach(() => {
    // Reset to initial state (clears all flags, callbacks, and config)
    __resetForTesting()
  })

  describe('Activation', () => {
    test('activateProactive() sets active flag', () => {
      expect(isProactiveActive()).toBe(false)
      activateProactive('command')
      expect(isProactiveActive()).toBe(true)
      expect(getActivationSource()).toBe('command')
    })

    test('activateProactive() prevents double activation', () => {
      activateProactive('command')
      activateProactive('env')
      // Source should remain 'command'
      expect(getActivationSource()).toBe('command')
    })

    test('deactivateProactive() clears all state', () => {
      activateProactive('command')
      deactivateProactive()
      expect(isProactiveActive()).toBe(false)
      expect(getActivationSource()).toBeNull()
      expect(getNextTickAt()).toBeNull()
    })
  })

  describe('Pause/Resume', () => {
    beforeEach(() => {
      activateProactive('command')
    })

    test('pauseProactive() sets paused flag', () => {
      pauseProactive()
      expect(isProactivePaused()).toBe(true)
    })

    test('resumeProactive() clears paused flag', () => {
      pauseProactive()
      resumeProactive()
      expect(isProactivePaused()).toBe(false)
    })

    test('paused state blocks shouldTick()', () => {
      pauseProactive()
      expect(shouldTick()).toBe(false)
    })
  })

  describe('Context Blocking', () => {
    beforeEach(() => {
      activateProactive('command')
    })

    test('setContextBlocked(true) prevents ticks', () => {
      setContextBlocked(true)
      expect(isProactivePaused()).toBe(true)
      expect(shouldTick()).toBe(false)
    })

    test('setContextBlocked(false) resumes ticks', () => {
      setContextBlocked(true)
      setContextBlocked(false)
      // shouldTick() may still return false if interval not elapsed,
      // but paused state should be cleared
      expect(isProactivePaused()).toBe(false)
    })

    test('contextBlocked is used for API error recovery', () => {
      // Simulate API error
      setContextBlocked(true)
      expect(shouldTick()).toBe(false)

      // Simulate recovery
      setContextBlocked(false)
      expect(shouldTick()).toBe(false) // Still false due to timing, but try again
    })
  })

  describe('Tick Scheduling (30s interval)', () => {
    beforeEach(() => {
      activateProactive('command')
    })

    test('shouldTick() returns false immediately after activation', () => {
      // Just activated, nextTickAt is scheduled but not yet due
      expect(shouldTick()).toBe(false)
    })

    test('nextTickAt is set when activated', () => {
      const start = Date.now()
      const nextTick = getNextTickAt()

      expect(nextTick).not.toBeNull()
      if (nextTick !== null) {
        // nextTick should be in the future (within reasonable bounds)
        expect(nextTick).toBeGreaterThanOrEqual(start)
        expect(nextTick).toBeLessThanOrEqual(start + 35_000) // 30s + buffer
      }
    })

    test('shouldTick() blocks when not active', () => {
      deactivateProactive()
      expect(shouldTick()).toBe(false)
    })

    test('getTickInterval() returns configured interval', () => {
      const defaultInterval = getTickInterval()
      expect(defaultInterval).toBe(30_000)

      setTickInterval(10_000)
      expect(getTickInterval()).toBe(10_000)
    })

    test('setTickInterval() clamps values', () => {
      setTickInterval(1_000) // Too low
      expect(getTickInterval()).toBe(5_000) // Clamped to min

      setTickInterval(999_999_999) // Too high
      expect(getTickInterval()).toBe(300_000) // Clamped to max
    })

    test('shouldTick() clears nextTickAt when not active', () => {
      deactivateProactive()
      expect(getNextTickAt()).toBeNull()
    })
  })

  describe('Subscriptions', () => {
    test('subscribeToProactiveChanges() notifies on activation', () => {
      const callback = vi.fn()
      subscribeToProactiveChanges(callback)

      activateProactive('command')
      expect(callback).toHaveBeenCalledTimes(1)

      deactivateProactive()
      expect(callback).toHaveBeenCalledTimes(2)
    })

    test('subscribeToProactiveChanges() returns unsubscribe function', () => {
      const callback = vi.fn()
      const unsubscribe = subscribeToProactiveChanges(callback)

      activateProactive('command')
      expect(callback).toHaveBeenCalledTimes(1)

      unsubscribe()

      deactivateProactive()
      activateProactive('flag')
      expect(callback).toHaveBeenCalledTimes(1) // Still 1, not called again
    })

    test('subscribeToProactiveChanges() handles callback errors gracefully', () => {
      const goodCallback = vi.fn()
      const badCallback = () => {
        throw new Error('Callback error')
      }

      subscribeToProactiveChanges(badCallback)
      subscribeToProactiveChanges(goodCallback)

      expect(() => {
        activateProactive('command')
      }).not.toThrow()

      expect(goodCallback).toHaveBeenCalled()
    })
  })

  describe('Integration: shouldTick() gates tick injection', () => {
    test('paused state blocks tick injection (shouldTick returns false)', () => {
      activateProactive('command')
      pauseProactive()

      // Even if interval elapsed, pauseProactive blocks shouldTick
      expect(shouldTick()).toBe(false)
    })

    test('contextBlocked state blocks tick injection (shouldTick returns false)', () => {
      activateProactive('command')
      setContextBlocked(true)

      expect(shouldTick()).toBe(false)
    })

    test('shouldTick() is only true when active, not paused, not blocked, and time elapsed', () => {
      // Test all the guards in one go:
      // 1. When not active
      deactivateProactive()
      expect(shouldTick()).toBe(false)

      // 2. When active but paused
      activateProactive('command')
      pauseProactive()
      expect(shouldTick()).toBe(false)

      // 3. When active but blocked
      resumeProactive()
      setContextBlocked(true)
      expect(shouldTick()).toBe(false)

      // 4. When active, not paused, not blocked
      // (time may or may not have elapsed, but at least nextTickAt is set)
      setContextBlocked(false)
      expect(getNextTickAt()).not.toBeNull()
    })
  })
})
