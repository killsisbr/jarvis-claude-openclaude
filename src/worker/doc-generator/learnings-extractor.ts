/**
 * Learnings extractor — extracts key learnings to include in documentation.
 *
 * Filters by confidence and relevance to surface best practices and patterns.
 */

import { getAllLearnings, type Learning } from '../db/learnings'

export interface DocumentedLearning {
  category: string
  type: string
  content: string
  confidence: number
  relevance: number
}

/**
 * Extract top learnings for documentation.
 * Groups by category, sorts by confidence * relevance, returns top N per category.
 */
export function extractKeyLearnings(maxPerCategory = 3): Map<string, DocumentedLearning[]> {
  const all = getAllLearnings()

  // Filter: only high-confidence learnings
  const filtered = all.filter((l) => l.confidence >= 0.7 && l.relevance >= 0.6)

  // Group by category
  const byCategory = new Map<string, Learning[]>()
  for (const learning of filtered) {
    const cat = learning.category || 'general'
    if (!byCategory.has(cat)) {
      byCategory.set(cat, [])
    }
    byCategory.get(cat)!.push(learning)
  }

  // Sort each category and keep top N
  const result = new Map<string, DocumentedLearning[]>()
  for (const [cat, learnings] of byCategory) {
    const sorted = learnings
      .sort((a, b) => b.confidence * b.relevance - a.confidence * a.relevance)
      .slice(0, maxPerCategory)
      .map((l) => ({
        category: l.category || cat,
        type: l.type,
        content: l.content,
        confidence: l.confidence,
        relevance: l.relevance,
      }))

    result.set(cat, sorted)
  }

  return result
}

/**
 * Format learnings for markdown section.
 */
export function formatLearningsSection(learnings: Map<string, DocumentedLearning[]>): string {
  if (learnings.size === 0) {
    return ''
  }

  const lines: string[] = []
  lines.push('## Key Learnings\n')
  lines.push(
    'Extracted from spaced repetition system (confidence >= 0.7, relevance >= 0.6):\n'
  )

  for (const [category, items] of learnings) {
    lines.push(`\n### ${category}`)
    for (const item of items) {
      const badge = item.confidence >= 0.9 ? '⭐⭐' : item.confidence >= 0.8 ? '⭐' : '✓'
      lines.push(
        `- ${badge} [${item.type}] ${item.content} (confidence: ${(item.confidence * 100).toFixed(0)}%)`
      )
    }
  }

  return lines.join('\n')
}

/**
 * Get summary of learning statistics.
 */
export function getLearningStats(): {
  total: number
  highConfidence: number
  byType: Record<string, number>
  categories: string[]
} {
  const all = getAllLearnings()
  const highConfidence = all.filter((l) => l.confidence >= 0.8)
  const byType: Record<string, number> = {}

  for (const l of all) {
    byType[l.type] = (byType[l.type] || 0) + 1
  }

  const categories = Array.from(new Set(all.map((l) => l.category || 'general')))

  return {
    total: all.length,
    highConfidence: highConfidence.length,
    byType,
    categories,
  }
}
