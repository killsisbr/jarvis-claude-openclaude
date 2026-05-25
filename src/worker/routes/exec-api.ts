/**
 * Exec API Routes
 *
 * POST /api/exec — Execute with tools (agentic loop)
 * GET  /api/exec/:id/stream — Stream execution events (SSE)
 *
 * Adapted from Phase 2 integration plan
 */

import { Router, Request, Response } from 'express'
import type { JarvisWorker } from '../worker-core'
import { SessionManager } from '../services/session-manager'
import {
  executeWithTools,
  streamExecutionEvents,
  type ExecutionEvent,
} from '../services/executor-service'
import type { ToolRegistry } from '../../cli/tool-executor'

export interface ExecRequest {
  prompt: string
  tools?: Array<{
    name: string
    description: string
    schema?: Record<string, any>
  }>
  maxTurns?: number
  model?: string
  sessionId?: string
}

export interface ExecResponse {
  executionId: string
  success: boolean
  finalContent: string
  totalTurns: number
  totalToolCalls: number
  stopReason: string
  timeMs: number
  errors: string[]
}

// In-memory execution store (in production, use database)
const executions = new Map<
  string,
  {
    request: ExecRequest
    result: any
    events: ExecutionEvent[]
    startTime: number
    endTime?: number
  }
>()

/**
 * Create execution routes
 */
export function createExecRoutes(
  worker: JarvisWorker,
  sessionManager: SessionManager
): Router {
  const router = Router()

  /**
   * POST /api/exec
   *
   * Execute prompt with optional tools (agentic loop)
   *
   * Request body:
   * {
   *   "prompt": "Do something",
   *   "tools": [
   *     {
   *       "name": "search",
   *       "description": "Search the web",
   *       "schema": { "query": { "type": "string" } }
   *     }
   *   ],
   *   "maxTurns": 10,
   *   "model": "deepseek-chat",
   *   "sessionId": "session_xyz" (optional)
   * }
   */
  router.post('/api/exec', async (req: Request, res: Response) => {
    try {
      const execRequest: ExecRequest = req.body

      if (!execRequest.prompt) {
        return res.status(400).json({ error: 'Missing required field: prompt' })
      }

      const executionId = `exec_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`
      const maxTurns = execRequest.maxTurns ?? 10
      const sessionId = execRequest.sessionId ?? executionId

      // Get or create session
      const session = await sessionManager.getOrCreateSession(sessionId)

      // Build tool registry from request (in production, load from database)
      const toolRegistry: ToolRegistry = {}
      // TODO: Load actual tools from tool registry

      // Collect events during execution
      const events: ExecutionEvent[] = []

      // Execute with tools
      const result = await executeWithTools(
        execRequest.prompt,
        toolRegistry,
        async (prompt: string) => {
          // Call worker LLM
          const response = await worker.processPrompt(prompt, {
            model: execRequest.model,
          })
          return response.text || ''
        },
        { maxTurns },
        (event) => {
          events.push(event)
        }
      )

      // Store execution result
      executions.set(executionId, {
        request: execRequest,
        result,
        events,
        startTime: Date.now() - result.timeMs,
        endTime: Date.now(),
      })

      // Return response
      const response: ExecResponse = {
        executionId,
        success: result.success,
        finalContent: result.finalContent,
        totalTurns: result.totalTurns,
        totalToolCalls: result.totalToolCalls,
        stopReason: result.stopReason,
        timeMs: result.timeMs,
        errors: result.toolErrors,
      }

      res.status(result.success ? 200 : 400).json(response)
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error)
      res.status(500).json({ error: errorMsg })
    }
  })

  /**
   * GET /api/exec/:id/stream
   *
   * Stream execution events as Server-Sent Events
   *
   * Returns:
   * event: start
   * data: {"type":"start","content":"..."}
   *
   * event: tool_call
   * data: {"type":"tool_call","turnNumber":1,"toolCall":{...}}
   *
   * event: tool_result
   * data: {"type":"tool_result","toolResult":{...}}
   *
   * event: complete
   * data: {"type":"complete","content":"..."}
   */
  router.get('/api/exec/:id/stream', async (req: Request, res: Response) => {
    const executionId = req.params.id

    // Set up SSE headers
    res.setHeader('Content-Type', 'text/event-stream')
    res.setHeader('Cache-Control', 'no-cache')
    res.setHeader('Connection', 'keep-alive')

    const execution = executions.get(executionId)

    if (!execution) {
      res.write('event: error\n')
      res.write('data: {"error":"Execution not found"}\n\n')
      res.end()
      return
    }

    // Send all recorded events
    for (const event of execution.events) {
      res.write(`event: ${event.type}\n`)
      res.write(`data: ${JSON.stringify(event)}\n\n`)
    }

    // Send final status
    if (execution.result) {
      res.write('event: status\n')
      res.write(
        `data: ${JSON.stringify({
          success: execution.result.success,
          totalTurns: execution.result.totalTurns,
          totalToolCalls: execution.result.totalToolCalls,
          timeMs: execution.result.timeMs,
        })}\n\n`
      )
    }

    res.end()
  })

  /**
   * GET /api/exec/:id
   *
   * Get execution result
   */
  router.get('/api/exec/:id', (req: Request, res: Response) => {
    const executionId = req.params.id
    const execution = executions.get(executionId)

    if (!execution) {
      return res.status(404).json({ error: 'Execution not found' })
    }

    res.json({
      executionId,
      request: execution.request,
      result: execution.result,
      eventCount: execution.events.length,
      startTime: execution.startTime,
      endTime: execution.endTime,
      durationMs: execution.endTime
        ? execution.endTime - execution.startTime
        : undefined,
    })
  })

  /**
   * GET /api/exec
   *
   * List all executions
   */
  router.get('/api/exec', (req: Request, res: Response) => {
    const limit = Math.min(parseInt(req.query.limit as string) || 10, 100)
    const status = req.query.status as string | undefined

    let execList = Array.from(executions.entries())
      .sort((a, b) => b[1].startTime - a[1].startTime)
      .slice(0, limit)
      .map(([id, exec]) => ({
        executionId: id,
        success: exec.result?.success,
        totalTurns: exec.result?.totalTurns,
        startTime: exec.startTime,
        endTime: exec.endTime,
      }))

    res.json(execList)
  })

  return router
}
