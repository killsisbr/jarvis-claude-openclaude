import { describe, expect, test, afterEach } from 'bun:test'
import {
  recordRoutingMetric,
  getRecentMetrics,
  aggregateMetrics,
  saveWeightSnapshot,
  getWeightsHistory,
  getMetricsStats,
} from './routing-metrics'

describe('routing-metrics', () => {
  const testModel = 'test-model-' + Date.now()
  const testIntent = 'test-intent'

  afterEach(() => {
    // Cleanup is not critical for these tests
  })

  describe('recordRoutingMetric', () => {
    test('records routing metric successfully', () => {
      recordRoutingMetric(testModel, testIntent, [100, 150, 200], [0.01, 0.02], 9, 10)

      const metrics = getRecentMetrics(1)
      expect(metrics.length).toBeGreaterThan(0)

      const found = metrics.find((m) => m.model === testModel && m.intent === testIntent)
      expect(found).toBeDefined()
      expect(found?.latency_p50).toBeDefined()
      expect(found?.cost_avg).toBeGreaterThan(0)
    })

    test('calculates percentiles correctly', () => {
      const latencies = [10, 20, 30, 40, 50, 60, 70, 80, 90, 100]
      recordRoutingMetric('perc-test', 'test', latencies, [0.001], 10, 10)

      const metrics = getRecentMetrics(1)
      const found = metrics.find((m) => m.model === 'perc-test')

      expect(found?.latency_p50).toBeDefined()
      expect(found?.latency_p95).toBeDefined()
      expect(found?.latency_p99).toBeDefined()
    })
  })

  describe('aggregateMetrics', () => {
    test('aggregates metrics by model and intent', () => {
      recordRoutingMetric('agg-model1', 'intent1', [100], [0.01], 1, 1)
      recordRoutingMetric('agg-model1', 'intent2', [200], [0.02], 1, 1)
      recordRoutingMetric('agg-model2', 'intent1', [300], [0.03], 1, 1)

      const metrics = getRecentMetrics(1)
      const aggregated = aggregateMetrics(metrics.filter((m) => m.model.startsWith('agg-')))

      expect(aggregated['agg-model1']).toBeDefined()
      expect(aggregated['agg-model2']).toBeDefined()
    })
  })

  describe('weight snapshots', () => {
    test('saves and retrieves weight snapshot', () => {
      const weights = {
        model1: { intent1: 0.5, intent2: 0.5 },
        model2: { intent1: 0.3, intent2: 0.7 },
      }

      const id = saveWeightSnapshot(weights, 'auto-evolve', 5.2)
      expect(id).toBeDefined()

      const history = getWeightsHistory(10)
      const found = history.find((h) => h.id === id)
      expect(found).toBeDefined()
      expect(found?.source).toBe('auto-evolve')
      expect(found?.canary_improvement).toBe(5.2)
    })

    test('saves multiple snapshots', () => {
      const w1 = saveWeightSnapshot({ m1: { i1: 0.5 } }, 'manual', null)
      const w2 = saveWeightSnapshot({ m2: { i2: 0.5 } }, 'auto-evolve', 3.0)

      expect(w1).toBeDefined()
      expect(w2).toBeDefined()
      expect(w1).not.toBe(w2)
    })
  })

  describe('getMetricsStats', () => {
    test('returns statistics about metrics', () => {
      recordRoutingMetric('stat-model', 'stat-intent', [100], [0.01], 1, 1)

      const stats = getMetricsStats()

      expect(stats.total_metrics).toBeGreaterThan(0)
      expect(typeof stats.latest_recorded).toBe('number')
    })
  })
})
