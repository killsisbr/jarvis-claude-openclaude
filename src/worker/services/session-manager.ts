/**
 * Session Manager — Thread-safe session persistence
 *
 * Manages per-request/per-session contexts with TTL and auto-cleanup
 * Adapted from KimiProxy src/services/playwright.ts
 */

import { Mutex, withLockTimeout } from './mutex'

export interface SessionContext {
  sessionId: string
  headers: Record<string, string>
  cookies: string
  metadata: Record<string, any>
  expiresAt: number
  lastUsed: number
  createdAt: number
}

export interface SessionManagerConfig {
  ttlMs?: number // Time-to-live (default: 30 minutes)
  cleanupIntervalMs?: number // Cleanup check interval (default: 5 minutes)
  lockTimeoutMs?: number // Lock timeout (default: 5 seconds)
}

/**
 * Session Manager — Thread-safe context storage
 */
export class SessionManager {
  private sessions: Map<string, SessionContext> = new Map()
  private sessionMutex = new Mutex()
  private sessionMutexes: Map<string, Mutex> = new Map()
  private ttlMs: number
  private cleanupIntervalMs: number
  private lockTimeoutMs: number
  private cleanupTimer: NodeJS.Timeout | null = null

  constructor(config: SessionManagerConfig = {}) {
    this.ttlMs = config.ttlMs ?? 30 * 60 * 1000 // 30 minutes
    this.cleanupIntervalMs = config.cleanupIntervalMs ?? 5 * 60 * 1000 // 5 minutes
    this.lockTimeoutMs = config.lockTimeoutMs ?? 5000 // 5 seconds

    this.startCleanupTimer()
  }

  /**
   * Get or create a session context
   *
   * @param sessionId - Unique session identifier
   * @param headers - Initial headers (if creating new)
   * @returns Session context
   */
  async getOrCreateSession(
    sessionId: string,
    headers: Record<string, string> = {}
  ): Promise<SessionContext> {
    return withLockTimeout(this.sessionMutex, async () => {
      let session = this.sessions.get(sessionId)

      if (session) {
        // Update last used timestamp
        session.lastUsed = Date.now()
        return session
      }

      // Create new session
      const now = Date.now()
      session = {
        sessionId,
        headers,
        cookies: '',
        metadata: {},
        expiresAt: now + this.ttlMs,
        lastUsed: now,
        createdAt: now,
      }

      this.sessions.set(sessionId, session)
      return session
    }, this.lockTimeoutMs)
  }

  /**
   * Update session headers
   */
  async updateHeaders(
    sessionId: string,
    headers: Record<string, string>
  ): Promise<void> {
    const sessionMutex = this.getOrCreateSessionMutex(sessionId)
    return withLockTimeout(sessionMutex, async () => {
      const session = this.sessions.get(sessionId)
      if (!session) {
        throw new Error(`Session not found: ${sessionId}`)
      }
      session.headers = { ...session.headers, ...headers }
      session.lastUsed = Date.now()
    }, this.lockTimeoutMs)
  }

  /**
   * Update session cookies
   */
  async updateCookies(
    sessionId: string,
    cookies: string
  ): Promise<void> {
    const sessionMutex = this.getOrCreateSessionMutex(sessionId)
    return withLockTimeout(sessionMutex, async () => {
      const session = this.sessions.get(sessionId)
      if (!session) {
        throw new Error(`Session not found: ${sessionId}`)
      }
      session.cookies = cookies
      session.lastUsed = Date.now()
    }, this.lockTimeoutMs)
  }

  /**
   * Get session metadata
   */
  async getMetadata(sessionId: string): Promise<Record<string, any>> {
    const sessionMutex = this.getOrCreateSessionMutex(sessionId)
    return withLockTimeout(sessionMutex, async () => {
      const session = this.sessions.get(sessionId)
      if (!session) {
        throw new Error(`Session not found: ${sessionId}`)
      }
      return session.metadata
    }, this.lockTimeoutMs)
  }

  /**
   * Set session metadata
   */
  async setMetadata(
    sessionId: string,
    metadata: Record<string, any>
  ): Promise<void> {
    const sessionMutex = this.getOrCreateSessionMutex(sessionId)
    return withLockTimeout(sessionMutex, async () => {
      const session = this.sessions.get(sessionId)
      if (!session) {
        throw new Error(`Session not found: ${sessionId}`)
      }
      session.metadata = { ...session.metadata, ...metadata }
      session.lastUsed = Date.now()
    }, this.lockTimeoutMs)
  }

  /**
   * Delete session
   */
  async deleteSession(sessionId: string): Promise<void> {
    return withLockTimeout(this.sessionMutex, async () => {
      this.sessions.delete(sessionId)
      this.sessionMutexes.delete(sessionId)
    }, this.lockTimeoutMs)
  }

  /**
   * Get session count
   */
  getSessionCount(): number {
    return this.sessions.size
  }

  /**
   * Get all session IDs
   */
  getAllSessionIds(): string[] {
    return Array.from(this.sessions.keys())
  }

  /**
   * Check if session exists and is valid
   */
  isSessionValid(sessionId: string): boolean {
    const session = this.sessions.get(sessionId)
    if (!session) return false
    return Date.now() < session.expiresAt
  }

  /**
   * Get or create mutex for session
   */
  private getOrCreateSessionMutex(sessionId: string): Mutex {
    let mutex = this.sessionMutexes.get(sessionId)
    if (!mutex) {
      mutex = new Mutex()
      this.sessionMutexes.set(sessionId, mutex)
    }
    return mutex
  }

  /**
   * Start periodic cleanup of expired sessions
   */
  private startCleanupTimer(): void {
    this.cleanupTimer = setInterval(() => {
      this.cleanupExpiredSessions()
    }, this.cleanupIntervalMs)

    // Allow timer to be garbage collected
    if (this.cleanupTimer.unref) {
      this.cleanupTimer.unref()
    }
  }

  /**
   * Cleanup expired sessions
   */
  private async cleanupExpiredSessions(): Promise<void> {
    try {
      await withLockTimeout(this.sessionMutex, async () => {
        const now = Date.now()
        const expired: string[] = []

        for (const [sessionId, session] of this.sessions) {
          if (now > session.expiresAt) {
            expired.push(sessionId)
          }
        }

        for (const sessionId of expired) {
          this.sessions.delete(sessionId)
          this.sessionMutexes.delete(sessionId)
        }

        if (expired.length > 0) {
          // Silently log if DEBUG_SESSIONS is set
          if (process.env.DEBUG_SESSIONS) {
            console.log(`[SessionManager] Cleaned up ${expired.length} expired sessions`)
          }
        }
      }, this.lockTimeoutMs)
    } catch (error) {
      // Ignore cleanup errors (likely timeout)
      if (process.env.DEBUG_SESSIONS) {
        console.error('[SessionManager] Cleanup error:', error)
      }
    }
  }

  /**
   * Stop cleanup timer and clear all sessions
   */
  destroy(): void {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer)
      this.cleanupTimer = null
    }
    this.sessions.clear()
    this.sessionMutexes.clear()
  }

  /**
   * Get statistics
   */
  getStats(): {
    totalSessions: number
    activeSessions: number
    expiredCount: number
  } {
    const now = Date.now()
    let activeSessions = 0
    let expiredCount = 0

    for (const session of this.sessions.values()) {
      if (now < session.expiresAt) {
        activeSessions++
      } else {
        expiredCount++
      }
    }

    return {
      totalSessions: this.sessions.size,
      activeSessions,
      expiredCount,
    }
  }
}

/**
 * Global session manager instance
 */
let globalSessionManager: SessionManager | null = null

/**
 * Get or create global session manager
 */
export function getGlobalSessionManager(
  config?: SessionManagerConfig
): SessionManager {
  if (!globalSessionManager) {
    globalSessionManager = new SessionManager(config)
  }
  return globalSessionManager
}
