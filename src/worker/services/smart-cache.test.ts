import { describe, it, expect, beforeEach } from 'bun:test'
import { SmartCache, createCachedContext, createPromptHash } from './smart-cache'

describe('SmartCache', () => {
  let cache: SmartCache
  const model = 'claude-opus'
  const promptHash = 'hash-abc123'

  beforeEach(() => {
    cache = new SmartCache()
  })

  describe('similarity calculation', () => {
    it('returns high similarity for nearly identical messages', async () => {
      const context = createCachedContext(
        'user1',
        model,
        promptHash,
        [{ role: 'user', content: 'How to build a Python server?' }],
        'How to build a Python server?'
      )
      await cache.cacheContext(context)

      const retrieved = await cache.getCachedContext(
        'user1',
        'How to build a Python server?',
        model,
        promptHash
      )

      expect(retrieved).toBeDefined()
      expect(retrieved?.id).toBe(context.id)
    })

    it('returns context for similar messages above threshold', async () => {
      const context = createCachedContext(
        'user1',
        model,
        promptHash,
        [],
        'How to create a Python API server'
      )
      await cache.cacheContext(context)

      const retrieved = await cache.getCachedContext(
        'user1',
        'How to build a Python server API',
        model,
        promptHash
      )

      expect(retrieved).toBeDefined()
    })

    it('returns null for dissimilar messages below threshold', async () => {
      const context = createCachedContext(
        'user1',
        model,
        promptHash,
        [],
        'How to make coffee'
      )
      await cache.cacheContext(context)

      const retrieved = await cache.getCachedContext(
        'user1',
        'What is quantum physics',
        model,
        promptHash
      )

      expect(retrieved).toBeNull()
    })
  })

  describe('hit counting', () => {
    it('increments hit count on cache hit', async () => {
      const context = createCachedContext(
        'user1',
        model,
        promptHash,
        [],
        'test message'
      )
      await cache.cacheContext(context)

      expect(context.hitCount).toBe(1)

      const retrieved1 = await cache.getCachedContext(
        'user1',
        'test message',
        model,
        promptHash
      )
      expect(retrieved1?.hitCount).toBe(2)

      const retrieved2 = await cache.getCachedContext(
        'user1',
        'test message',
        model,
        promptHash
      )
      expect(retrieved2?.hitCount).toBe(3)
    })

    it('updates lastUsedAt timestamp on hit', async () => {
      const context = createCachedContext(
        'user1',
        model,
        promptHash,
        [],
        'test'
      )
      const originalTime = context.lastUsedAt
      await cache.cacheContext(context)

      await new Promise(r => setTimeout(r, 10))

      const retrieved = await cache.getCachedContext(
        'user1',
        'test',
        model,
        promptHash
      )

      expect(retrieved?.lastUsedAt).toBeGreaterThan(originalTime)
    })
  })

  describe('eviction policy', () => {
    it('keeps max 10 contexts per user', async () => {
      for (let i = 0; i < 15; i++) {
        const ctx = createCachedContext(
          'user1',
          model,
          promptHash,
          [],
          `message ${i}`
        )
        await cache.cacheContext(ctx)
      }

      const stats = cache.getStats()
      expect(stats.totalContexts).toBeLessThanOrEqual(10)
    })

    it('evicts oldest/least-used contexts', async () => {
      for (let i = 0; i < 12; i++) {
        const ctx = createCachedContext(
          'user1',
          model,
          promptHash,
          [],
          `message ${i}`
        )
        await cache.cacheContext(ctx)
      }

      const stats = cache.getStats()
      expect(stats.totalContexts).toBe(10)
    })

    it('emits eviction event when limit reached', async () => {
      let evictionFired = false
      cache.on('cache_evicted', () => {
        evictionFired = true
      })

      for (let i = 0; i < 12; i++) {
        const ctx = createCachedContext(
          'user1',
          model,
          promptHash,
          [],
          `message ${i}`
        )
        await cache.cacheContext(ctx)
      }

      expect(evictionFired).toBe(true)
    })
  })

  describe('filtering', () => {
    it('filters by model', async () => {
      const ctx1 = createCachedContext('user1', 'claude-opus', promptHash, [], 'test')
      const ctx2 = createCachedContext('user1', 'claude-sonnet', promptHash, [], 'test')

      await cache.cacheContext(ctx1)
      await cache.cacheContext(ctx2)

      const retrieved = await cache.getCachedContext('user1', 'test', 'claude-opus', promptHash)
      expect(retrieved?.model).toBe('claude-opus')
    })

    it('filters by systemPromptHash', async () => {
      const hash1 = 'hash-111'
      const hash2 = 'hash-222'

      const ctx1 = createCachedContext('user1', model, hash1, [], 'test')
      const ctx2 = createCachedContext('user1', model, hash2, [], 'test')

      await cache.cacheContext(ctx1)
      await cache.cacheContext(ctx2)

      const retrieved = await cache.getCachedContext('user1', 'test', model, hash1)
      expect(retrieved?.systemPromptHash).toBe(hash1)
    })
  })

  describe('events', () => {
    it('emits cache_hit event', async () => {
      let hitEvent: any = null
      cache.on('cache_hit', (e) => {
        hitEvent = e
      })

      const ctx = createCachedContext('user1', model, promptHash, [], 'test')
      await cache.cacheContext(ctx)
      await cache.getCachedContext('user1', 'test', model, promptHash)

      expect(hitEvent).toBeDefined()
      expect(hitEvent.userId).toBe('user1')
    })

    it('emits cache_miss event', async () => {
      let missEvent: any = null
      cache.on('cache_miss', (e) => {
        missEvent = e
      })

      await cache.getCachedContext('user1', 'test', model, promptHash)

      expect(missEvent).toBeDefined()
      expect(missEvent.userId).toBe('user1')
    })
  })

  describe('statistics', () => {
    it('returns accurate cache stats', async () => {
      for (let i = 0; i < 5; i++) {
        const ctx = createCachedContext('user1', model, promptHash, [], `msg ${i}`)
        await cache.cacheContext(ctx)
      }

      const stats = cache.getStats()
      expect(stats.totalUsers).toBe(1)
      expect(stats.totalContexts).toBe(5)
    })
  })

  describe('management', () => {
    it('clears cache for specific user', async () => {
      const ctx = createCachedContext('user1', model, promptHash, [], 'test')
      await cache.cacheContext(ctx)

      cache.clearUser('user1')

      const stats = cache.getStats()
      expect(stats.totalContexts).toBe(0)
    })

    it('clears all cache', async () => {
      for (let i = 0; i < 3; i++) {
        const ctx = createCachedContext(`user${i}`, model, promptHash, [], 'test')
        await cache.cacheContext(ctx)
      }

      cache.clearAll()

      const stats = cache.getStats()
      expect(stats.totalContexts).toBe(0)
    })

    it('exports and imports contexts', async () => {
      const ctx1 = createCachedContext('user1', model, promptHash, [], 'test1')
      const ctx2 = createCachedContext('user2', model, promptHash, [], 'test2')

      await cache.cacheContext(ctx1)
      await cache.cacheContext(ctx2)

      const exported = cache.exportContexts()
      expect(exported).toHaveLength(2)

      const cache2 = new SmartCache()
      cache2.importContexts(exported)

      const stats = cache2.getStats()
      expect(stats.totalContexts).toBe(2)
    })
  })
})
