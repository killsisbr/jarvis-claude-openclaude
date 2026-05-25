/**
 * Workflow Planner — Generate DAG of agents
 *
 * Analyzes task prompts and generates directed acyclic graphs
 * of agent nodes that can execute in parallel or sequence.
 *
 * Adapted from OpenBrowser src/agent/plan.ts
 */

export interface AgentNode {
  id: string
  name: string
  description: string
  type: 'research' | 'analysis' | 'implementation' | 'validation' | 'custom'
  tools: string[]
  maxTurns?: number
  timeout?: number // milliseconds
}

export interface WorkflowEdge {
  from: string // source agent ID
  to: string // target agent ID
  condition?: string // optional: edge condition (e.g., "if success")
}

export interface Workflow {
  workflowId: string
  taskPrompt: string
  agents: AgentNode[]
  edges: WorkflowEdge[]
  executionOrder: string[] // topologically sorted
  estimatedTurns: number
  estimatedTimeMs: number
  createdAt: number
}

/**
 * Workflow Planner
 */
export class WorkflowPlanner {
  /**
   * Plan a workflow from task prompt
   *
   * Uses heuristics to generate agent DAG:
   * - Analyze task keywords to determine agent types
   * - Identify dependencies between subtasks
   * - Order agents topologically for parallel execution
   *
   * @param taskPrompt - User's task description
   * @param context - Optional context (previous results, constraints)
   * @returns Workflow with agents and execution plan
   */
  async plan(
    taskPrompt: string,
    context?: Record<string, any>
  ): Promise<Workflow> {
    const workflowId = `wf_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`

    // Step 1: Analyze task to determine required agent types
    const requiredAgents = this.analyzeTask(taskPrompt)

    // Step 2: Create agent nodes
    const agents = this.createAgentNodes(requiredAgents, taskPrompt)

    // Step 3: Determine dependencies
    const edges = this.determineDependencies(agents, requiredAgents)

    // Step 4: Topological sort for execution order
    const executionOrder = this.topologicalSort(agents, edges)

    // Step 5: Estimate execution time
    const estimatedTurns = agents.length * 5 // rough estimate
    const estimatedTimeMs = agents.length * 3000 // rough estimate

    return {
      workflowId,
      taskPrompt,
      agents,
      edges,
      executionOrder,
      estimatedTurns,
      estimatedTimeMs,
      createdAt: Date.now(),
    }
  }

  /**
   * Replan workflow if execution fails
   *
   * Adapts the workflow based on failure reason
   */
  async replan(
    originalWorkflow: Workflow,
    failedAgentId: string,
    failureReason: string
  ): Promise<Workflow> {
    // Clone original workflow
    const agents = JSON.parse(JSON.stringify(originalWorkflow.agents))
    let edges = JSON.parse(JSON.stringify(originalWorkflow.edges))

    // Find and mark failed agent
    const failedAgent = agents.find((a: AgentNode) => a.id === failedAgentId)
    if (failedAgent) {
      // Increase max turns for retry
      failedAgent.maxTurns = (failedAgent.maxTurns ?? 5) + 3
    }

    // Remove dependent agents if task is impossible
    if (failureReason.toLowerCase().includes('impossible')) {
      const dependents = this.findDependentAgents(failedAgentId, edges)
      for (const dependent of dependents) {
        const idx = agents.findIndex((a: AgentNode) => a.id === dependent)
        if (idx >= 0) agents.splice(idx, 1)
      }
      edges = edges.filter(
        (e: WorkflowEdge) =>
          !dependents.includes(e.from) && !dependents.includes(e.to)
      )
    }

    const executionOrder = this.topologicalSort(agents, edges)

    return {
      ...originalWorkflow,
      agents,
      edges,
      executionOrder,
    }
  }

  /**
   * Analyze task prompt to determine required agent types
   */
  private analyzeTask(taskPrompt: string): string[] {
    const lowerPrompt = taskPrompt.toLowerCase()
    const agents: Set<string> = new Set()

    // Keyword mapping to agent types
    const patterns = {
      research: [
        'search',
        'find',
        'investigate',
        'research',
        'explore',
        'discover',
        'information',
        'data',
      ],
      analysis: [
        'analyze',
        'compare',
        'evaluate',
        'assess',
        'review',
        'examine',
        'understand',
      ],
      implementation: [
        'create',
        'build',
        'write',
        'develop',
        'implement',
        'code',
        'design',
        'make',
      ],
      validation: [
        'test',
        'verify',
        'validate',
        'check',
        'confirm',
        'ensure',
        'quality',
      ],
    }

    // Match keywords to agent types
    for (const [agentType, keywords] of Object.entries(patterns)) {
      if (keywords.some((kw) => lowerPrompt.includes(kw))) {
        agents.add(agentType)
      }
    }

    // Default: research agent for unknown tasks
    if (agents.size === 0) {
      agents.add('research')
    }

    return Array.from(agents)
  }

  /**
   * Create agent nodes from required types
   */
  private createAgentNodes(agentTypes: string[], taskPrompt: string): AgentNode[] {
    const agents: AgentNode[] = []

    const toolMaps: Record<string, string[]> = {
      research: ['web-search', 'get-page', 'summarize'],
      analysis: ['analyze-data', 'compare', 'extract-insights'],
      implementation: ['write-code', 'create-file', 'execute'],
      validation: ['test-code', 'validate-schema', 'run-checks'],
    }

    for (const agentType of agentTypes) {
      const agent: AgentNode = {
        id: `agent_${agentType}_${Math.random().toString(36).slice(2, 7)}`,
        name: `${agentType.charAt(0).toUpperCase() + agentType.slice(1)} Agent`,
        description: `${agentType} specialist for: ${taskPrompt.substring(0, 100)}...`,
        type: agentType as any,
        tools: toolMaps[agentType] || [],
        maxTurns: 5,
        timeout: 30000,
      }
      agents.push(agent)
    }

    return agents
  }

  /**
   * Determine dependencies between agents
   */
  private determineDependencies(
    agents: AgentNode[],
    agentTypes: string[]
  ): WorkflowEdge[] {
    const edges: WorkflowEdge[] = []

    // Typical dependency order: research → analysis → implementation → validation
    const order = ['research', 'analysis', 'implementation', 'validation']

    for (let i = 0; i < order.length - 1; i++) {
      const fromType = order[i]
      const toType = order[i + 1]

      const fromAgent = agents.find((a) => a.type === fromType)
      const toAgent = agents.find((a) => a.type === toType)

      if (fromAgent && toAgent) {
        edges.push({
          from: fromAgent.id,
          to: toAgent.id,
          condition: 'success',
        })
      }
    }

    return edges
  }

  /**
   * Topologically sort agents for execution
   */
  private topologicalSort(agents: AgentNode[], edges: WorkflowEdge[]): string[] {
    const inDegree = new Map<string, number>()
    const adjList = new Map<string, string[]>()

    // Initialize
    for (const agent of agents) {
      inDegree.set(agent.id, 0)
      adjList.set(agent.id, [])
    }

    // Build graph
    for (const edge of edges) {
      const current = inDegree.get(edge.to) ?? 0
      inDegree.set(edge.to, current + 1)

      const neighbors = adjList.get(edge.from) ?? []
      neighbors.push(edge.to)
      adjList.set(edge.from, neighbors)
    }

    // Kahn's algorithm
    const queue: string[] = []
    const result: string[] = []

    for (const [agentId, degree] of inDegree) {
      if (degree === 0) {
        queue.push(agentId)
      }
    }

    while (queue.length > 0) {
      const current = queue.shift()!
      result.push(current)

      const neighbors = adjList.get(current) ?? []
      for (const neighbor of neighbors) {
        const degree = (inDegree.get(neighbor) ?? 0) - 1
        inDegree.set(neighbor, degree)

        if (degree === 0) {
          queue.push(neighbor)
        }
      }
    }

    return result
  }

  /**
   * Find agents dependent on a given agent
   */
  private findDependentAgents(agentId: string, edges: WorkflowEdge[]): string[] {
    const dependents: Set<string> = new Set()
    const queue: string[] = [agentId]

    while (queue.length > 0) {
      const current = queue.shift()!

      for (const edge of edges) {
        if (edge.from === current && !dependents.has(edge.to)) {
          dependents.add(edge.to)
          queue.push(edge.to)
        }
      }
    }

    return Array.from(dependents)
  }
}

/**
 * Create default planner instance
 */
let globalPlanner: WorkflowPlanner | null = null

export function getWorkflowPlanner(): WorkflowPlanner {
  if (!globalPlanner) {
    globalPlanner = new WorkflowPlanner()
  }
  return globalPlanner
}
