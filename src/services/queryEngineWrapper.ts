/**
 * QueryEngine Wrapper with Remote Worker Support
 *
 * Transparently routes requests to remote worker if configured,
 * otherwise uses local QueryEngine. Unified interface for both.
 */

import { callRemoteWorker } from './remote-worker'
import type { RemoteWorkerConfig } from '../config/remoteWorkerConfig'

export interface QueryRequest {
  userId: string
  message: string
  conversationHistory?: Array<{
    role: 'user' | 'assistant'
    content: string
  }>
  model?: string
}

export interface QueryResponse {
  reply: string
  model: string
  tokens: {
    input: number
    output: number
  }
  cost: number
  latency_ms: number
  source: 'local' | 'remote'
}

/**
 * Wrapper that routes queries to local or remote worker
 */
export async function executeQuery(
  request: QueryRequest,
  remoteConfig: RemoteWorkerConfig | null,
  localExecutor?: (req: QueryRequest) => Promise<QueryResponse>
): Promise<QueryResponse> {
  // Route to remote worker if configured
  if (remoteConfig && remoteConfig.url) {
    try {
      const remoteResponse = await callRemoteWorker(
        { url: remoteConfig.url, apiKey: remoteConfig.apiKey },
        request.userId,
        request.message
      )

      return {
        reply: remoteResponse.reply,
        model: remoteResponse.model,
        tokens: remoteResponse.tokens,
        cost: remoteResponse.cost,
        latency_ms: remoteResponse.latency_ms,
        source: 'remote'
      }
    } catch (error) {
      // If remote fails and fallback available, use local
      if (localExecutor) {
        console.warn('⚠️  Remote worker unavailable, falling back to local processing')
        return await localExecutor(request)
      }
      throw error
    }
  }

  // Use local executor (fallback or primary)
  if (localExecutor) {
    return await localExecutor(request)
  }

  throw new Error('No query executor configured (neither remote nor local)')
}

/**
 * Test connection to remote worker
 */
export async function testRemoteWorkerConnection(
  remoteConfig: RemoteWorkerConfig | null
): Promise<{ healthy: boolean; latency_ms: number; error?: string }> {
  if (!remoteConfig?.url) {
    return { healthy: false, latency_ms: 0, error: 'No remote worker configured' }
  }

  const start = Date.now()
  try {
    const response = await fetch(`${remoteConfig.url.replace(/\/$/, '')}/health`)
    const latency = Date.now() - start

    if (response.ok) {
      return { healthy: true, latency_ms: latency }
    }

    return { healthy: false, latency_ms: latency, error: `HTTP ${response.status}` }
  } catch (error) {
    const latency = Date.now() - start
    return {
      healthy: false,
      latency_ms: latency,
      error: error instanceof Error ? error.message : 'Unknown error'
    }
  }
}

/**
 * Display query response with metadata
 */
export function formatQueryResponse(response: QueryResponse): string {
  const header = response.source === 'remote'
    ? `📡 Remote Worker (${response.model})`
    : `🖥️  Local Processing (${response.model})`

  return `
${header}
────────────────────────────────────────────────────
${response.reply}
────────────────────────────────────────────────────

📊 Stats:
  Tokens: ${response.tokens.input} in + ${response.tokens.output} out
  Cost: $${response.cost.toFixed(6)}
  Latency: ${response.latency_ms}ms
  Source: ${response.source}
`
}
