import { getDatabase } from './schema'

export interface RoutingMetric {
  id: string
  model: string
  intent: string
  latency_p50: number | null
  latency_p95: number | null
  latency_p99: number | null
  cost_avg: number | null
  success_rate: number | null
  sample_count: number
  recorded_at: number
}

export interface WeightSnapshot {
  id: string
  timestamp: number
  weights: Record<string, Record<string, number>>
  source: 'auto-evolve' | 'manual' | 'initial'
  canary_improvement: number | null
  applied_at: number | null
}

export function recordRoutingMetric(
  model: string,
  intent: string,
  latencies: number[],
  costs: number[],
  successCount: number,
  totalCount: number
): void {
  const db = getDatabase()
  const id = `metric-${model}-${intent}-${Date.now()}`
  const now = Date.now()

  // Calcular percentis
  const sortedLatencies = [...latencies].sort((a, b) => a - b)
  const latency_p50 = sortedLatencies[Math.floor(sortedLatencies.length * 0.5)] || null
  const latency_p95 = sortedLatencies[Math.floor(sortedLatencies.length * 0.95)] || null
  const latency_p99 = sortedLatencies[Math.floor(sortedLatencies.length * 0.99)] || null

  const cost_avg = costs.length > 0 ? costs.reduce((a, b) => a + b, 0) / costs.length : null
  const success_rate = totalCount > 0 ? successCount / totalCount : null

  db.prepare(
    `INSERT OR REPLACE INTO routing_metrics
    (id, model, intent, latency_p50, latency_p95, latency_p99, cost_avg, success_rate, sample_count, recorded_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(id, model, intent, latency_p50, latency_p95, latency_p99, cost_avg, success_rate, totalCount, now)
}

export function getRecentMetrics(hours: number = 6): RoutingMetric[] {
  const db = getDatabase()
  const cutoff = Date.now() - hours * 60 * 60 * 1000

  return db
    .prepare('SELECT * FROM routing_metrics WHERE recorded_at > ? ORDER BY recorded_at DESC')
    .all(cutoff) as RoutingMetric[]
}

export function getMetricsForModel(model: string, limit: number = 100): RoutingMetric[] {
  const db = getDatabase()

  return db
    .prepare('SELECT * FROM routing_metrics WHERE model = ? ORDER BY recorded_at DESC LIMIT ?')
    .all(model, limit) as RoutingMetric[]
}

export function aggregateMetrics(metrics: RoutingMetric[]): Record<string, Record<string, any>> {
  const result: Record<string, Record<string, any>> = {}

  for (const metric of metrics) {
    if (!result[metric.model]) {
      result[metric.model] = {}
    }

    if (!result[metric.model][metric.intent]) {
      result[metric.model][metric.intent] = {
        latencies: [],
        costs: [],
        successRate: [],
        sampleCount: 0,
      }
    }

    const bucket = result[metric.model][metric.intent]

    if (metric.latency_p50) bucket.latencies.push(metric.latency_p50)
    if (metric.cost_avg) bucket.costs.push(metric.cost_avg)
    if (metric.success_rate) bucket.successRate.push(metric.success_rate)

    bucket.sampleCount += metric.sample_count
  }

  return result
}

export function saveWeightSnapshot(
  weights: Record<string, Record<string, number>>,
  source: 'auto-evolve' | 'manual' | 'initial',
  improvement?: number
): string {
  const db = getDatabase()
  const id = `weights-${Date.now()}-${Math.random().toString(36).slice(2)}`
  const now = Date.now()

  db.prepare(
    `INSERT INTO routing_weights_history
    (id, timestamp, weights, source, canary_improvement, applied_at)
    VALUES (?, ?, ?, ?, ?, ?)`
  ).run(id, now, JSON.stringify(weights), source, improvement ?? null, improvement && improvement > 0 ? now : null)

  return id
}

export function getWeightsHistory(limit: number = 20): WeightSnapshot[] {
  const db = getDatabase()

  const rows = db
    .prepare('SELECT * FROM routing_weights_history ORDER BY timestamp DESC LIMIT ?')
    .all(limit) as any[]

  return rows.map((row) => ({
    ...row,
    weights: JSON.parse(row.weights),
  }))
}

export function getLatestAppliedWeights(): WeightSnapshot | null {
  const db = getDatabase()

  const row = db
    .prepare('SELECT * FROM routing_weights_history WHERE applied_at IS NOT NULL ORDER BY timestamp DESC LIMIT 1')
    .get() as any

  if (!row) return null

  return {
    ...row,
    weights: JSON.parse(row.weights),
  }
}

export function getMetricsStats(): {
  total_metrics: number
  models: string[]
  intents: string[]
  latest_recorded: number | null
} {
  const db = getDatabase()

  const total = db.prepare('SELECT COUNT(*) as count FROM routing_metrics').get() as any
  const models = db.prepare('SELECT DISTINCT model FROM routing_metrics').all() as Array<{ model: string }>
  const intents = db.prepare('SELECT DISTINCT intent FROM routing_metrics').all() as Array<{ intent: string }>
  const latest = db.prepare('SELECT MAX(recorded_at) as ts FROM routing_metrics').get() as any

  return {
    total_metrics: total.count,
    models: models.map((m) => m.model),
    intents: intents.map((i) => i.intent),
    latest_recorded: latest.ts,
  }
}
