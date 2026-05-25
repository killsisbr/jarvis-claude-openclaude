import { describe, it, expect } from 'vitest'
import {
  WorkflowPlanner,
  type Workflow,
  type AgentNode,
} from './workflow-planner'

describe('WorkflowPlanner', () => {
  let planner: WorkflowPlanner

  beforeEach(() => {
    planner = new WorkflowPlanner()
  })

  describe('plan', () => {
    it('should create workflow from task prompt', async () => {
      const prompt = 'Research AI trends, analyze findings, and create a report'
      const workflow = await planner.plan(prompt)

      expect(workflow.workflowId).toMatch(/^wf_/)
      expect(workflow.taskPrompt).toBe(prompt)
      expect(workflow.agents.length).toBeGreaterThan(0)
      expect(workflow.executionOrder.length).toBeGreaterThan(0)
    })

    it('should detect research agent for search prompts', async () => {
      const prompt = 'Search for information about machine learning'
      const workflow = await planner.plan(prompt)

      const hasResearch = workflow.agents.some((a) => a.type === 'research')
      expect(hasResearch).toBe(true)
    })

    it('should detect analysis agent for analyze prompts', async () => {
      const prompt = 'Analyze the data and compare results'
      const workflow = await planner.plan(prompt)

      const hasAnalysis = workflow.agents.some((a) => a.type === 'analysis')
      expect(hasAnalysis).toBe(true)
    })

    it('should detect implementation agent for create/build prompts', async () => {
      const prompt = 'Create a web application and write tests'
      const workflow = await planner.plan(prompt)

      const hasImplementation = workflow.agents.some(
        (a) => a.type === 'implementation'
      )
      expect(hasImplementation).toBe(true)
    })

    it('should detect validation agent for test/verify prompts', async () => {
      const prompt = 'Build the feature and test it thoroughly'
      const workflow = await planner.plan(prompt)

      const hasValidation = workflow.agents.some((a) => a.type === 'validation')
      expect(hasValidation).toBe(true)
    })

    it('should have no dependencies for single-agent workflow', async () => {
      const prompt = 'Just search the web'
      const workflow = await planner.plan(prompt)

      if (workflow.agents.length === 1) {
        expect(workflow.edges.length).toBe(0)
      }
    })

    it('should create dependencies between agents', async () => {
      const prompt =
        'Research trends, analyze findings, implement solution, validate results'
      const workflow = await planner.plan(prompt)

      expect(workflow.edges.length).toBeGreaterThan(0)
    })

    it('should set execution order', async () => {
      const prompt = 'Research, analyze, implement, validate'
      const workflow = await planner.plan(prompt)

      expect(workflow.executionOrder).toHaveLength(workflow.agents.length)
    })

    it('should estimate execution metrics', async () => {
      const prompt = 'Complete a complex task'
      const workflow = await planner.plan(prompt)

      expect(workflow.estimatedTurns).toBeGreaterThan(0)
      expect(workflow.estimatedTimeMs).toBeGreaterThan(0)
    })

    it('should default to research agent for unknown tasks', async () => {
      const prompt = 'Do something vague'
      const workflow = await planner.plan(prompt)

      const hasResearch = workflow.agents.some((a) => a.type === 'research')
      expect(hasResearch).toBe(true)
    })
  })

  describe('replan', () => {
    it('should replan on agent failure', async () => {
      const originalPrompt = 'Research and implement'
      const original = await planner.plan(originalPrompt)

      const failedAgentId = original.agents[0]?.id
      if (!failedAgentId) return

      const replanned = await planner.replan(
        original,
        failedAgentId,
        'Connection timeout'
      )

      // Should have same structure but modified agent
      expect(replanned.agents.length).toBe(original.agents.length)
      expect(replanned.workflowId).toBe(original.workflowId)
    })

    it('should increase max turns on failure', async () => {
      const original = await planner.plan('Do work')
      const failedAgentId = original.agents[0]?.id
      if (!failedAgentId) return

      const originalTurns = original.agents[0]?.maxTurns ?? 5
      const replanned = await planner.replan(original, failedAgentId, 'Failed')

      const replanedAgent = replanned.agents.find((a) => a.id === failedAgentId)
      const replanedTurns = replanedAgent?.maxTurns ?? 5

      expect(replanedTurns).toBeGreaterThan(originalTurns)
    })

    it('should remove dependents on impossible task', async () => {
      const original = await planner.plan(
        'Research, analyze, implement, validate'
      )
      const failedAgentId = original.agents[0]?.id
      if (!failedAgentId) return

      const dependentCountBefore = original.agents.length
      const replanned = await planner.replan(
        original,
        failedAgentId,
        'Task is impossible'
      )

      // Should potentially have fewer agents
      expect(replanned.agents.length).toBeLessThanOrEqual(dependentCountBefore)
    })

    it('should maintain DAG property', async () => {
      const original = await planner.plan('Complex workflow')
      const failedAgentId = original.agents[0]?.id
      if (!failedAgentId) return

      const replanned = await planner.replan(original, failedAgentId, 'Error')

      // Topological sort should return all agents (no cycles)
      expect(replanned.executionOrder.length).toBe(replanned.agents.length)
    })
  })

  describe('agent node properties', () => {
    it('should create agents with correct properties', async () => {
      const workflow = await planner.plan('Create and test software')

      for (const agent of workflow.agents) {
        expect(agent.id).toBeTruthy()
        expect(agent.name).toBeTruthy()
        expect(agent.description).toBeTruthy()
        expect(agent.type).toBeTruthy()
        expect(Array.isArray(agent.tools)).toBe(true)
        expect(typeof agent.maxTurns).toBe('number')
        expect(typeof agent.timeout).toBe('number')
      }
    })

    it('should assign tools based on agent type', async () => {
      const workflow = await planner.plan('Research topics, analyze data, code it')

      const researchAgent = workflow.agents.find((a) => a.type === 'research')
      if (researchAgent) {
        expect(researchAgent.tools).toContain('web-search')
      }

      const implementationAgent = workflow.agents.find(
        (a) => a.type === 'implementation'
      )
      if (implementationAgent) {
        expect(implementationAgent.tools).toContain('write-code')
      }
    })
  })

  describe('dependency ordering', () => {
    it('should order agents according to typical workflow', async () => {
      const workflow = await planner.plan(
        'Research information, analyze it, implement solution, test results'
      )

      if (workflow.agents.length > 1) {
        // Find indices in execution order
        const researchIdx = workflow.executionOrder.findIndex(
          (id) => workflow.agents.find((a) => a.id === id)?.type === 'research'
        )
        const analysisIdx = workflow.executionOrder.findIndex(
          (id) => workflow.agents.find((a) => a.id === id)?.type === 'analysis'
        )
        const implementationIdx = workflow.executionOrder.findIndex(
          (id) =>
            workflow.agents.find((a) => a.id === id)?.type === 'implementation'
        )
        const validationIdx = workflow.executionOrder.findIndex(
          (id) => workflow.agents.find((a) => a.id === id)?.type === 'validation'
        )

        // Check ordering constraints
        if (researchIdx >= 0 && analysisIdx >= 0) {
          expect(researchIdx).toBeLessThan(analysisIdx)
        }
        if (analysisIdx >= 0 && implementationIdx >= 0) {
          expect(analysisIdx).toBeLessThan(implementationIdx)
        }
        if (implementationIdx >= 0 && validationIdx >= 0) {
          expect(implementationIdx).toBeLessThan(validationIdx)
        }
      }
    })
  })

  describe('edge cases', () => {
    it('should handle empty prompt', async () => {
      const workflow = await planner.plan('')

      expect(workflow.agents.length).toBeGreaterThan(0)
      expect(workflow.executionOrder.length).toBeGreaterThan(0)
    })

    it('should handle very long prompt', async () => {
      const longPrompt = 'Research ' + 'and analyze '.repeat(100) + 'everything'
      const workflow = await planner.plan(longPrompt)

      expect(workflow.agents.length).toBeGreaterThan(0)
    })

    it('should handle special characters in prompt', async () => {
      const prompt = 'Research @#$%^& topics & analyze "data"'
      const workflow = await planner.plan(prompt)

      expect(workflow.agents.length).toBeGreaterThan(0)
    })
  })
})

import { beforeEach } from 'vitest'
