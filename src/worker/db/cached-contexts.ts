import { getDatabase } from './schema'
import type { Message } from '../session-store'

export interface CachedContext {
  id: string
  user_id: string
  model: string
  system_prompt_hash: string
  messages: Message[]
  last_message: string
  hit_count: number
  created_at: number
  last_used_at: number
}

export function saveCachedContext(context: Omit<CachedContext, 'id' | 'created_at'>): string {
  const db = getDatabase()
  const id = `cache-${context.user_id}-${Date.now()}-${Math.random().toString(36).slice(2)}`
  const now = Date.now()

  db.prepare(
    `INSERT INTO cached_contexts
    (id, user_id, model, system_prompt_hash, messages, last_message, hit_count, created_at, last_used_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(
    id,
    context.user_id,
    context.model,
    context.system_prompt_hash,
    JSON.stringify(context.messages),
    context.last_message,
    context.hit_count || 0,
    now,
    context.last_used_at || now
  )

  return id
}

export function getCachedContextsForUser(userId: string): CachedContext[] {
  const db = getDatabase()
  const rows = db
    .prepare('SELECT * FROM cached_contexts WHERE user_id = ? ORDER BY last_used_at DESC')
    .all(userId) as any[]

  return rows.map((row) => ({
    ...row,
    messages: JSON.parse(row.messages),
  }))
}

export function updateCachedContextStats(id: string, updates: { hit_count?: number; last_used_at?: number }): void {
  const db = getDatabase()
  const setClauses: string[] = []
  const params: any[] = []

  if (updates.hit_count !== undefined) {
    setClauses.push('hit_count = ?')
    params.push(updates.hit_count)
  }

  if (updates.last_used_at !== undefined) {
    setClauses.push('last_used_at = ?')
    params.push(updates.last_used_at)
  }

  if (setClauses.length === 0) return

  params.push(id)
  const query = `UPDATE cached_contexts SET ${setClauses.join(', ')} WHERE id = ?`
  db.prepare(query).run(...params)
}

export function deleteCachedContext(id: string): void {
  const db = getDatabase()
  db.prepare('DELETE FROM cached_contexts WHERE id = ?').run(id)
}

export function deleteOldCachedContexts(maxAge: number = 24 * 60 * 60 * 1000): number {
  const db = getDatabase()
  const cutoff = Date.now() - maxAge
  const result = db.prepare('DELETE FROM cached_contexts WHERE last_used_at < ?').run(cutoff)
  return result.changes
}

export function getCachedContextStats(): {
  total: number
  by_user: Record<string, number>
  total_hits: number
  avg_hits: number
} {
  const db = getDatabase()
  const contexts = db.prepare('SELECT user_id, COUNT(*) as count, SUM(hit_count) as total_hits FROM cached_contexts GROUP BY user_id').all() as any[]

  const byUser: Record<string, number> = {}
  let totalContexts = 0
  let totalHits = 0

  for (const row of contexts) {
    byUser[row.user_id] = row.count
    totalContexts += row.count
    totalHits += row.total_hits || 0
  }

  return {
    total: totalContexts,
    by_user: byUser,
    total_hits: totalHits,
    avg_hits: totalContexts > 0 ? totalHits / totalContexts : 0,
  }
}

export function clearCachedContextsForUser(userId: string): number {
  const db = getDatabase()
  const result = db.prepare('DELETE FROM cached_contexts WHERE user_id = ?').run(userId)
  return result.changes
}
