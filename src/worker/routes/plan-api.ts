/**
 * Plan API Routes
 *
 * POST /api/plan-workflow — Generate workflow DAG from task prompt
 * GET  /api/plan/:id — Get workflow details
 * POST /api/plan/:id/replan — Replan workflow on failure
 *
 * Adapted from Phase 3 integration plan
 */

import { Router, Request, Response } from 'express'
import { getWorkflowPlanner, type Workflow } from '../services/workflow-planner'

export interface PlanWorkflowRequest {
  prompt: string
  context?: Record<string, any>
}

export interface PlanWorkflowResponse {
  workflowId: string
  taskPrompt: string
  agentCount: number
  edgeCount: number
  executionOrder: string[]
  estimatedTurns: number
  estimatedTimeMs: number
  agents: Array<{
    id: string
    name: string
    type: string
    tools: string[]
    maxTurns: number
    timeout: number
  }>
  edges: Array<{
    from: string
    to: string
    condition?: string
  }>
}

export interface ReplanRequest {
  failedAgentId: string
  failureReason: string
}

// In-memory workflow store (in production, use database)
const workflows = new Map<string, Workflow>()

/**
 * Create plan routes
 */
export function createPlanRoutes(): Router {
  const router = Router()
  const planner = getWorkflowPlanner()

  /**
   * POST /api/plan-workflow
   *
   * Generate workflow from task prompt
   *
   * Request body:
   * {
   *   "prompt": "Research AI trends, analyze findings, create report",
   *   "context": { "maxBudget": 100, "deadline": "2026-05-30" }
   * }
   *
   * Response:
   * {
   *   "workflowId": "wf_...",
   *   "taskPrompt": "...",
   *   "agentCount": 3,
   *   "edgeCount": 2,
   *   "agents": [...],
   *   "edges": [...],
   *   "executionOrder": ["agent_1", "agent_2", "agent_3"]
   * }
   */
  router.post('/api/plan-workflow', async (req: Request, res: Response) => {
    try {
      const planReq: PlanWorkflowRequest = req.body

      if (!planReq.prompt) {
        return res.status(400).json({ error: 'Missing required field: prompt' })
      }

      // Generate workflow
      const workflow = await planner.plan(planReq.prompt, planReq.context)

      // Store workflow
      workflows.set(workflow.workflowId, workflow)

      // Format response
      const response: PlanWorkflowResponse = {
        workflowId: workflow.workflowId,
        taskPrompt: workflow.taskPrompt,
        agentCount: workflow.agents.length,
        edgeCount: workflow.edges.length,
        executionOrder: workflow.executionOrder,
        estimatedTurns: workflow.estimatedTurns,
        estimatedTimeMs: workflow.estimatedTimeMs,
        agents: workflow.agents.map((a) => ({
          id: a.id,
          name: a.name,
          type: a.type,
          tools: a.tools,
          maxTurns: a.maxTurns ?? 5,
          timeout: a.timeout ?? 30000,
        })),
        edges: workflow.edges.map((e) => ({
          from: e.from,
          to: e.to,
          condition: e.condition,
        })),
      }

      res.json(response)
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error)
      res.status(500).json({ error: errorMsg })
    }
  })

  /**
   * GET /api/plan/:id
   *
   * Get workflow details
   *
   * Response:
   * {
   *   "workflow": {...},
   *   "createdAt": "2026-05-25T10:30:00Z",
   *   "status": "pending" | "executing" | "completed" | "failed"
   * }
   */
  router.get('/api/plan/:id', (req: Request, res: Response) => {
    const workflowId = req.params.id
    const workflow = workflows.get(workflowId)

    if (!workflow) {
      return res.status(404).json({ error: 'Workflow not found' })
    }

    res.json({
      workflow: {
        workflowId: workflow.workflowId,
        taskPrompt: workflow.taskPrompt,
        agents: workflow.agents,
        edges: workflow.edges,
        executionOrder: workflow.executionOrder,
        estimatedTurns: workflow.estimatedTurns,
        estimatedTimeMs: workflow.estimatedTimeMs,
      },
      createdAt: new Date(workflow.createdAt).toISOString(),
      status: 'pending',
    })
  })

  /**
   * POST /api/plan/:id/replan
   *
   * Replan workflow after agent failure
   *
   * Request body:
   * {
   *   "failedAgentId": "agent_research_abc123",
   *   "failureReason": "Connection timeout"
   * }
   *
   * Response:
   * {
   *   "workflowId": "wf_...",
   *   "agents": [...] (updated)
   *   "executionOrder": [...] (updated)
   * }
   */
  router.post('/api/plan/:id/replan', async (req: Request, res: Response) => {
    try {
      const workflowId = req.params.id
      const replanReq: ReplanRequest = req.body

      const workflow = workflows.get(workflowId)
      if (!workflow) {
        return res.status(404).json({ error: 'Workflow not found' })
      }

      if (!replanReq.failedAgentId || !replanReq.failureReason) {
        return res.status(400).json({
          error: 'Missing required fields: failedAgentId, failureReason',
        })
      }

      // Replan
      const replanned = await planner.replan(
        workflow,
        replanReq.failedAgentId,
        replanReq.failureReason
      )

      // Update stored workflow
      workflows.set(workflowId, replanned)

      res.json({
        workflowId: replanned.workflowId,
        agents: replanned.agents,
        edges: replanned.edges,
        executionOrder: replanned.executionOrder,
        estimatedTurns: replanned.estimatedTurns,
        estimatedTimeMs: replanned.estimatedTimeMs,
        message: `Replanned after failure: ${replanReq.failureReason}`,
      })
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error)
      res.status(500).json({ error: errorMsg })
    }
  })

  /**
   * GET /api/plan
   *
   * List all workflows
   *
   * Query params:
   * - limit: max results (default 10, max 100)
   * - createdSince: ISO date (e.g., 2026-05-25T00:00:00Z)
   *
   * Response:
   * [
   *   {
   *     "workflowId": "wf_...",
   *     "taskPrompt": "...",
   *     "agentCount": 3,
   *     "createdAt": "2026-05-25T10:30:00Z"
   *   },
   *   ...
   * ]
   */
  router.get('/api/plan', (req: Request, res: Response) => {
    const limit = Math.min(parseInt(req.query.limit as string) || 10, 100)
    const createdSince = req.query.createdSince as string | undefined

    let workflowList = Array.from(workflows.values())
      .sort((a, b) => b.createdAt - a.createdAt)
      .filter(
        (w) =>
          !createdSince ||
          w.createdAt >= new Date(createdSince).getTime()
      )
      .slice(0, limit)
      .map((w) => ({
        workflowId: w.workflowId,
        taskPrompt: w.taskPrompt,
        agentCount: w.agents.length,
        edgeCount: w.edges.length,
        createdAt: new Date(w.createdAt).toISOString(),
      }))

    res.json(workflowList)
  })

  /**
   * GET /api/plan/:id/execution-order
   *
   * Get execution plan for workflow
   *
   * Returns agents in topological order
   */
  router.get('/api/plan/:id/execution-order', (req: Request, res: Response) => {
    const workflowId = req.params.id
    const workflow = workflows.get(workflowId)

    if (!workflow) {
      return res.status(404).json({ error: 'Workflow not found' })
    }

    const executionPlan = workflow.executionOrder.map((agentId) => {
      const agent = workflow.agents.find((a) => a.id === agentId)
      return {
        order: workflow.executionOrder.indexOf(agentId) + 1,
        agentId,
        name: agent?.name,
        type: agent?.type,
        tools: agent?.tools,
        maxTurns: agent?.maxTurns,
        dependsOn: workflow.edges
          .filter((e) => e.to === agentId)
          .map((e) => e.from),
      }
    })

    res.json({
      workflowId,
      totalAgents: workflow.agents.length,
      executionPlan,
    })
  })

  return router
}
