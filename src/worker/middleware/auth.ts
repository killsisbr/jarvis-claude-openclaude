/**
 * Authentication middleware for JARVIS Worker API.
 * Validates API keys from Authorization header.
 */

import { getDatabase } from '../db/schema'

export interface AuthRequest {
  userId?: string
  username?: string
  isAdmin?: boolean
}

/**
 * Middleware: Require valid API key in Authorization header.
 * Sets req.userId, req.username, req.isAdmin if valid.
 */
export function requireAuth(req: any, res: any, next: any) {
  const authHeader = req.headers['authorization']

  if (!authHeader) {
    return res.status(401).json({ error: 'Missing Authorization header' })
  }

  const apiKey = authHeader.replace('Bearer ', '').trim()

  if (!apiKey) {
    return res.status(401).json({ error: 'Invalid Authorization format. Use: Bearer sk-...' })
  }

  try {
    const db = getDatabase()
    const user = db.prepare(`
      SELECT id, username, is_admin, is_active
      FROM api_users
      WHERE api_key = ? AND is_active = 1
    `).get(apiKey) as any

    if (!user) {
      return res.status(401).json({ error: 'Invalid or inactive API key' })
    }

    // Update last_used_at
    db.prepare(`
      UPDATE api_users
      SET last_used_at = ?
      WHERE id = ?
    `).run(Date.now(), user.id)

    // Attach user info to request
    req.userId = user.id
    req.username = user.username
    req.isAdmin = user.is_admin === 1

    next()
  } catch (err) {
    console.error('[auth] Error validating API key:', err)
    return res.status(500).json({ error: 'Authentication error' })
  }
}

/**
 * Middleware: Require admin privileges.
 * Must be used after requireAuth.
 */
export function requireAdmin(req: any, res: any, next: any) {
  if (!req.isAdmin) {
    return res.status(403).json({ error: 'Admin privileges required' })
  }
  next()
}

/**
 * Create a new API key for a user.
 * Returns the full key (only shown once).
 */
export function generateApiKey(username: string, isAdmin: boolean = false): string {
  const db = getDatabase()
  const userId = `user-${Date.now()}-${Math.random().toString(36).substring(7)}`
  const randomBytes = crypto.getRandomValues(new Uint8Array(16))
  const randomHex = Array.from(randomBytes).map(b => b.toString(16).padStart(2, '0')).join('')
  const apiKey = `sk-${username}-${Date.now()}-${randomHex}`

  db.prepare(`
    INSERT INTO api_users (id, username, api_key, is_admin, created_at)
    VALUES (?, ?, ?, ?, ?)
  `).run(userId, username, apiKey, isAdmin ? 1 : 0, Date.now())

  return apiKey
}

/**
 * Revoke an API key.
 */
export function revokeApiKey(apiKey: string): boolean {
  const db = getDatabase()
  const result = db.prepare(`
    UPDATE api_users
    SET is_active = 0
    WHERE api_key = ?
  `).run(apiKey)

  return result.changes > 0
}

/**
 * List all API users (admin only).
 */
export function listApiUsers() {
  const db = getDatabase()
  return db.prepare(`
    SELECT id, username, is_admin, created_at, last_used_at, is_active
    FROM api_users
    ORDER BY created_at DESC
  `).all()
}
