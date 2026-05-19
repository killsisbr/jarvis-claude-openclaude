import { EventEmitter } from 'events'
import type { Message } from '../session-store'
import {
  saveCachedContext,
  getCachedContextsForUser,
  updateCachedContextStats,
  deleteCachedContext,
  deleteOldCachedContexts,
  getCachedContextStats,
  clearCachedContextsForUser,
  type CachedContext,
} from '../db/cached-contexts'

export interface CacheEntry {
  context: CachedContext
  similarity: number
}

// Simple cosine similarity for text (simplified version)
function calculateSimilarity(text1: string, text2: string): number {
  const normalize = (text: string) => text.toLowerCase().split(/\s+/).filter((w) => w.length > 3)

  const words1 = normalize(text1)
  const words2 = normalize(text2)

  if (words1.length === 0 || words2.length === 0) return 0

  const set1 = new Set(words1)
  const set2 = new Set(words2)

  let intersection = 0
  for (const word of set1) {
    if (set2.has(word)) intersection++
  }

  const union = set1.size + set2.size - intersection
  return union === 0 ? 0 : intersection / union
}

export class SmartCache extends EventEmitter {
  private readonly maxContextsPerUser: number = 10
  private readonly similarityThreshold: number = 0.75
  private readonly maxAge: number = 6 * 60 * 60 * 1000 // 6 horas

  constructor() {
    super()

    // Cleanup old contexts a cada 60 minutos
    setInterval(() => {
      const deleted = deleteOldCachedContexts(this.maxAge)
      if (deleted > 0) {
        console.log(`[smart-cache] Deleted ${deleted} old cached contexts`)
      }
    }, 60 * 60 * 1000)
  }

  async getCachedContext(
    userId: string,
    currentMessage: string,
    model: string,
    systemPromptHash: string
  ): Promise<CacheEntry | null> {
    // Fetch cached contexts for user
    const candidates = getCachedContextsForUser(userId)

    // Filter by model + systemPrompt
    const viable = candidates.filter((c) => c.model === model && c.system_prompt_hash === systemPromptHash)

    if (viable.length === 0) {
      this.emit('cache_miss', { userId, reason: 'no_viable_candidates' })
      return null
    }

    // Calculate similarity
    const scored = viable
      .map((c) => ({
        context: c,
        similarity: calculateSimilarity(currentMessage, c.last_message),
      }))
      .sort((a, b) => b.similarity - a.similarity)

    // Return best if similarity > threshold
    const best = scored.find((s) => s.similarity >= this.similarityThreshold)

    if (best) {
      // Update stats
      updateCachedContextStats(best.context.id, {
        hit_count: best.context.hit_count + 1,
        last_used_at: Date.now(),
      })

      this.emit('cache_hit', {
        userId,
        similarity: best.similarity,
        hitCount: best.context.hit_count + 1,
      })

      return best
    }

    this.emit('cache_miss', {
      userId,
      reason: 'low_similarity',
      bestSimilarity: scored[0]?.similarity || 0,
    })

    return null
  }

  async cacheContext(context: Omit<CachedContext, 'id' | 'created_at'>): Promise<string> {
    // Get user's contexts
    const userContexts = getCachedContextsForUser(context.user_id)

    // Eviction: if at max, delete least frequently used
    if (userContexts.length >= this.maxContextsPerUser) {
      const toDelete = userContexts.sort((a, b) => a.hit_count - b.hit_count)[0]
      if (toDelete) {
        deleteCachedContext(toDelete.id)
        this.emit('eviction', {
          userId: context.user_id,
          evictedId: toDelete.id,
          reason: 'max_reached',
        })
      }
    }

    // Save new context
    const id = saveCachedContext(context)

    this.emit('cached', {
      userId: context.user_id,
      contextId: id,
      messageLength: context.messages.length,
    })

    return id
  }

  getStats() {
    return getCachedContextStats()
  }

  clearUserCache(userId: string): number {
    const deleted = clearCachedContextsForUser(userId)
    if (deleted > 0) {
      this.emit('user_cache_cleared', { userId, deleted })
    }
    return deleted
  }
}

let instance: SmartCache | null = null

export function getSmartCache(): SmartCache {
  if (!instance) {
    instance = new SmartCache()
  }
  return instance
}

export function closeSmartCache(): void {
  if (instance) {
    instance.removeAllListeners()
    instance = null
  }
}
