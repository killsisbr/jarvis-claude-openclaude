/**
 * BudgetController — Per-user spending limits and quota enforcement.
 *
 * Tracks cost per user per day and prevents execution if limit exceeded.
 * Uses budget_daily table for persistence.
 *
 * Danger levels for actions:
 *   low (0.1)     → free tier queries, read-only ops
 *   medium (1.0)  → moderate processing, analysis
 *   high (10.0)   → file creates, code generation
 *   critical (50) → destructive ops, exec, deploy
 */

import { EventEmitter } from 'events'
import type { Database } from 'bun:sqlite'

export type ActionCategory = 'read' | 'analyze' | 'create' | 'modify' | 'delete' | 'execute'

export type CostMap = Record<ActionCategory, number>

export interface BudgetQuota {
  dailyLimit: number
  spent: number
  remaining: number
  resetAt: number
}

export class BudgetController extends EventEmitter {
  private db: Database
  private readonly DEFAULT_DAILY_LIMIT = 100.0
  private readonly COST_MAP: CostMap = {
    read: 0.1,
    analyze: 1.0,
    create: 10.0,
    modify: 10.0,
    delete: 50.0,
    execute: 50.0,
  }

  constructor(db: Database) {
    super()
    this.db = db
  }

  /**
   * Check if user has budget to execute action.
   * Returns {allowed, remaining, resetAt}.
   */
  canExecute(userId: string, category: ActionCategory): {
    allowed: boolean
    remaining: number
    resetAt: number
  } {
    const cost = this.COST_MAP[category] ?? 1.0
    const quota = this.getQuota(userId)

    const allowed = quota.remaining >= cost
    this.emit('check', {
      userId,
      category,
      cost,
      allowed,
      remaining: quota.remaining,
    })

    return {
      allowed,
      remaining: quota.remaining,
      resetAt: quota.resetAt,
    }
  }

  /**
   * Debit cost from user's daily budget.
   */
  debit(userId: string, cost: number): BudgetQuota {
    const today = this.getDateString()
    const key = `${userId}-${today}`

    const stmt = this.db.prepare(`
      INSERT INTO budget_daily (id, user_phone, date, cost, tokens)
      VALUES (?, ?, ?, ?, 0)
      ON CONFLICT(user_phone, date) DO UPDATE SET cost = cost + ?
    `)

    stmt.run(key, userId, today, cost, cost)

    const quota = this.getQuota(userId)
    this.emit('debited', {
      userId,
      cost,
      remaining: quota.remaining,
      date: today,
    })

    return quota
  }

  /**
   * Get current quota for user.
   */
  getQuota(userId: string): BudgetQuota {
    const today = this.getDateString()
    const limit = this.DEFAULT_DAILY_LIMIT

    const stmt = this.db.prepare(`
      SELECT cost FROM budget_daily
      WHERE user_phone = ? AND date = ?
    `)

    const row = stmt.get(userId, today) as { cost: number } | undefined
    const spent = row?.cost ?? 0
    const remaining = Math.max(0, limit - spent)

    // Reset time: tomorrow at 00:00 local
    const tomorrow = new Date()
    tomorrow.setDate(tomorrow.getDate() + 1)
    tomorrow.setHours(0, 0, 0, 0)
    const resetAt = tomorrow.getTime()

    return { dailyLimit: limit, spent, remaining, resetAt }
  }

  /**
   * Set daily limit for user (admin function).
   */
  setLimit(userId: string, newLimit: number): void {
    if (newLimit < 0) throw new Error('Limit must be non-negative')

    const today = this.getDateString()
    const key = `${userId}-${today}`

    // Store in metadata or separate table (for now, just emit event)
    this.emit('limit_changed', { userId, newLimit, date: today })
  }

  /**
   * Reset budget for user (testing/admin).
   */
  resetBudget(userId: string): void {
    const today = this.getDateString()

    const stmt = this.db.prepare(`
      DELETE FROM budget_daily
      WHERE user_phone = ? AND date = ?
    `)

    stmt.run(userId, today)
    this.emit('budget_reset', { userId, date: today })
  }

  /**
   * Get all users' budgets for today.
   */
  getAllQuotas(): Array<{
    userId: string
    quota: BudgetQuota
  }> {
    const today = this.getDateString()

    const stmt = this.db.prepare(`
      SELECT DISTINCT user_phone FROM budget_daily
      WHERE date = ?
    `)

    const rows = stmt.all(today) as Array<{ user_phone: string }>
    return rows.map((r) => ({
      userId: r.user_phone,
      quota: this.getQuota(r.user_phone),
    }))
  }

  /**
   * Get cost for action category.
   */
  getCost(category: ActionCategory): number {
    return this.COST_MAP[category] ?? 1.0
  }

  private getDateString(): string {
    const now = new Date()
    return now.toISOString().split('T')[0] // YYYY-MM-DD
  }
}
