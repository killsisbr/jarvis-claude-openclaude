import { describe, it, expect, beforeEach, afterEach } from 'bun:test'
import { generateApiKey, revokeApiKey, listApiUsers } from './auth'
import { getDatabase, closeDatabase } from '../db/schema'

describe('auth middleware', () => {
  beforeEach(() => {
    getDatabase()
  })

  afterEach(() => {
    closeDatabase()
  })

  it('generates valid API key format', () => {
    const key = generateApiKey('testuser')
    expect(key).toMatch(/^sk-testuser-\d+-[0-9a-f]+$/)
  })

  it('generates different keys for same username', () => {
    const key1 = generateApiKey('user1')
    const key2 = generateApiKey('user1')
    expect(key1).not.toBe(key2)
  })

  it('creates API user in database', () => {
    const key = generateApiKey('dbuser', false)
    const db = getDatabase()
    const user = db.prepare('SELECT * FROM api_users WHERE api_key = ?').get(key) as any

    expect(user).toBeDefined()
    expect(user.username).toBe('dbuser')
    expect(user.is_admin).toBe(0)
    expect(user.is_active).toBe(1)
  })

  it('creates admin user when flag is true', () => {
    const key = generateApiKey('adminuser', true)
    const db = getDatabase()
    const user = db.prepare('SELECT * FROM api_users WHERE api_key = ?').get(key) as any

    expect(user.is_admin).toBe(1)
  })

  it('revokes API key', () => {
    const key = generateApiKey('revokeuser')
    const db = getDatabase()

    // Key should be active initially
    let user = db.prepare('SELECT * FROM api_users WHERE api_key = ?').get(key) as any
    expect(user.is_active).toBe(1)

    // Revoke it
    const revoked = revokeApiKey(key)
    expect(revoked).toBe(true)

    // Key should be inactive now
    user = db.prepare('SELECT * FROM api_users WHERE api_key = ?').get(key) as any
    expect(user.is_active).toBe(0)
  })

  it('revoke returns false for non-existent key', () => {
    const revoked = revokeApiKey('sk-nonexistent-123-abc')
    expect(revoked).toBe(false)
  })

  it('lists all API users', () => {
    generateApiKey('user1')
    generateApiKey('user2')
    generateApiKey('user3', true)

    const users = listApiUsers() as any[]
    expect(users.length).toBeGreaterThanOrEqual(3)
    expect(users.some(u => u.username === 'user1')).toBe(true)
    expect(users.some(u => u.username === 'user2')).toBe(true)
    expect(users.some(u => u.username === 'user3' && u.is_admin === 1)).toBe(true)
  })

  it('updates last_used_at timestamp', () => {
    const key = generateApiKey('timestampuser')
    const db = getDatabase()

    const before = db.prepare('SELECT last_used_at FROM api_users WHERE api_key = ?').get(key) as any
    expect(before.last_used_at).toBeNull()

    // Simulate auth middleware updating timestamp
    const now = Date.now()
    const user = db.prepare('SELECT id FROM api_users WHERE api_key = ?').get(key) as any
    db.prepare('UPDATE api_users SET last_used_at = ? WHERE id = ?').run(now, user.id)

    const after = db.prepare('SELECT last_used_at FROM api_users WHERE api_key = ?').get(key) as any
    expect(after.last_used_at).toBeGreaterThan(0)
  })

  it('maintains unique API keys', () => {
    const key = generateApiKey('uniqueuser')

    try {
      // Try to insert duplicate key directly (this should fail)
      const db = getDatabase()
      db.prepare(`
        INSERT INTO api_users (id, username, api_key, is_admin, created_at)
        VALUES (?, ?, ?, ?, ?)
      `).run(`dup-user-${Date.now()}`, 'anotheruser', key, 0, Date.now())

      expect.unreachable()
    } catch (err: any) {
      expect(err.message).toContain('UNIQUE')
    }
  })
})
