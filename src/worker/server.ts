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

export function createServer(worker: JarvisWorker): express.Application {
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

  // ── Error handler ───────────────────────────────────────────────────────────

  app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
    console.error('[worker] Erro não tratado:', err.message)
    res.status(500).json({ error: 'Erro interno do servidor.' })
  })

  return app
}

function round(n: number, decimals = 6): number {
  return Math.round(n * 10 ** decimals) / 10 ** decimals
}
