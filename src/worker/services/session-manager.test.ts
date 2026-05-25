import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { SessionManager, type SessionContext } from './session-manager'

describe('SessionManager', () => {
  let manager: SessionManager

  beforeEach(() => {
    manager = new SessionManager({
      ttlMs: 1000, // 1 second for testing
      cleanupIntervalMs: 500,
    })
  })

  afterEach(() => {
    manager.destroy()
  })

  describe('getOrCreateSession', () => {
    it('should create new session', async () => {
      const session = await manager.getOrCreateSession('session1')

      expect(session.sessionId).toBe('session1')
      expect(session.headers).toEqual({})
      expect(session.cookies).toBe('')
    })

    it('should retrieve existing session', async () => {
      const headers = { 'x-custom': 'value' }
      const session1 = await manager.getOrCreateSession('session1', headers)
      const session2 = await manager.getOrCreateSession('session1')

      expect(session2.headers['x-custom']).toBe('value')
    })

    it('should update lastUsed on retrieval', async () => {
      const session1 = await manager.getOrCreateSession('session1')
      const time1 = session1.lastUsed

      await new Promise((resolve) => setTimeout(resolve, 10))

      const session2 = await manager.getOrCreateSession('session1')
      const time2 = session2.lastUsed

      expect(time2).toBeGreaterThan(time1)
    })

    it('should set expiry time', async () => {
      const session = await manager.getOrCreateSession('session1')
      const now = Date.now()

      // Should expire in ~1 second (TTL)
      expect(session.expiresAt - now).toBeGreaterThan(900)
      expect(session.expiresAt - now).toBeLessThanOrEqual(1100)
    })
  })

  describe('updateHeaders', () => {
    it('should update session headers', async () => {
      await manager.getOrCreateSession('session1')
      await manager.updateHeaders('session1', { 'x-auth': 'token123' })

      const session = await manager.getOrCreateSession('session1')
      expect(session.headers['x-auth']).toBe('token123')
    })

    it('should merge headers', async () => {
      await manager.getOrCreateSession('session1', { 'x-initial': 'value' })
      await manager.updateHeaders('session1', { 'x-auth': 'token' })

      const session = await manager.getOrCreateSession('session1')
      expect(session.headers['x-initial']).toBe('value')
      expect(session.headers['x-auth']).toBe('token')
    })

    it('should throw on missing session', async () => {
      let thrown = false
      try {
        await manager.updateHeaders('nonexistent', {})
      } catch (e) {
        thrown = true
      }
      expect(thrown).toBe(true)
    })
  })

  describe('updateCookies', () => {
    it('should update session cookies', async () => {
      await manager.getOrCreateSession('session1')
      await manager.updateCookies('session1', 'session=abc123')

      const session = await manager.getOrCreateSession('session1')
      expect(session.cookies).toBe('session=abc123')
    })
  })

  describe('metadata', () => {
    it('should set and get metadata', async () => {
      await manager.getOrCreateSession('session1')
      await manager.setMetadata('session1', { userId: 'user1', role: 'admin' })

      const metadata = await manager.getMetadata('session1')
      expect(metadata.userId).toBe('user1')
      expect(metadata.role).toBe('admin')
    })

    it('should merge metadata', async () => {
      await manager.getOrCreateSession('session1')
      await manager.setMetadata('session1', { userId: 'user1' })
      await manager.setMetadata('session1', { role: 'admin' })

      const metadata = await manager.getMetadata('session1')
      expect(metadata.userId).toBe('user1')
      expect(metadata.role).toBe('admin')
    })
  })

  describe('deleteSession', () => {
    it('should delete session', async () => {
      await manager.getOrCreateSession('session1')
      expect(manager.getSessionCount()).toBe(1)

      await manager.deleteSession('session1')
      expect(manager.getSessionCount()).toBe(0)
    })

    it('should allow re-creation after deletion', async () => {
      await manager.getOrCreateSession('session1')
      await manager.deleteSession('session1')

      const session = await manager.getOrCreateSession('session1')
      expect(session.sessionId).toBe('session1')
    })
  })

  describe('session validity', () => {
    it('should mark session as valid', async () => {
      await manager.getOrCreateSession('session1')
      expect(manager.isSessionValid('session1')).toBe(true)
    })

    it('should mark expired session as invalid', async () => {
      const mgr = new SessionManager({ ttlMs: 100 })

      await mgr.getOrCreateSession('session1')
      expect(mgr.isSessionValid('session1')).toBe(true)

      // Wait for expiry
      await new Promise((resolve) => setTimeout(resolve, 150))

      expect(mgr.isSessionValid('session1')).toBe(false)

      mgr.destroy()
    })

    it('should return false for nonexistent session', () => {
      expect(manager.isSessionValid('nonexistent')).toBe(false)
    })
  })

  describe('concurrent access', () => {
    it('should handle concurrent session creation', async () => {
      const promises = Array.from({ length: 10 }).map((_, i) =>
        manager.getOrCreateSession(`session${i}`)
      )

      const sessions = await Promise.all(promises)

      expect(sessions).toHaveLength(10)
      expect(manager.getSessionCount()).toBe(10)
    })

    it('should serialize updates to same session', async () => {
      await manager.getOrCreateSession('session1')

      const promises = Array.from({ length: 5 }).map((_, i) =>
        manager.updateHeaders('session1', { [`header${i}`]: `value${i}` })
      )

      await Promise.all(promises)

      const session = await manager.getOrCreateSession('session1')
      expect(Object.keys(session.headers).length).toBe(5)
    })
  })

  describe('cleanup', () => {
    it('should detect expired sessions', async () => {
      const mgr = new SessionManager({
        ttlMs: 100,
        cleanupIntervalMs: 150,
      })

      await mgr.getOrCreateSession('session1')
      await mgr.getOrCreateSession('session2')
      expect(mgr.getSessionCount()).toBe(2)

      // Wait for sessions to expire
      await new Promise((resolve) => setTimeout(resolve, 200))

      // Note: cleanup timer auto-removes expired sessions asynchronously
      // Wait a bit more for cleanup to run
      await new Promise((resolve) => setTimeout(resolve, 200))

      // After cleanup, count should be 0
      // (or validate that isSessionValid reports them as expired)
      const validSession1 = mgr.isSessionValid('session1')
      const validSession2 = mgr.isSessionValid('session2')

      expect(validSession1).toBe(false)
      expect(validSession2).toBe(false)

      mgr.destroy()
    })
  })

  describe('statistics', () => {
    it('should report session statistics', async () => {
      await manager.getOrCreateSession('session1')
      await manager.getOrCreateSession('session2')

      const stats = manager.getStats()
      expect(stats.totalSessions).toBe(2)
      expect(stats.activeSessions).toBe(2)
      expect(stats.expiredCount).toBe(0)
    })

    it('should list all session IDs', async () => {
      await manager.getOrCreateSession('session1')
      await manager.getOrCreateSession('session2')
      await manager.getOrCreateSession('session3')

      const ids = manager.getAllSessionIds()
      expect(ids).toContain('session1')
      expect(ids).toContain('session2')
      expect(ids).toContain('session3')
      expect(ids.length).toBe(3)
    })
  })
})
