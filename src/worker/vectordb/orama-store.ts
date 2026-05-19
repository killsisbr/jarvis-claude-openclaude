/**
 * Orama vector index store for semantic search over learnings.
 *
 * Uses Orama full-text search (in-memory) with data persistence.
 * No external embedding APIs — local-only, low latency, offline-compatible.
 */

import { create, insert, search, type AnyOrama } from '@orama/orama'
import { persist, restore } from '@orama/plugin-data-persistence'
import { join } from 'path'
import { homedir } from 'os'
import fs from 'fs'

const INDEX_PATH = join(homedir(), '.jarvis', 'learnings-index.json')
const INDEX_DIR = join(homedir(), '.jarvis')

let oramaInstance: AnyOrama | null = null

export interface IndexedLearning {
  id: string
  type: string
  category?: string
  content: string
  confidence: number
  relevance: number
}

export async function initializeIndex(): Promise<void> {
  // Ensure directory exists
  if (!fs.existsSync(INDEX_DIR)) {
    fs.mkdirSync(INDEX_DIR, { recursive: true })
  }

  // Try to restore from disk
  if (fs.existsSync(INDEX_PATH)) {
    try {
      const serialized = fs.readFileSync(INDEX_PATH, 'utf-8')
      const buffer = Buffer.from(serialized, 'base64')
      oramaInstance = await restore(buffer)
      console.log('[orama] ✓ Index restored from disk')
      return
    } catch (err) {
      console.warn('[orama] Failed to restore index, creating new:', err instanceof Error ? err.message : String(err))
    }
  }

  // Create fresh index
  oramaInstance = await create({
    schema: {
      id: 'string',
      type: 'string',
      category: 'string',
      content: 'string',
      confidence: 'number',
      relevance: 'number',
    },
  })

  console.log('[orama] ✓ New index created')
}

export async function indexLearning(learning: IndexedLearning): Promise<void> {
  if (!oramaInstance) {
    throw new Error('Orama index not initialized. Call initializeIndex() first.')
  }

  await insert(oramaInstance, {
    id: learning.id,
    type: learning.type,
    category: learning.category || '',
    content: learning.content,
    confidence: learning.confidence,
    relevance: learning.relevance,
  })
}

export async function searchSimilar(query: string, limit = 5): Promise<IndexedLearning[]> {
  if (!oramaInstance) {
    return []
  }

  try {
    const results = await search(oramaInstance, {
      term: query,
      limit,
      // Use default search mode (AND for multi-word, ranking by relevance)
    })

    return (results.hits || []).map((hit: any) => ({
      id: hit.id,
      type: hit.type,
      category: hit.category,
      content: hit.content,
      confidence: hit.confidence,
      relevance: hit.relevance,
    }))
  } catch (err) {
    console.warn('[orama] Search failed:', err instanceof Error ? err.message : String(err))
    return []
  }
}

export async function persistIndex(): Promise<void> {
  if (!oramaInstance) return

  try {
    const serialized = await persist(oramaInstance)
    const base64 = serialized.toString('base64')
    fs.writeFileSync(INDEX_PATH, base64, 'utf-8')
    console.log('[orama] ✓ Index persisted to disk')
  } catch (err) {
    console.warn('[orama] Failed to persist index:', err instanceof Error ? err.message : String(err))
  }
}

export function getIndexStats(): { docCount: number; indexed: boolean } {
  return {
    docCount: oramaInstance ? 0 : 0, // Would need to track manually or use internal stats
    indexed: oramaInstance !== null,
  }
}

export async function closeIndex(): Promise<void> {
  // Persist before closing
  await persistIndex()
  oramaInstance = null
  console.log('[orama] ✓ Index closed')
}

// Auto-persist on exit
if (typeof process !== 'undefined') {
  process.on('SIGINT', () => {
    closeIndex()
      .then(() => {
        console.log('[orama] Auto-persisted on SIGINT')
        process.exit(0)
      })
      .catch((err) => {
        console.error('[orama] Error during cleanup:', err)
        process.exit(1)
      })
  })
}
