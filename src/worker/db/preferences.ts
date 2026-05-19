/**
 * User Preferences Management
 *
 * Tracks user preferences (language, framework, style, etc) observed from
 * interactions and uses them to enhance prompts proactively.
 */

import { getDatabase } from './schema'

export interface UserPreference {
  id: string
  userId: string
  category: string
  value: string
  confidence: number
  observedCount: number
  lastUpdatedAt: number
}

/**
 * Set or update a user preference
 * If preference exists, increments observed_count and updates confidence
 */
export function setUserPreference(
  userId: string,
  category: string,
  value: string,
  confidence: number = 0.5
): void {
  const db = getDatabase()
  const existing = db.prepare(`
    SELECT id, observed_count, confidence
    FROM user_preferences
    WHERE user_id = ? AND category = ? AND value = ?
  `).get(userId, category, value) as any

  if (existing) {
    // Update: increment count, boost confidence
    const newConfidence = Math.min(
      1.0,
      (existing.confidence + confidence) / 2
    )
    const newCount = existing.observed_count + 1

    db.prepare(`
      UPDATE user_preferences
      SET confidence = ?, observed_count = ?, last_updated_at = ?
      WHERE id = ?
    `).run(newConfidence, newCount, Date.now(), existing.id)
  } else {
    // Insert: new preference
    const id = `pref-${userId}-${category}-${Date.now()}`
    db.prepare(`
      INSERT INTO user_preferences
      (id, user_id, category, value, confidence, observed_count, last_updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(id, userId, category, value, confidence, 1, Date.now())
  }
}

/**
 * Get user preferences (optionally filtered by category)
 */
export function getUserPreferences(
  userId: string,
  category?: string
): UserPreference[] {
  const db = getDatabase()

  let query = `
    SELECT id, user_id, category, value, confidence, observed_count, last_updated_at
    FROM user_preferences
    WHERE user_id = ?
  `
  const params: any[] = [userId]

  if (category) {
    query += ` AND category = ?`
    params.push(category)
  }

  query += ` ORDER BY confidence DESC`

  return db.prepare(query).all(...params) as UserPreference[]
}

/**
 * Get top preferences for a category
 */
export function getTopPreferences(
  userId: string,
  category: string,
  limit: number = 5
): UserPreference[] {
  const db = getDatabase()
  return db.prepare(`
    SELECT id, user_id, category, value, confidence, observed_count, last_updated_at
    FROM user_preferences
    WHERE user_id = ? AND category = ?
    ORDER BY confidence DESC
    LIMIT ?
  `).all(userId, category, limit) as UserPreference[]
}

/**
 * Record a preference observation (increment count + boost confidence)
 * Used when preference is explicitly confirmed by user
 */
export function recordPreferenceObservation(
  userId: string,
  category: string,
  value: string,
  confidenceBoost: number = 0.1
): void {
  const db = getDatabase()
  const existing = db.prepare(`
    SELECT id, confidence, observed_count
    FROM user_preferences
    WHERE user_id = ? AND category = ? AND value = ?
  `).get(userId, category, value) as any

  if (existing) {
    const newConfidence = Math.min(
      1.0,
      existing.confidence + confidenceBoost
    )
    const newCount = existing.observed_count + 1

    db.prepare(`
      UPDATE user_preferences
      SET confidence = ?, observed_count = ?, last_updated_at = ?
      WHERE id = ?
    `).run(newConfidence, newCount, Date.now(), existing.id)
  } else {
    // First observation
    setUserPreference(userId, category, value, 0.5)
  }
}

/**
 * Clear preferences for a user (for privacy/reset)
 */
export function clearUserPreferences(userId: string): number {
  const db = getDatabase()
  const result = db.prepare(`
    DELETE FROM user_preferences
    WHERE user_id = ?
  `).run(userId)

  return result.changes
}

/**
 * Get all preferences for auditing/debugging
 */
export function getAllUserPreferences(): UserPreference[] {
  const db = getDatabase()
  return db.prepare(`
    SELECT id, user_id, category, value, confidence, observed_count, last_updated_at
    FROM user_preferences
    ORDER BY user_id, category, confidence DESC
  `).all() as UserPreference[]
}
