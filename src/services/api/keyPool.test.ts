import { describe, test, expect, beforeEach, afterEach } from 'bun:test'
import {
  KeyPool,
  KeyPoolExhaustedError,
  expandKeysFromEnv,
} from './keyPool.ts'

describe('KeyPool — construction', () => {
  test('throws when keys array is empty', () => {
    expect(() => new KeyPool({ keys: [] })).toThrow(/at least one key/)
  })

  test('dedupes keys preserving first-seen order', () => {
    const pool = new KeyPool({ keys: ['a', 'b', 'a', 'c', 'b'] })
    expect(pool.size()).toBe(3)
  })

  test('drops empty-string keys silently (env may yield empties)', () => {
    const pool = new KeyPool({ keys: ['a', '', 'b'] })
    expect(pool.size()).toBe(2)
  })
})

describe('KeyPool — round-robin (default)', () => {
  test('cycles through keys in order', () => {
    const pool = new KeyPool({ keys: ['k1', 'k2', 'k3'] })
    expect(pool.pick()).toBe('k1')
    expect(pool.pick()).toBe('k2')
    expect(pool.pick()).toBe('k3')
    expect(pool.pick()).toBe('k1')
  })

  test('skips key in cooldown', () => {
    const pool = new KeyPool({ keys: ['k1', 'k2', 'k3'] })
    pool.pick() // k1
    pool.markCooldown('k1', 5_000)
    // Cursor advanced past k1. Next pick should be k2, then k3, then k1 again (still cooling) → k2 again.
    expect(pool.pick()).toBe('k2')
    expect(pool.pick()).toBe('k3')
    expect(pool.pick()).toBe('k2') // k1 still in cooldown
  })

  test('throws KeyPoolExhaustedError when all keys cooling down', () => {
    const pool = new KeyPool({ keys: ['k1', 'k2'], cooldownMs: 1_000 })
    pool.markCooldown('k1')
    pool.markCooldown('k2')
    expect(() => pool.pick()).toThrow(KeyPoolExhaustedError)
  })

  test('resetCooldown restores availability', () => {
    const pool = new KeyPool({ keys: ['k1'], cooldownMs: 60_000 })
    pool.markCooldown('k1')
    expect(pool.hasAvailable()).toBe(false)
    pool.resetCooldown('k1')
    expect(pool.hasAvailable()).toBe(true)
    expect(pool.pick()).toBe('k1')
  })
})

describe('KeyPool — least-recent', () => {
  test('prefers never-used keys, then oldest', async () => {
    const pool = new KeyPool({
      keys: ['k1', 'k2', 'k3'],
      rotation: 'least-recent',
    })
    expect(pool.pick()).toBe('k1') // never-used wins
    expect(pool.pick()).toBe('k2')
    expect(pool.pick()).toBe('k3')
    // All used now — k1 is oldest:
    expect(pool.pick()).toBe('k1')
  })
})

describe('KeyPool — markSuccess + getStats', () => {
  test('accumulates tokens and successes', () => {
    const pool = new KeyPool({ keys: ['k1', 'k2'], name: 'zen-pool' })
    const k = pool.pick()
    pool.markSuccess(k, { tokens: 1234 })
    pool.markSuccess(k, { tokens: 500 })
    const stats = pool.getStats()
    expect(stats.name).toBe('zen-pool')
    expect(stats.totalKeys).toBe(2)
    expect(stats.activeKeys).toBe(2)
    expect(stats.perKey[0]!.totalTokens).toBe(1734)
    expect(stats.perKey[0]!.successes).toBe(2)
  })

  test('masks keys in stats output', () => {
    const pool = new KeyPool({ keys: ['sk-abcdef1234567890'] })
    const stats = pool.getStats()
    expect(stats.perKey[0]!.shortName).toBe('sk-a...7890')
    expect(stats.perKey[0]!.shortName).not.toContain('cdef')
  })

  test('reports cooldown count accurately', () => {
    const pool = new KeyPool({ keys: ['a', 'b', 'c'] })
    pool.markCooldown('b', 60_000)
    const stats = pool.getStats()
    expect(stats.activeKeys).toBe(2)
    expect(stats.cooldownKeys).toBe(1)
  })
})

describe('expandKeysFromEnv', () => {
  const originalEnv = process.env
  beforeEach(() => {
    process.env = { ...originalEnv }
  })
  afterEach(() => {
    process.env = originalEnv
  })

  test('expands ZEN_API_KEY_* pattern', () => {
    process.env.ZEN_API_KEY_1 = 'sk-1'
    process.env.ZEN_API_KEY_2 = 'sk-2'
    process.env.ZEN_API_KEY_FOO = 'sk-foo'
    process.env.OTHER_KEY = 'sk-nope'
    const keys = expandKeysFromEnv('ZEN_API_KEY_*')
    expect(keys.sort()).toEqual(['sk-1', 'sk-2', 'sk-foo'].sort())
  })

  test('returns empty array when no matches', () => {
    // beforeEach gives us a clean clone of process.env — pattern matches nothing.
    expect(expandKeysFromEnv('NOTHING_MATCHES_PATTERN_*')).toEqual([])
  })

  test('returns empty array for pattern without *', () => {
    process.env.FOO = 'bar'
    expect(expandKeysFromEnv('FOO')).toEqual([])
  })

  test('filters empty-string env values', () => {
    process.env.POOL_X_1 = 'k1'
    process.env.POOL_X_2 = ''
    process.env.POOL_X_3 = 'k3'
    expect(expandKeysFromEnv('POOL_X_*').sort()).toEqual(['k1', 'k3'])
  })

  test('supports suffix patterns', () => {
    process.env.KEY_A_END = 'a'
    process.env.KEY_B_END = 'b'
    process.env.KEY_C_OTHER = 'c'
    expect(expandKeysFromEnv('KEY_*_END').sort()).toEqual(['a', 'b'])
  })
})
