/**
 * Schema extractor — analyzes code and database to extract API/data structure docs.
 *
 * Extracts:
 * - API endpoints (method, path, params, description)
 * - Database schemas (tables, fields, types)
 * - Integrations (WhatsApp, Approval, Budget, etc)
 * - Key metrics and configurations
 */

import { getDatabase } from '../db/schema'
import type { Learning } from '../db/learnings'

export interface APIEndpoint {
  method: 'GET' | 'POST' | 'PUT' | 'DELETE'
  path: string
  description: string
  params?: string[]
  example?: string
  phase: string // Fase number
}

export interface DataModel {
  name: string
  fields: Array<{ name: string; type: string; description: string }>
  indexes: string[]
}

export interface IntegrationInfo {
  name: string
  status: 'active' | 'planned'
  description: string
}

/**
 * Extract all API endpoints from the server.
 * Note: This is a hardcoded mapping based on current server.ts structure.
 * In a real implementation, you'd parse the Express app dynamically.
 */
export function extractAPIEndpoints(): APIEndpoint[] {
  return [
    // Health & Status
    {
      method: 'GET',
      path: '/health',
      description: 'Server health check',
      phase: '1',
      example: 'curl http://localhost:3001/health',
    },
    {
      method: 'GET',
      path: '/api/cost',
      description: 'Daily cost and statistics',
      phase: '1',
      example: 'curl http://localhost:3001/api/cost',
    },
    {
      method: 'GET',
      path: '/api/keys',
      description: 'Provider key pool status',
      phase: '1',
      example: 'curl http://localhost:3001/api/keys',
    },

    // Chat
    {
      method: 'POST',
      path: '/api/chat',
      description: 'Process user message and get response',
      params: ['user', 'message'],
      phase: '1',
      example: 'curl -X POST http://localhost:3001/api/chat -d \'{"user":"uid","message":"..."}\'',
    },

    // Approval (Fase 5)
    {
      method: 'GET',
      path: '/api/approvals/pending',
      description: 'List pending approval requests',
      phase: '5',
      example: 'curl http://localhost:3001/api/approvals/pending',
    },
    {
      method: 'POST',
      path: '/api/approve/:id',
      description: 'Approve a request',
      params: ['id', 'approver'],
      phase: '5',
    },
    {
      method: 'POST',
      path: '/api/deny/:id',
      description: 'Deny a request',
      params: ['id', 'reason'],
      phase: '5',
    },

    // Budget (Fase 5)
    {
      method: 'GET',
      path: '/api/budget/:userId',
      description: 'Get user daily budget quota',
      params: ['userId'],
      phase: '5',
    },
    {
      method: 'GET',
      path: '/api/budget/all/today',
      description: 'Get all users daily budget',
      phase: '5',
    },
    {
      method: 'PUT',
      path: '/api/budget/:userId/limit',
      description: 'Set user budget limit',
      params: ['userId', 'limit'],
      phase: '5',
    },

    // Plan Mode (Fase 5)
    {
      method: 'GET',
      path: '/api/mode',
      description: 'Get current plan mode and permissions',
      phase: '5',
      example: 'curl http://localhost:3001/api/mode',
    },
    {
      method: 'PUT',
      path: '/api/mode',
      description: 'Change plan mode (dev/audit/operate/execute)',
      params: ['mode'],
      phase: '5',
    },

    // Cron Scheduler (Fase 6)
    {
      method: 'GET',
      path: '/api/cron',
      description: 'List background jobs and their status',
      phase: '6',
      example: 'curl http://localhost:3001/api/cron',
    },

    // Sandbox (Fase 7)
    {
      method: 'POST',
      path: '/api/exec',
      description: 'Execute command in isolated sandbox ($50 per exec)',
      params: ['cmd', 'cwd', 'timeout', 'userId'],
      phase: '7',
    },

    // Skills (Fase 7)
    {
      method: 'GET',
      path: '/api/skills',
      description: 'List available skills',
      phase: '7',
      example: 'curl http://localhost:3001/api/skills',
    },
    {
      method: 'POST',
      path: '/api/skills/:name/execute',
      description: 'Execute a skill',
      params: ['name', 'payload'],
      phase: '7',
    },

    // Learnings (Fase 8)
    {
      method: 'GET',
      path: '/api/learnings/stats',
      description: 'Learning system statistics (DB + cache + vector index)',
      phase: '8.1',
      example: 'curl http://localhost:3001/api/learnings/stats',
    },
    {
      method: 'GET',
      path: '/api/learnings/review-due/:userId',
      description: 'Get learnings due for spaced repetition review',
      params: ['userId', 'limit'],
      phase: '8.1',
    },

    // Documentation (Fase 8.3)
    {
      method: 'GET',
      path: '/api/docs',
      description: 'Get current CLAUDE.md documentation',
      phase: '8.3',
    },
    {
      method: 'POST',
      path: '/api/docs/generate',
      description: 'Regenerate CLAUDE.md from current code state',
      phase: '8.3',
    },
  ]
}

/**
 * Extract database schema information.
 */
export function extractDataModels(): DataModel[] {
  const db = getDatabase()

  // Get all table names
  const tables = db
    .prepare("SELECT name FROM sqlite_master WHERE type='table'")
    .all() as Array<{ name: string }>

  return tables.map((t) => {
    const fields = db
      .prepare(`PRAGMA table_info(${t.name})`)
      .all() as Array<{
      cid: number
      name: string
      type: string
      notnull: number
      dflt_value: any
      pk: number
    }>

    const indexes = db
      .prepare(`PRAGMA index_list(${t.name})`)
      .all() as Array<{ name: string }>

    return {
      name: t.name,
      fields: fields.map((f) => ({
        name: f.name,
        type: f.type,
        description: `${f.pk ? '[PK] ' : ''}${f.notnull ? 'required' : 'optional'}`,
      })),
      indexes: indexes.map((i) => i.name),
    }
  })
}

/**
 * Get system integrations status.
 */
export function extractIntegrations(): IntegrationInfo[] {
  return [
    {
      name: 'WhatsApp (Baileys)',
      status: 'active',
      description: 'WhatsApp gateway via Baileys for messaging integration',
    },
    {
      name: 'Approval System',
      status: 'active',
      description: 'Request approval workflow with danger levels',
    },
    {
      name: 'Budget Controller',
      status: 'active',
      description: 'Per-user daily spending limits and tracking',
    },
    {
      name: 'Plan Mode',
      status: 'active',
      description: '4-level execution mode (dev/audit/operate/execute)',
    },
    {
      name: 'Checkpoint Manager',
      status: 'active',
      description: 'State snapshots and rollback capability',
    },
    {
      name: 'Cron Scheduler',
      status: 'active',
      description: 'Background jobs with monitoring',
    },
    {
      name: 'Sentinels',
      status: 'active',
      description: '24/7 monitoring (cost, keys, sessions, DB, errors)',
    },
    {
      name: 'Event Bus',
      status: 'active',
      description: 'Pub/sub for inter-system communication',
    },
    {
      name: 'Sandbox Manager',
      status: 'active',
      description: 'Isolated code execution (512MB, 0.5 CPU, 30s)',
    },
    {
      name: 'Skill Registry',
      status: 'active',
      description: 'Plugin system with 5 lifecycle hooks',
    },
    {
      name: 'Learning System',
      status: 'active',
      description: 'Spaced repetition + vector search + auto-indexing',
    },
    {
      name: 'CLI Tools',
      status: 'planned',
      description: 'Hot-reload skills, generate docs, etc',
    },
  ]
}

/**
 * Get key metrics and configurations.
 */
export function extractMetrics() {
  const db = getDatabase()

  const sessionCount = db.prepare('SELECT COUNT(*) as count FROM sessions').get() as { count: number }
  const messageCount = db.prepare('SELECT COUNT(*) as count FROM messages').get() as { count: number }

  return {
    database: {
      sessionCount: sessionCount.count,
      messageCount: messageCount.count,
      path: '~/.jarvis/worker.db',
    },
    vectorIndex: {
      path: '~/.jarvis/learnings-index.json',
      maxSize: '<10MB',
      searchLatency: '<50ms',
    },
    performance: {
      dockerBuild: '~90s (cached)',
      containerStartup: '8-10s',
      healthCheck: '<50ms',
      chatLatency: '500-2000ms',
      sandboxExec: '200-500ms',
      skillLoad: '<500ms',
    },
    limits: {
      maxTokens: 2048,
      maxLearningsPerQuery: 4,
      sandboxMemory: '512MB',
      sandboxCPU: '0.5',
      sandboxTimeout: '30s',
      cacheTTL: '5min',
    },
  }
}
