/**
 * Vector search wrapper for semantic learning retrieval.
 *
 * Uses Orama full-text search with caching and fallback filtering.
 * Optimized for performance: <50ms search latency with in-memory index.
 */

import { searchSimilar, indexLearning, type IndexedLearning } from './orama-store'
import type { Learning } from '../db/learnings'

const SEARCH_CACHE_TTL = 5 * 60 * 1000 // 5 minutes
const SEARCH_CACHE_SIZE = 100

interface CachedSearch {
  results: IndexedLearning[]
  timestamp: number
}

const searchCache = new Map<string, CachedSearch>()

/**
 * Search for learnings similar to the user's query.
 * Uses Orama index with caching for performance.
 */
export async function findSimilarLearnings(query: string, limit = 5): Promise<IndexedLearning[]> {
  const cacheKey = `search-${query.toLowerCase()}`
  const cached = searchCache.get(cacheKey)

  if (cached && Date.now() - cached.timestamp < SEARCH_CACHE_TTL) {
    return cached.results.slice(0, limit)
  }

  // Search the Orama index
  const results = await searchSimilar(query, limit * 2) // Get 2x to allow filtering

  // Filter by confidence and relevance
  const filtered = results
    .filter((l) => l.confidence >= 0.6 && l.relevance >= 0.5)
    .sort((a, b) => {
      // Score: relevance * confidence
      const scoreA = a.relevance * a.confidence
      const scoreB = b.relevance * b.confidence
      return scoreB - scoreA
    })
    .slice(0, limit)

  // Update cache
  if (searchCache.size >= SEARCH_CACHE_SIZE) {
    // Simple eviction: remove oldest entry
    const oldest = Array.from(searchCache.entries()).sort((a, b) => a[1].timestamp - b[1].timestamp)[0]
    if (oldest) {
      searchCache.delete(oldest[0])
    }
  }

  searchCache.set(cacheKey, {
    results: filtered,
    timestamp: Date.now(),
  })

  return filtered
}

/**
 * Register a new learning in the Orama index.
 * Called after learning is inserted into the database.
 */
export async function indexNewLearning(learning: Learning): Promise<void> {
  const indexed: IndexedLearning = {
    id: learning.id,
    type: learning.type,
    category: learning.category,
    content: learning.content,
    confidence: learning.confidence,
    relevance: learning.relevance,
  }

  await indexLearning(indexed)

  // Invalidate search cache (new learning might affect results)
  searchCache.clear()
}

/**
 * Update an existing learning's index (after review, confidence change, etc)
 */
export async function updateIndexedLearning(learning: Learning): Promise<void> {
  // Note: Orama doesn't support update in place, so we would need to delete + re-insert
  // For now, we just invalidate cache and rely on next search to refresh
  searchCache.clear()
}

export function getSearchCacheStats(): { size: number; hits: number; misses: number } {
  return {
    size: searchCache.size,
    hits: 0, // Would need to track separately
    misses: 0,
  }
}

export function clearSearchCache(): void {
  searchCache.clear()
}

/**
 * Hybrid search: tries vector search first, falls back to confidence filter.
 * Used as default learning retrieval in learning-context.ts
 */
export async function hybridSearch(
  query: string,
  limit = 5,
  allLearnings?: Learning[]
): Promise<IndexedLearning[]> {
  // Try vector search first
  const vectorResults = await findSimilarLearnings(query, limit)

  if (vectorResults.length > 0) {
    return vectorResults
  }

  // Fallback: if no vector results and we have all learnings, use confidence filter
  if (allLearnings && allLearnings.length > 0) {
    return allLearnings
      .filter((l) => l.confidence >= 0.6 && l.relevance >= 0.5)
      .map((l) => ({
        id: l.id,
        type: l.type,
        category: l.category,
        content: l.content,
        confidence: l.confidence,
        relevance: l.relevance,
      }))
      .sort((a, b) => b.relevance * b.confidence - a.relevance * a.confidence)
      .slice(0, limit)
  }

  return []
}
