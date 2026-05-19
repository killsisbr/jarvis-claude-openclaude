import { getDatabase } from './schema'

export interface UserPreference {
  id: string
  user_id: string
  category: string
  value: string
  confidence: number
  observed_count: number
  last_updated_at: number
}

export function setUserPreference(
  userId: string,
  category: string,
  value: string,
  confidence: number = 0.5
): void {
  const db = getDatabase()
  const id = `pref-${userId}-${category}-${value.replace(/\s+/g, '-')}`
  const now = Date.now()

  const existing = db
    .prepare('SELECT * FROM user_preferences WHERE user_id = ? AND category = ? AND value = ?')
    .get(userId, category, value) as UserPreference | undefined

  if (existing) {
    // Atualizar: aumentar confidence e observed_count
    const newConfidence = Math.min(1, (existing.confidence + confidence) / 2)
    db.prepare(
      'UPDATE user_preferences SET confidence = ?, observed_count = observed_count + 1, last_updated_at = ? WHERE id = ?'
    ).run(newConfidence, now, existing.id)
  } else {
    // Inserir novo
    db.prepare(
      'INSERT INTO user_preferences (id, user_id, category, value, confidence, observed_count, last_updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)'
    ).run(id, userId, category, value, confidence, 1, now)
  }
}

export function getUserPreferences(userId: string, category?: string): UserPreference[] {
  const db = getDatabase()

  let query = 'SELECT * FROM user_preferences WHERE user_id = ?'
  const params: any[] = [userId]

  if (category) {
    query += ' AND category = ?'
    params.push(category)
  }

  query += ' ORDER BY confidence DESC, observed_count DESC'

  return db.prepare(query).all(...params) as UserPreference[]
}

export function getHighConfidencePreferences(userId: string, minConfidence: number = 0.7): UserPreference[] {
  const db = getDatabase()
  return db
    .prepare(
      'SELECT * FROM user_preferences WHERE user_id = ? AND confidence >= ? ORDER BY confidence DESC, observed_count DESC'
    )
    .all(userId, minConfidence) as UserPreference[]
}

export function recordPreferenceObservation(
  userId: string,
  category: string,
  value: string,
  confidenceBoost: number = 0.1
): void {
  const existing = getUserPreferences(userId, category).find((p) => p.value === value)

  if (existing) {
    const db = getDatabase()
    const newConfidence = Math.min(1, existing.confidence + confidenceBoost)
    db.prepare('UPDATE user_preferences SET confidence = ?, observed_count = observed_count + 1, last_updated_at = ? WHERE id = ?').run(
      newConfidence,
      Date.now(),
      existing.id
    )
  } else {
    setUserPreference(userId, category, value, 0.6)
  }
}

export function deletePreference(id: string): void {
  const db = getDatabase()
  db.prepare('DELETE FROM user_preferences WHERE id = ?').run(id)
}

export function clearUserPreferences(userId: string): void {
  const db = getDatabase()
  db.prepare('DELETE FROM user_preferences WHERE user_id = ?').run(userId)
}

export function getPreferenceStats(userId: string): {
  total: number
  byCategory: Record<string, number>
  avgConfidence: number
} {
  const prefs = getUserPreferences(userId)

  const byCategory: Record<string, number> = {}
  let totalConfidence = 0

  for (const pref of prefs) {
    byCategory[pref.category] = (byCategory[pref.category] || 0) + 1
    totalConfidence += pref.confidence
  }

  return {
    total: prefs.length,
    byCategory,
    avgConfidence: prefs.length > 0 ? totalConfidence / prefs.length : 0,
  }
}
