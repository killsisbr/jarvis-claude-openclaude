/**
 * ApprovalSystem — Human-in-the-loop gates for dangerous operations.
 *
 * Danger levels:
 *   low/medium    → automatic approval
 *   high/critical → require explicit Y/n approval (5min timeout)
 *
 * Ported from JARVIS 5.0 approval-system.js.
 * Persists to SQLite + in-memory pending queue.
 */

import { EventEmitter } from 'events'
import type { Database } from 'bun:sqlite'

export type DangerLevel = 'low' | 'medium' | 'high' | 'critical'
export type ApprovalStatus = 'pending' | 'approved' | 'denied'

export interface ApprovalRequest {
  id: string
  action: string
  params: Record<string, unknown>
  dangerLevel: DangerLevel
  description: string
  status: ApprovalStatus
  createdAt: string
  expiresAt: string
  approvedAt?: string
  deniedAt?: string
  approver?: string
  denyReason?: string
}

export class ApprovalSystem extends EventEmitter {
  private db: Database
  private pending: Map<string, ApprovalRequest> = new Map()
  private readonly MAX_HISTORY = 100
  private readonly DEFAULT_TIMEOUT_MS = 300000 // 5 minutes

  static readonly DANGER_LEVELS: Record<
    DangerLevel,
    { requiresApproval: boolean; color: string }
  > = {
    low: { requiresApproval: false, color: 'green' },
    medium: { requiresApproval: false, color: 'yellow' },
    high: { requiresApproval: true, color: 'orange' },
    critical: { requiresApproval: true, color: 'red' },
  }

  constructor(db: Database) {
    super()
    this.db = db
    this.loadPendingFromDb()
  }

  /**
   * Create approval request for action.
   * Returns request object.
   */
  createRequest(
    actionName: string,
    params: Record<string, unknown>,
    dangerLevel: DangerLevel = 'medium',
    description = ''
  ): ApprovalRequest {
    const id = `APR_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`

    const now = new Date()
    const expiresAt = new Date(now.getTime() + this.DEFAULT_TIMEOUT_MS)

    const request: ApprovalRequest = {
      id,
      action: actionName,
      params: this.sanitizeParams(params),
      dangerLevel,
      description,
      status: 'pending',
      createdAt: now.toISOString(),
      expiresAt: expiresAt.toISOString(),
    }

    this.pending.set(id, request)

    // Persist to DB
    const stmt = this.db.prepare(`
      INSERT INTO approval_requests
      (id, userId, action, params, dangerLevel, status, createdAt, expiresAt)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `)
    stmt.run(
      id,
      'system', // userId placeholder
      actionName,
      JSON.stringify(request.params),
      dangerLevel,
      'pending',
      now.getTime(),
      expiresAt.getTime()
    )

    this.emit('requested', request)
    console.log(`[ApprovalSystem] Request created: ${actionName} (${dangerLevel}) - ID: ${id}`)

    return request
  }

  /**
   * Approve request.
   */
  approve(id: string, approver = 'system'): { success: boolean; request?: ApprovalRequest; error?: string } {
    const request = this.pending.get(id)
    if (!request) {
      return { success: false, error: 'Request not found' }
    }

    if (request.status !== 'pending') {
      return { success: false, error: `Already ${request.status}` }
    }

    const now = new Date()
    request.status = 'approved'
    request.approvedAt = now.toISOString()
    request.approver = approver

    this.pending.delete(id)

    // Update DB
    const stmt = this.db.prepare(`
      UPDATE approval_requests
      SET status = ?, respondedAt = ?, respondedBy = ?
      WHERE id = ?
    `)
    stmt.run('approved', now.getTime(), approver, id)

    this.emit('approved', request)
    console.log(`[ApprovalSystem] Approved: ${request.action}`)

    return { success: true, request }
  }

  /**
   * Deny request.
   */
  deny(id: string, reason = 'Denied by user'): { success: boolean; request?: ApprovalRequest; error?: string } {
    const request = this.pending.get(id)
    if (!request) {
      return { success: false, error: 'Request not found' }
    }

    const now = new Date()
    request.status = 'denied'
    request.deniedAt = now.toISOString()
    request.denyReason = reason

    this.pending.delete(id)

    // Update DB
    const stmt = this.db.prepare(`
      UPDATE approval_requests
      SET status = ?, respondedAt = ?, responseReason = ?
      WHERE id = ?
    `)
    stmt.run('denied', now.getTime(), reason, id)

    this.emit('denied', request)
    console.log(`[ApprovalSystem] Denied: ${request.action} - ${reason}`)

    return { success: true, request }
  }

  /**
   * Wait for approval with timeout.
   * Returns {approved, reason?}.
   */
  waitForApproval(id: string, timeoutMs?: number): Promise<{ approved: boolean; reason?: string }> {
    return new Promise((resolve) => {
      const request = this.pending.get(id)
      if (!request || request.status !== 'pending') {
        resolve({ approved: request?.status === 'approved', reason: 'not_found' })
        return
      }

      const timeout = setTimeout(() => {
        this.events.off('approved', onApproved)
        this.events.off('denied', onDenied)
        this.deny(id, 'Timeout')
        resolve({ approved: false, reason: 'timeout' })
      }, timeoutMs || this.DEFAULT_TIMEOUT_MS)

      const onApproved = (req: ApprovalRequest) => {
        if (req.id === id) {
          clearTimeout(timeout)
          this.events.off('approved', onApproved)
          this.events.off('denied', onDenied)
          resolve({ approved: true })
        }
      }

      const onDenied = (req: ApprovalRequest) => {
        if (req.id === id) {
          clearTimeout(timeout)
          this.events.off('approved', onApproved)
          this.events.off('denied', onDenied)
          resolve({ approved: false, reason: req.denyReason || 'denied' })
        }
      }

      this.events.on('approved', onApproved)
      this.events.on('denied', onDenied)
    })
  }

  /**
   * Check if danger level requires approval.
   */
  checkApprovalRequired(dangerLevel: DangerLevel): boolean {
    const level = ApprovalSystem.DANGER_LEVELS[dangerLevel] || ApprovalSystem.DANGER_LEVELS.medium
    return level.requiresApproval
  }

  /**
   * Get pending requests.
   */
  getPending(): ApprovalRequest[] {
    return Array.from(this.pending.values())
  }

  /**
   * Get approval history.
   */
  getHistory(limit = 20): ApprovalRequest[] {
    const stmt = this.db.prepare(`
      SELECT id, userId, action, params, dangerLevel, status,
             createdAt, respondedAt, respondedBy, responseReason
      FROM approval_requests
      WHERE status != 'pending'
      ORDER BY respondedAt DESC
      LIMIT ?
    `)

    const rows = stmt.all(limit) as Array<{
      id: string
      action: string
      params: string
      dangerLevel: DangerLevel
      status: ApprovalStatus
      createdAt: number
      respondedAt?: number
      respondedBy?: string
      responseReason?: string
    }>

    return rows.map((r) => ({
      id: r.id,
      action: r.action,
      params: JSON.parse(r.params),
      dangerLevel: r.dangerLevel,
      status: r.status,
      createdAt: new Date(r.createdAt).toISOString(),
      expiresAt: '', // Not stored
      respondedAt: r.respondedAt ? new Date(r.respondedAt).toISOString() : undefined,
      approver: r.respondedBy,
      denyReason: r.responseReason,
    }))
  }

  /**
   * Get stats.
   */
  getStats(): {
    total: number
    approved: number
    denied: number
    pending: number
  } {
    const stmt = this.db.prepare(`
      SELECT status, COUNT(*) as count FROM approval_requests
      GROUP BY status
    `)

    const rows = stmt.all() as Array<{ status: string; count: number }>
    const counts = Object.fromEntries(rows.map((r) => [r.status, r.count]))

    return {
      total: (counts['approved'] ?? 0) + (counts['denied'] ?? 0),
      approved: counts['approved'] ?? 0,
      denied: counts['denied'] ?? 0,
      pending: counts['pending'] ?? 0,
    }
  }

  /**
   * Cleanup expired requests.
   */
  cleanupExpired(): number {
    const now = Date.now()
    let cleaned = 0

    for (const [id, req] of this.pending) {
      if (new Date(req.expiresAt).getTime() < now) {
        this.deny(id, 'Expired')
        cleaned++
      }
    }

    return cleaned
  }

  /**
   * Sanitize sensitive parameters.
   */
  private sanitizeParams(params: Record<string, unknown>): Record<string, unknown> {
    if (!params) return {}
    const sensitive = ['token', 'password', 'secret', 'apiKey', 'key', 'auth']
    const sanitized: Record<string, unknown> = {}

    for (const [k, v] of Object.entries(params)) {
      sanitized[k] = sensitive.some((s) => k.toLowerCase().includes(s)) ? '***' : v
    }

    return sanitized
  }

  /**
   * Load pending requests from DB on startup.
   */
  private loadPendingFromDb(): void {
    const stmt = this.db.prepare(`
      SELECT id, userId, action, params, dangerLevel, status,
             createdAt, expiresAt
      FROM approval_requests
      WHERE status = 'pending' AND expiresAt > ?
    `)

    const rows = stmt.all(Date.now()) as Array<{
      id: string
      action: string
      params: string
      dangerLevel: DangerLevel
      status: ApprovalStatus
      createdAt: number
      expiresAt: number
    }>

    for (const r of rows) {
      this.pending.set(r.id, {
        id: r.id,
        action: r.action,
        params: JSON.parse(r.params),
        dangerLevel: r.dangerLevel,
        status: r.status,
        createdAt: new Date(r.createdAt).toISOString(),
        expiresAt: new Date(r.expiresAt).toISOString(),
      })
    }

    console.log(`[ApprovalSystem] Loaded ${rows.length} pending requests from DB`)
  }
}
