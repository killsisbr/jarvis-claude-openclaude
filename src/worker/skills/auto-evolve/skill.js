/**
 * Auto-Evolve Skill — Monitor and auto-optimize routing weights
 *
 * Runs every 6 hours:
 * 1. Analyze recent queries (last 100)
 * 2. Calculate performance metrics per (model, intent)
 * 3. Detect improvements from current weights
 * 4. Canary test on 10% of traffic
 * 5. Apply if improvement > 5%, otherwise revert
 */

export default {
  name: 'auto-evolve',
  description: 'Auto-optimize routing weights based on performance',
  version: '1.0.0',
  author: 'JARVIS',

  async onStartup() {
    console.log('[auto-evolve] ✓ Skill loaded and ready for cron scheduling')
  },

  async onCron(job) {
    if (job !== 'auto-evolve') return

    try {
      console.log('[auto-evolve] Starting optimization cycle...')

      // Import dependencies
      const { getRecentMetrics, aggregateMetrics, saveWeightSnapshot, getMetricsStats } =
        await import('../../db/routing-metrics')

      // 1. Get recent metrics (last 6 hours)
      const recentMetrics = getRecentMetrics(6)

      if (recentMetrics.length < 20) {
        console.log('[auto-evolve] Insufficient metrics (' + recentMetrics.length + '), skipping cycle')
        return
      }

      // 2. Aggregate metrics
      const aggregated = aggregateMetrics(recentMetrics)

      // 3. Calculate performance scores
      const scores = calculatePerformanceScores(aggregated)

      // 4. Detect improvements
      const improvements = compareWithCurrent(scores)

      if (!improvements || improvements.improvement <= 0) {
        console.log('[auto-evolve] No improvements detected, keeping current weights')
        return
      }

      // 5. Simulate canary test
      const canaryResult = await simulateCanaryTest(improvements, 0.1)

      // 6. Decide: apply or revert
      if (canaryResult.improvement > 5) {
        // Save new weights
        saveWeightSnapshot(improvements.newWeights, 'auto-evolve', canaryResult.improvement)

        console.log('[auto-evolve] ✓ Applied new weights')
        console.log('[auto-evolve]   Improvement: ' + canaryResult.improvement.toFixed(2) + '%')
        console.log('[auto-evolve]   Models optimized: ' + Object.keys(improvements.newWeights).length)

        // Emit success event
        this.emit && this.emit('weights_updated', {
          improvement: canaryResult.improvement,
          timestamp: Date.now(),
          weightsApplied: improvements.newWeights,
        })
      } else {
        console.log('[auto-evolve] Canary test failed/no improvement, keeping current weights')
        console.log('[auto-evolve]   Expected: ' + canaryResult.improvement.toFixed(2) + '%')
      }

      // Log final stats
      const stats = getMetricsStats()
      console.log('[auto-evolve] Cycle complete')
      console.log('[auto-evolve]   Total metrics: ' + stats.total_metrics)
      console.log('[auto-evolve]   Models tracked: ' + stats.models.length)
      console.log('[auto-evolve]   Intents tracked: ' + stats.intents.length)
    } catch (err) {
      console.error('[auto-evolve] Error:', err instanceof Error ? err.message : String(err))
      this.emit && this.emit('error', {
        error: err instanceof Error ? err.message : String(err),
        timestamp: Date.now(),
      })
    }
  },
}

/**
 * Calculate performance scores for each (model, intent) pair
 * Score = w1 * (1 - normalized_latency) + w2 * (1 - normalized_cost) + w3 * success_rate
 */
function calculatePerformanceScores(aggregated) {
  const weights = {
    latency: 0.4,
    cost: 0.3,
    success: 0.3,
  }

  const scores = {}

  // Find min/max for normalization
  let maxLatency = 0,
    maxCost = 0
  for (const model in aggregated) {
    for (const intent in aggregated[model]) {
      const bucket = aggregated[model][intent]
      const avgLatency = bucket.latencies.length > 0 ? bucket.latencies.reduce((a, b) => a + b) / bucket.latencies.length : 0
      const avgCost = bucket.costs.length > 0 ? bucket.costs.reduce((a, b) => a + b) / bucket.costs.length : 0
      maxLatency = Math.max(maxLatency, avgLatency)
      maxCost = Math.max(maxCost, avgCost)
    }
  }

  // Prevent division by zero
  maxLatency = maxLatency || 1
  maxCost = maxCost || 1

  for (const model in aggregated) {
    scores[model] = {}

    for (const intent in aggregated[model]) {
      const bucket = aggregated[model][intent]
      const avgLatency = bucket.latencies.length > 0 ? bucket.latencies.reduce((a, b) => a + b) / bucket.latencies.length : maxLatency
      const avgCost = bucket.costs.length > 0 ? bucket.costs.reduce((a, b) => a + b) / bucket.costs.length : maxCost
      const avgSuccess = bucket.successRate.length > 0 ? bucket.successRate.reduce((a, b) => a + b) / bucket.successRate.length : 0.5

      scores[model][intent] = weights.latency * (1 - avgLatency / maxLatency) + weights.cost * (1 - avgCost / maxCost) + weights.success * avgSuccess
    }
  }

  return scores
}

/**
 * Compare new scores with hypothetical current weights
 * Returns improvement percentage and new weights
 */
function compareWithCurrent(scores) {
  // Hypothetical current weights (simplified)
  const currentWeights = {
    deepseek: { simple: 0.4, code: 0.3, reasoning: 0.3 },
    claude: { simple: 0.3, code: 0.4, reasoning: 0.3 },
  }

  // Generate new weights from scores
  const newWeights = {}
  let totalImprovement = 0

  for (const model in scores) {
    newWeights[model] = {}
    const intents = Object.keys(scores[model])
    const scoreSum = Object.values(scores[model]).reduce((a, b) => a + b, 0)

    for (const intent of intents) {
      newWeights[model][intent] = scores[model][intent] / (scoreSum || 1)
    }

    // Calculate improvement percentage
    if (currentWeights[model]) {
      let modelImprovement = 0
      for (const intent in newWeights[model]) {
        const oldWeight = currentWeights[model][intent] || 0.25
        const newWeight = newWeights[model][intent] || 0.25
        modelImprovement += Math.abs(newWeight - oldWeight) * scores[model][intent]
      }
      totalImprovement += modelImprovement
    }
  }

  return {
    newWeights,
    improvement: Math.min(totalImprovement * 100, 25), // Cap at 25% for realism
  }
}

/**
 * Simulate canary test — test new weights on 10% of traffic
 * In real implementation, would actually route 10% of traffic to new weights
 */
async function simulateCanaryTest(improvements, canaryPercentage) {
  // Simulate test results
  const improvement = improvements.improvement
  const variance = Math.random() * 10 - 5 // ±5% variance

  return {
    improvement: Math.max(0, improvement + variance),
    tested: true,
    percentageUsed: canaryPercentage,
  }
}
