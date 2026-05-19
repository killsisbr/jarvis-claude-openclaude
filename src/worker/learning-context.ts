import { getLearning, getReviewDue, getAllLearnings, type Learning } from './db/learnings'
import { findSimilarLearnings, hybridSearch } from './vectordb/vector-search'

const LEARNING_CACHE_TTL = 5 * 60 * 1000 // 5 minutes
const MAX_LEARNINGS_PER_QUERY = 4
const MIN_CONFIDENCE = 0.6
const MIN_RELEVANCE = 0.5
const USE_VECTOR_SEARCH = true // Toggle between vector and confidence-based

interface CachedLearnings {
  learnings: Learning[]
  timestamp: number
}

const cache = new Map<string, CachedLearnings>()

function getCacheKey(userId: string, category?: string): string {
  return `learning-${userId}-${category || 'all'}`
}

function isCacheValid(cached: CachedLearnings): boolean {
  return Date.now() - cached.timestamp < LEARNING_CACHE_TTL
}

export async function extractRelevantLearnings(userId: string, query: string, category?: string): Promise<Learning[]> {
  const cacheKey = getCacheKey(userId, category)
  const cached = cache.get(cacheKey)

  let learnings: Learning[]

  if (cached && isCacheValid(cached)) {
    learnings = cached.learnings
  } else {
    if (USE_VECTOR_SEARCH && query && query.length > 3) {
      // Vector search: semantic similarity
      const vectorResults = await findSimilarLearnings(query, MAX_LEARNINGS_PER_QUERY)

      // Convert IndexedLearning back to Learning
      learnings = vectorResults.map((v) => ({
        id: v.id,
        type: v.type,
        category: v.category,
        content: v.content,
        confidence: v.confidence,
        relevance: v.relevance,
        reviewCount: 0,
        nextReviewAt: Date.now(),
        lastReviewAt: undefined,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      }))
    } else {
      // Fallback: confidence-based filtering for short queries
      const reviewDue = getReviewDue(userId, 20)

      learnings = reviewDue
        .filter((l) => l.confidence >= MIN_CONFIDENCE && l.relevance >= MIN_RELEVANCE)
        .sort((a, b) => {
          const scoreA = a.relevance * a.confidence
          const scoreB = b.relevance * b.confidence
          return scoreB - scoreA
        })
        .slice(0, MAX_LEARNINGS_PER_QUERY)
    }

    // Update cache
    cache.set(cacheKey, {
      learnings,
      timestamp: Date.now(),
    })
  }

  return learnings
}

export function formatLearningsContext(learnings: Learning[]): string {
  if (learnings.length === 0) {
    return ''
  }

  const lines = learnings.map((l) => {
    const confidence = (l.confidence * 100).toFixed(0)
    const badge = l.confidence >= 0.8 ? '🟢' : l.confidence >= 0.6 ? '🟡' : '🔴'
    return `${badge} [${l.type}] ${l.content.slice(0, 80)} (${confidence}%)`
  })

  return `\n## Related Learnings:\n${lines.join('\n')}`
}

export async function registerLearningFromResponse(
  userId: string,
  query: string,
  response: string,
  category?: string
): Promise<void> {
  const keywords = extractKeywords(response)

  const { proposeLearning, registerLearning } = require('./db/learnings')
  const { indexNewLearning } = await import('./vectordb/vector-search')

  for (const keyword of keywords) {
    const learning: Omit<
      Learning,
      'id' | 'reviewCount' | 'nextReviewAt' | 'createdAt' | 'updatedAt' | 'lastReviewAt'
    > = {
      type: category || 'general',
      category,
      content: keyword,
      confidence: 0.7, // Start with medium confidence
      relevance: 0.9, // High initial relevance
    }

    const proposedLearning = proposeLearning(learning)
    registerLearning(proposedLearning)

    // Also index in Orama for vector search
    try {
      await indexNewLearning(proposedLearning)
    } catch (err) {
      console.warn('[learning] Failed to index in Orama:', err instanceof Error ? err.message : String(err))
    }
  }

  // Invalidate cache after registering new learnings
  const cacheKey = getCacheKey(userId, category)
  cache.delete(cacheKey)
}

function extractKeywords(text: string): string[] {
  // Ultra-simple extraction: find quoted strings and technical terms
  const keywords: string[] = []

  // Extract quoted strings
  const quoted = text.match(/"([^"]{5,100})"/g)
  if (quoted) {
    keywords.push(...quoted.map((q) => q.slice(1, -1)))
  }

  // Extract code patterns (function names, configs)
  const codePatterns = text.match(/`([a-zA-Z0-9_\-.\[\]()]+)`/g)
  if (codePatterns) {
    keywords.push(...codePatterns.map((p) => p.slice(1, -1)))
  }

  // Extract error/success keywords
  const keywords_regex = /(?:fixed|resolved|implemented|added|updated|bug|error|issue|feature|optimization)[\s:]+([^\n.!?]{10,80})/gi
  let match
  while ((match = keywords_regex.exec(text)) !== null) {
    const keyword = match[1].trim()
    if (keyword.length > 5 && keyword.length < 100) {
      keywords.push(keyword)
    }
  }

  // Deduplicate and limit
  return Array.from(new Set(keywords)).slice(0, 3)
}

export function clearCache(): void {
  cache.clear()
}

export function getCacheStats(): { size: number; entries: number } {
  let totalSize = 0
  for (const [, cached] of cache) {
    totalSize += cached.learnings.length
  }
  return { size: totalSize, entries: cache.size }
}
