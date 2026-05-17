/**
 * server — Express HTTP para o JARVIS Worker.
 *
 * Rotas:
 *   GET  /health         → status do worker
 *   POST /api/chat       → enviar mensagem e receber resposta
 *   GET  /api/cost       → custo do dia + estatísticas
 *   GET  /api/keys       → status dos pools de chave
 */

import express, { type Request, type Response, type NextFunction } from 'express'
import type { JarvisWorker } from './worker-core.ts'
import type { MessageDispatcher } from './dispatcher.ts'

export function createServer(
  worker: JarvisWorker,
  dispatcher?: MessageDispatcher
): express.Application {
  const app = express()
  app.use(express.json())

  // ── Health ──────────────────────────────────────────────────────────────────

  app.get('/health', (_req: Request, res: Response) => {
    const stats = worker.getStats()
    res.json({
      status: 'running',
      uptime: stats.uptime,
      version: 'v5.0.0-worker',
      sessions_active: stats.sessionsActive,
      cost_today: round(stats.costToday),
      queries_total: stats.queriesTotal,
      queue_size: 0,
    })
  })

  // ── Chat ────────────────────────────────────────────────────────────────────

  app.post('/api/chat', async (req: Request, res: Response) => {
    const { user, message } = req.body as { user?: string; message?: string }

    if (!user || typeof user !== 'string') {
      res.status(400).json({ error: 'Campo "user" obrigatório (string).' })
      return
    }
    if (!message || typeof message !== 'string' || message.trim() === '') {
      res.status(400).json({ error: 'Campo "message" obrigatório (string não vazia).' })
      return
    }

    try {
      const result = await worker.processPrompt(message.trim(), user)
      res.json({
        session: result.sessionId,
        reply: result.reply,
        cost: round(result.cost),
        model: result.model,
        tokens: result.tokens,
        latency_ms: result.latencyMs,
        category: result.category,
      })
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      res.status(500).json({ error: msg })
    }
  })

  // ── Cost ────────────────────────────────────────────────────────────────────

  app.get('/api/cost', (_req: Request, res: Response) => {
    const stats = worker.getStats()
    res.json({
      cost_today: round(stats.costToday),
      queries_today: stats.queriesTotal,
      sessions_active: stats.sessionsActive,
      pools: stats.pools.map((p) => ({
        name: p.name,
        active_keys: p.activeKeys,
        cooldown_keys: p.cooldownKeys,
        total_keys: p.totalKeys,
      })),
    })
  })

  // ── Keys ────────────────────────────────────────────────────────────────────

  app.get('/api/keys', (_req: Request, res: Response) => {
    const stats = worker.getStats()
    res.json({
      pools: stats.pools,
    })
  })

  // ── WhatsApp ─────────────────────────────────────────────────────────────────

  app.get('/api/whatsapp/status', (_req: Request, res: Response) => {
    if (!dispatcher) {
      res.status(503).json({ error: 'WhatsApp dispatcher not initialized' })
      return
    }

    const stats = dispatcher.getStats()
    res.json({
      active_sessions: stats.activeSessions,
      total_sessions: stats.totalSessions,
      total_messages: stats.totalMessages,
      total_tokens: stats.totalTokens,
      total_cost: round(stats.totalCost),
      timestamp: new Date().toISOString(),
    })
  })

  app.get('/api/whatsapp/qr', (_req: Request, res: Response) => {
    if (!dispatcher) {
      res.status(503).json({ error: 'WhatsApp dispatcher not initialized' })
      return
    }

    // QR code is sent via event listener
    // This endpoint would be used for webhook-based QR fetching
    res.json({
      message: 'QR code is displayed in terminal',
      info: 'Scan the QR code with your WhatsApp mobile device to connect',
    })
  })

  // ── Approval System (Fase 5) ─────────────────────────────────────────────────

  app.post('/api/approve/:id', (req: Request, res: Response) => {
    const { id } = req.params
    const { approver } = req.body as { approver?: string }

    if (!dispatcher?.approvalSystem) {
      res.status(503).json({ error: 'Approval system not initialized' })
      return
    }

    const result = dispatcher.approvalSystem.approve(id, approver || 'api')
    if (result.success) {
      res.json({ success: true, request: result.request })
    } else {
      res.status(400).json({ error: result.error })
    }
  })

  app.post('/api/deny/:id', (req: Request, res: Response) => {
    const { id } = req.params
    const { reason } = req.body as { reason?: string }

    if (!dispatcher?.approvalSystem) {
      res.status(503).json({ error: 'Approval system not initialized' })
      return
    }

    const result = dispatcher.approvalSystem.deny(id, reason || 'Denied via API')
    if (result.success) {
      res.json({ success: true, request: result.request })
    } else {
      res.status(400).json({ error: result.error })
    }
  })

  app.get('/api/approvals/pending', (_req: Request, res: Response) => {
    if (!dispatcher?.approvalSystem) {
      res.status(503).json({ error: 'Approval system not initialized' })
      return
    }

    res.json({
      pending: dispatcher.approvalSystem.getPending(),
      stats: dispatcher.approvalSystem.getStats(),
    })
  })

  // ── Budget Controller (Fase 5) ───────────────────────────────────────────────

  app.get('/api/budget/:userId', (req: Request, res: Response) => {
    const { userId } = req.params

    if (!dispatcher?.budgetController) {
      res.status(503).json({ error: 'Budget controller not initialized' })
      return
    }

    const quota = dispatcher.budgetController.getQuota(userId)
    res.json(quota)
  })

  app.get('/api/budget/all/today', (_req: Request, res: Response) => {
    if (!dispatcher?.budgetController) {
      res.status(503).json({ error: 'Budget controller not initialized' })
      return
    }

    res.json({ quotas: dispatcher.budgetController.getAllQuotas() })
  })

  app.put('/api/budget/:userId/limit', (req: Request, res: Response) => {
    const { userId } = req.params
    const { limit } = req.body as { limit?: number }

    if (!limit || limit < 0) {
      res.status(400).json({ error: 'Invalid limit' })
      return
    }

    if (!dispatcher?.budgetController) {
      res.status(503).json({ error: 'Budget controller not initialized' })
      return
    }

    dispatcher.budgetController.setLimit(userId, limit)
    res.json({ success: true, userId, newLimit: limit })
  })

  // ── Plan Mode (Fase 5) ───────────────────────────────────────────────────────

  app.get('/api/mode', (_req: Request, res: Response) => {
    if (!dispatcher?.planModeManager) {
      res.status(503).json({ error: 'Plan mode not initialized' })
      return
    }

    res.json({
      current: dispatcher.planModeManager.getCurrent(),
      available: dispatcher.planModeManager.list(),
      permissions: dispatcher.planModeManager.getCurrentPermissions(),
    })
  })

  app.put('/api/mode', (req: Request, res: Response) => {
    const { mode } = req.body as { mode?: string }

    if (!mode) {
      res.status(400).json({ error: 'Mode required' })
      return
    }

    if (!dispatcher?.planModeManager) {
      res.status(503).json({ error: 'Plan mode not initialized' })
      return
    }

    const result = dispatcher.planModeManager.activate(mode)
    if ('status' in result) {
      res.json(result)
    } else {
      res.status(400).json(result)
    }
  })

  // ── Cron Scheduler (Fase 6) ─────────────────────────────────────────────────────

  app.get('/api/cron', (_req: Request, res: Response) => {
    if (!dispatcher?.cronScheduler) {
      res.status(503).json({ error: 'Cron scheduler not initialized' })
      return
    }

    const jobs = dispatcher.cronScheduler.list()
    const stats = dispatcher.cronScheduler.getStats()

    res.json({
      jobs: jobs.map((job) => ({
        name: job.name,
        interval: job.intervalMs,
        lastRun: job.lastRun,
        nextRun: job.nextRun,
        status: job.active ? 'active' : 'inactive',
        errorCount: job.errorCount,
        lastError: job.lastError,
      })),
      stats: {
        totalJobs: stats.totalJobs,
        activeJobs: stats.activeJobs,
        totalErrors: stats.totalErrors,
        uptime: stats.uptime,
        lastErrors: stats.lastErrors,
      },
      timestamp: new Date().toISOString(),
    })
  })

  // ── Checkpoints (Fase 5) ─────────────────────────────────────────────────────

  app.get('/api/checkpoints', (_req: Request, res: Response) => {
    if (!dispatcher?.checkpointManager) {
      res.status(503).json({ error: 'Checkpoint manager not initialized' })
      return
    }

    res.json({ checkpoints: dispatcher.checkpointManager.list() })
  })

  app.post('/api/checkpoints', (req: Request, res: Response) => {
    const { name, files } = req.body as { name?: string; files?: Record<string, string> }

    if (!name) {
      res.status(400).json({ error: 'Name required' })
      return
    }

    if (!dispatcher?.checkpointManager) {
      res.status(503).json({ error: 'Checkpoint manager not initialized' })
      return
    }

    dispatcher.checkpointManager.create(name, { files }).then((checkpoint) => {
      res.json({ success: true, checkpoint })
    })
  })

  app.post('/api/checkpoints/:id/restore', (req: Request, res: Response) => {
    const { id } = req.params

    if (!dispatcher?.checkpointManager) {
      res.status(503).json({ error: 'Checkpoint manager not initialized' })
      return
    }

    dispatcher.checkpointManager.restore(id).then((result) => {
      if (result.error) {
        res.status(400).json(result)
      } else {
        res.json(result)
      }
    })
  })

  // Error handler ───────────────────────────────────────────────────────────────

  app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
    console.error('[worker] Erro não tratado:', err.message)
    res.status(500).json({ error: 'Erro interno do servidor.' })
  })

  return app
}

function round(n: number, decimals = 6): number {
  return Math.round(n * 10 ** decimals) / 10 ** decimals
}
