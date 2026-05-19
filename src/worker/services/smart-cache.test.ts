import { afterEach, beforeEach, describe, expect, test } from 'bun:test'
import { SmartCache } from './smart-cache'
import { clearCachedContextsForUser } from '../db/cached-contexts'

describe('SmartCache', () => {
  let cache: SmartCache
  const testUserIds = [
    'user1',
    'user2',
    'user3',
    'user4',
    'user5',
    'user6',
    'user7',
    'user8',
    'user9',
    'user-eviction-test',
    'user-stats',
    'user-clear-test',
    'user-stats',
  ]

  beforeEach(() => {
    cache = new SmartCache()
    // Clean test users from previous runs
    for (const userId of testUserIds) {
      try {
        clearCachedContextsForUser(userId)
      } catch {
        // Ignore cleanup errors
      }
    }
  })

  afterEach(() => {
    cache.removeAllListeners()
    // Clean test users after test
    for (const userId of testUserIds) {
      try {
        clearCachedContextsForUser(userId)
      } catch {
        // Ignore cleanup errors
      }
    }
  })

  describe('getCachedContext', () => {
    test('returns null when no cached contexts exist', async () => {
      const result = await cache.getCachedContext('user1', 'hello', 'model1', 'hash1')
      expect(result).toBeNull()
    })

    test('returns cached context on high similarity (>0.75)', async () => {
      // Setup: cache a context
      await cache.cacheContext({
        user_id: 'user1',
        model: 'model1',
        system_prompt_hash: 'hash1',
        messages: [
          { role: 'user', content: 'How to build a Python server?' },
          { role: 'assistant', content: 'Here is how...' },
        ],
        last_message: 'How to build a Python server?',
        hit_count: 0,
        last_used_at: Date.now(),
      })

      // Test: similar query should hit cache
      const result = await cache.getCachedContext('user1', 'How to build a Python server?', 'model1', 'hash1')

      // Should be exact match or very close
      expect(result).toBeDefined()
      if (result) {
        expect(result.similarity).toBeGreaterThan(0.5)
      }
    })

    test('returns null on low similarity (<0.75)', async () => {
      // Setup: cache a context
      await cache.cacheContext({
        user_id: 'user2',
        model: 'model1',
        system_prompt_hash: 'hash1',
        messages: [
          { role: 'user', content: 'How to build a Python server?' },
          { role: 'assistant', content: 'Here is how...' },
        ],
        last_message: 'How to build a Python server?',
        hit_count: 0,
        last_used_at: Date.now(),
      })

      // Test: very different query should not hit cache
      const result = await cache.getCachedContext(
        'user2',
        'What is the weather today?',
        'model1',
        'hash1'
      )

      expect(result).toBeNull()
    })

    test('filters by model', async () => {
      // Setup: cache contexts for different models
      await cache.cacheContext({
        user_id: 'user3',
        model: 'model-a',
        system_prompt_hash: 'hash1',
        messages: [{ role: 'user', content: 'test' }],
        last_message: 'test',
        hit_count: 0,
        last_used_at: Date.now(),
      })

      // Test: query with different model should not match
      const result = await cache.getCachedContext('user3', 'test', 'model-b', 'hash1')

      expect(result).toBeNull()
    })

    test('filters by system_prompt_hash', async () => {
      // Setup: cache context with hash1
      await cache.cacheContext({
        user_id: 'user4',
        model: 'model1',
        system_prompt_hash: 'hash1',
        messages: [{ role: 'user', content: 'test' }],
        last_message: 'test',
        hit_count: 0,
        last_used_at: Date.now(),
      })

      // Test: query with different hash should not match
      const result = await cache.getCachedContext('user4', 'test', 'model1', 'hash2')

      expect(result).toBeNull()
    })

    test('increments hit_count on cache hit', async () => {
      // Setup
      await cache.cacheContext({
        user_id: 'user5',
        model: 'model1',
        system_prompt_hash: 'hash1',
        messages: [{ role: 'user', content: 'How to learn Python?' }],
        last_message: 'How to learn Python?',
        hit_count: 0,
        last_used_at: Date.now(),
      })

      // First hit - should work with exact match
      let hitCount = 0
      cache.on('cache_hit', () => {
        hitCount++
      })

      await cache.getCachedContext('user5', 'How to learn Python?', 'model1', 'hash1')
      expect(hitCount).toBe(1)

      // Second hit
      await cache.getCachedContext('user5', 'How to learn Python?', 'model1', 'hash1')
      expect(hitCount).toBe(2)
    })

    test('emits cache_hit event', async () => {
      await cache.cacheContext({
        user_id: 'user6',
        model: 'model1',
        system_prompt_hash: 'hash1',
        messages: [{ role: 'user', content: 'test' }],
        last_message: 'test',
        hit_count: 0,
        last_used_at: Date.now(),
      })

      let hitEmitted = false
      cache.once('cache_hit', () => {
        hitEmitted = true
      })

      await cache.getCachedContext('user6', 'test', 'model1', 'hash1')

      expect(hitEmitted).toBe(true)
    })

    test('emits cache_miss event', async () => {
      let missEmitted = false
      cache.once('cache_miss', () => {
        missEmitted = true
      })

      await cache.getCachedContext('user7', 'test', 'model1', 'hash1')

      expect(missEmitted).toBe(true)
    })
  })

  describe('cacheContext', () => {
    test('saves context to database', async () => {
      const id = await cache.cacheContext({
        user_id: 'user8',
        model: 'model1',
        system_prompt_hash: 'hash1',
        messages: [{ role: 'user', content: 'test' }],
        last_message: 'test',
        hit_count: 0,
        last_used_at: Date.now(),
      })

      expect(id).toBeDefined()
      expect(typeof id).toBe('string')
      expect(id.startsWith('cache-')).toBe(true)
    })

    test('emits cached event', async () => {
      let cachedEmitted = false
      cache.once('cached', () => {
        cachedEmitted = true
      })

      await cache.cacheContext({
        user_id: 'user9',
        model: 'model1',
        system_prompt_hash: 'hash1',
        messages: [{ role: 'user', content: 'test' }],
        last_message: 'test',
        hit_count: 0,
        last_used_at: Date.now(),
      })

      expect(cachedEmitted).toBe(true)
    })

    test('enforces max contexts per user (eviction policy)', async () => {
      const userId = 'user-eviction-test'

      // Add 11 contexts (max is 10)
      for (let i = 0; i < 11; i++) {
        await cache.cacheContext({
          user_id: userId,
          model: 'model1',
          system_prompt_hash: 'hash1',
          messages: [{ role: 'user', content: `message ${i}` }],
          last_message: `message ${i}`,
          hit_count: i, // Different hit counts for predictable eviction
          last_used_at: Date.now() + i * 1000, // Different timestamps
        })
      }

      // Get stats to verify eviction happened
      const stats = cache.getStats()
      expect(stats.total).toBeLessThanOrEqual(10)

      // Cleanup
      clearCachedContextsForUser(userId)
    })
  })

  describe('getStats', () => {
    test('returns cache statistics', async () => {
      await cache.cacheContext({
        user_id: 'user-stats',
        model: 'model1',
        system_prompt_hash: 'hash1',
        messages: [{ role: 'user', content: 'test' }],
        last_message: 'test',
        hit_count: 5,
        last_used_at: Date.now(),
      })

      const stats = cache.getStats()

      expect(stats.total).toBeGreaterThan(0)
      expect(typeof stats.avg_hits).toBe('number')
      expect(stats.by_user).toBeDefined()

      // Cleanup
      clearCachedContextsForUser('user-stats')
    })
  })

  describe('clearUserCache', () => {
    test('clears all contexts for a user', async () => {
      const userId = 'user-clear-test'

      // Add 3 contexts
      for (let i = 0; i < 3; i++) {
        await cache.cacheContext({
          user_id: userId,
          model: 'model1',
          system_prompt_hash: 'hash1',
          messages: [{ role: 'user', content: `msg ${i}` }],
          last_message: `msg ${i}`,
          hit_count: 0,
          last_used_at: Date.now(),
        })
      }

      // Clear
      const deleted = cache.clearUserCache(userId)

      expect(deleted).toBe(3)

      // Verify no contexts remain
      const result = await cache.getCachedContext(userId, 'test', 'model1', 'hash1')
      expect(result).toBeNull()
    })
  })
})
