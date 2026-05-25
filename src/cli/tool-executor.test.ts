import { describe, it, expect, vi } from 'vitest'
import {
  parseToolCallsFromContent,
  executeToolCall,
  executeToolCalls,
  executeToolLoop,
  type ToolRegistry,
} from './tool-executor'

describe('Tool Executor', () => {
  describe('parseToolCallsFromContent', () => {
    it('should parse tool calls from XML markers', () => {
      const content =
        'Some text <tool_call>{"name": "search", "arguments": {"query": "test"}}</tool_call> more'
      const { textContent, toolCalls } = parseToolCallsFromContent(content)

      expect(toolCalls).toHaveLength(1)
      expect(toolCalls[0].name).toBe('search')
      expect(toolCalls[0].arguments.query).toBe('test')
      expect(textContent).toContain('Some text')
      expect(textContent).toContain('more')
    })

    it('should parse multiple tool calls', () => {
      const content = `
        <tool_call>{"name": "tool1", "arguments": {}}</tool_call>
        text between
        <tool_call>{"name": "tool2", "arguments": {"x": 1}}</tool_call>
      `
      const { toolCalls } = parseToolCallsFromContent(content)

      expect(toolCalls).toHaveLength(2)
      expect(toolCalls[0].name).toBe('tool1')
      expect(toolCalls[1].name).toBe('tool2')
    })

    it('should handle malformed JSON gracefully', () => {
      const content = `
        <tool_call>{"name": "valid", "arguments": {}}</tool_call>
        <tool_call>{"incomplete": </tool_call>
        <tool_call>{"name": "another", "arguments": {}}</tool_call>
      `
      const { toolCalls } = parseToolCallsFromContent(content)

      expect(toolCalls).toHaveLength(2)
      expect(toolCalls[0].name).toBe('valid')
      expect(toolCalls[1].name).toBe('another')
    })

    it('should extract text content correctly', () => {
      const content =
        'Before<tool_call>{"name": "t1", "arguments": {}}</tool_call>After'
      const { textContent } = parseToolCallsFromContent(content)

      expect(textContent).toBe('BeforeAfter')
    })

    it('should handle no tool calls', () => {
      const content = 'Just plain text with no tool calls'
      const { toolCalls, textContent } = parseToolCallsFromContent(content)

      expect(toolCalls).toHaveLength(0)
      expect(textContent).toBe(content)
    })
  })

  describe('executeToolCall', () => {
    it('should execute tool successfully', async () => {
      const registry: ToolRegistry = {
        search: async (args) => `Found results for: ${args.query}`,
      }

      const toolCall = {
        id: 'call_1',
        name: 'search',
        arguments: { query: 'test' },
      }

      const result = await executeToolCall(toolCall, registry)

      expect(result.isError).toBe(false)
      expect(result.content).toContain('Found results')
      expect(result.name).toBe('search')
    })

    it('should handle tool not found', async () => {
      const registry: ToolRegistry = {}

      const toolCall = {
        id: 'call_1',
        name: 'nonexistent',
        arguments: {},
      }

      const result = await executeToolCall(toolCall, registry)

      expect(result.isError).toBe(true)
      expect(result.content).toContain('not found')
    })

    it('should handle tool execution error', async () => {
      const registry: ToolRegistry = {
        failing: async () => {
          throw new Error('Execution failed')
        },
      }

      const toolCall = {
        id: 'call_1',
        name: 'failing',
        arguments: {},
      }

      const result = await executeToolCall(toolCall, registry)

      expect(result.isError).toBe(true)
      expect(result.content).toContain('Execution failed')
    })

    it('should stringify object results', async () => {
      const registry: ToolRegistry = {
        getObject: async () => ({ key: 'value', nested: { x: 1 } }),
      }

      const toolCall = {
        id: 'call_1',
        name: 'getObject',
        arguments: {},
      }

      const result = await executeToolCall(toolCall, registry)

      expect(result.isError).toBe(false)
      expect(result.content).toContain('key')
      expect(result.content).toContain('value')
    })
  })

  describe('executeToolCalls', () => {
    it('should execute multiple tool calls sequentially', async () => {
      const callOrder: string[] = []
      const registry: ToolRegistry = {
        tool1: async () => {
          callOrder.push('tool1')
          return 'result1'
        },
        tool2: async () => {
          callOrder.push('tool2')
          return 'result2'
        },
      }

      const toolCalls = [
        { id: 'call_1', name: 'tool1', arguments: {} },
        { id: 'call_2', name: 'tool2', arguments: {} },
      ]

      const results = await executeToolCalls(toolCalls, registry, 1)

      expect(results).toHaveLength(2)
      expect(callOrder).toEqual(['tool1', 'tool2'])
    })

    it('should maintain result order', async () => {
      const registry: ToolRegistry = {
        tool1: async () => 'result1',
        tool2: async () => 'result2',
        tool3: async () => 'result3',
      }

      const toolCalls = [
        { id: 'call_1', name: 'tool1', arguments: {} },
        { id: 'call_2', name: 'tool2', arguments: {} },
        { id: 'call_3', name: 'tool3', arguments: {} },
      ]

      const results = await executeToolCalls(toolCalls, registry, 3)

      expect(results[0].name).toBe('tool1')
      expect(results[1].name).toBe('tool2')
      expect(results[2].name).toBe('tool3')
    })

    it('should handle partial failures', async () => {
      const registry: ToolRegistry = {
        good: async () => 'ok',
        bad: async () => {
          throw new Error('Failed')
        },
      }

      const toolCalls = [
        { id: 'call_1', name: 'good', arguments: {} },
        { id: 'call_2', name: 'bad', arguments: {} },
        { id: 'call_3', name: 'good', arguments: {} },
      ]

      const results = await executeToolCalls(toolCalls, registry, 1)

      expect(results[0].isError).toBe(false)
      expect(results[1].isError).toBe(true)
      expect(results[2].isError).toBe(false)
    })
  })

  describe('executeToolLoop', () => {
    it('should stop when no tool calls found', async () => {
      const registry: ToolRegistry = {}

      const result = await executeToolLoop('No tool calls here', registry)

      expect(result.totalToolCalls).toBe(0)
      expect(result.totalTurns).toBe(0)
      expect(result.finalContent).toBe('No tool calls here')
    })

    it('should execute tool loop with callback', async () => {
      const registry: ToolRegistry = {
        test: async () => 'ok',
      }

      const turns: number[] = []
      const onTurn = (turn: number) => {
        turns.push(turn)
      }

      const content = '<tool_call>{"name": "test", "arguments": {}}</tool_call>'
      const result = await executeToolLoop(content, registry, onTurn, {
        maxTurns: 2,
      })

      expect(result.totalTurns).toBeGreaterThan(0)
      expect(turns.length).toBeGreaterThan(0)
    })

    it('should respect maxTurns limit', async () => {
      const registry: ToolRegistry = {
        test: async () => 'ok',
      }

      const content = '<tool_call>{"name": "test", "arguments": {}}</tool_call>'
      const result = await executeToolLoop(content, registry, undefined, {
        maxTurns: 3,
      })

      expect(result.totalTurns).toBeLessThanOrEqual(3)
    })

    it('should track errors', async () => {
      const registry: ToolRegistry = {
        failing: async () => {
          throw new Error('Test error')
        },
      }

      const content = '<tool_call>{"name": "failing", "arguments": {}}</tool_call>'
      const result = await executeToolLoop(content, registry, undefined, {
        maxTurns: 1,
      })

      expect(result.errors.length).toBeGreaterThan(0)
      expect(result.errors[0]).toContain('Test error')
    })
  })
})
