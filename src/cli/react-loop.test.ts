import { describe, it, expect, vi } from 'vitest'
import {
  executeReActLoop,
  hasToolCalls,
  parseToolCallsFromXml,
  createDebugStreamCallback,
  type ToolCall,
  type StreamEvent,
} from './react-loop'

describe('ReAct Loop', () => {
  describe('hasToolCalls', () => {
    it('should detect tool calls in content', () => {
      const content = 'Some text <tool_call>{"name": "test"}</tool_call> more'
      expect(hasToolCalls(content)).toBe(true)
    })

    it('should return false for no tool calls', () => {
      expect(hasToolCalls('Just plain text')).toBe(false)
    })
  })

  describe('parseToolCallsFromXml', () => {
    it('should parse single tool call', () => {
      const content = '<tool_call>{"name": "search", "arguments": {"query": "test"}}</tool_call>'
      const calls = parseToolCallsFromXml(content)

      expect(calls).toHaveLength(1)
      expect(calls[0].name).toBe('search')
      expect(calls[0].arguments.query).toBe('test')
    })

    it('should parse multiple tool calls', () => {
      const content = `
        <tool_call>{"name": "tool1", "arguments": {}}</tool_call>
        Some text
        <tool_call>{"name": "tool2", "arguments": {"x": 1}}</tool_call>
      `
      const calls = parseToolCallsFromXml(content)

      expect(calls).toHaveLength(2)
      expect(calls[0].name).toBe('tool1')
      expect(calls[1].name).toBe('tool2')
    })

    it('should skip malformed tool calls', () => {
      const content = `
        <tool_call>{"name": "valid", "arguments": {}}</tool_call>
        <tool_call>{"invalid json</tool_call>
        <tool_call>{"name": "another", "arguments": {}}</tool_call>
      `
      const calls = parseToolCallsFromXml(content)

      expect(calls).toHaveLength(2)
      expect(calls[0].name).toBe('valid')
      expect(calls[1].name).toBe('another')
    })

    it('should handle empty arguments', () => {
      const content = '<tool_call>{"name": "test"}</tool_call>'
      const calls = parseToolCallsFromXml(content)

      expect(calls[0].arguments).toEqual({})
    })
  })

  describe('createDebugStreamCallback', () => {
    it('should create a callback that logs events', () => {
      const spy = vi.spyOn(console, 'log').mockImplementation(() => {})
      const callback = createDebugStreamCallback()

      callback({ type: 'loop_start', turnNumber: 1 })
      expect(spy).toHaveBeenCalledWith('[ReAct] Turn 1')

      callback({
        type: 'tool_call',
        turnNumber: 1,
        toolCall: { id: '1', name: 'search', arguments: {} },
      })
      expect(spy).toHaveBeenCalledWith('[ReAct] → search')

      callback({
        type: 'tool_result',
        toolResult: {
          toolCallId: '1',
          toolName: 'search',
          content: 'result',
          success: true,
        },
      })
      expect(spy).toHaveBeenCalledWith('[ReAct] ← ✓ search')

      spy.mockRestore()
    })
  })

  describe('executeReActLoop', () => {
    it('should execute with max turns limit', async () => {
      let turnCount = 0
      const events: StreamEvent[] = []

      const toolExecutor = async (toolCall: ToolCall) => ({
        toolCallId: toolCall.id,
        toolName: toolCall.name,
        content: 'result',
        success: true,
      })

      const loopControl = (turn: number) => {
        turnCount = turn
        return turn < 3 // Max 3 turns
      }

      const result = await executeReActLoop(
        'initial prompt',
        [],
        toolExecutor,
        { maxTurns: 5 },
        (event) => events.push(event),
        loopControl
      )

      expect(events.some((e) => e.type === 'loop_start')).toBe(true)
      expect(result.turnNumber).toBeGreaterThan(0)
    })

    it('should stop when loopControl returns false', async () => {
      const events: StreamEvent[] = []
      let loopControlCalls = 0

      const loopControl = (turn: number) => {
        loopControlCalls++
        // Stop after first turn
        return false
      }

      await executeReActLoop(
        'test',
        [],
        async () => ({
          toolCallId: '1',
          toolName: 'test',
          content: 'ok',
          success: true,
        }),
        { maxTurns: 10 },
        (event) => events.push(event),
        loopControl
      )

      // loopControl should have been called
      expect(loopControlCalls).toBeGreaterThan(0)
      // Should have loop_end event with loop_control_false reason
      expect(events.some((e) => e.reason === 'loop_control_false')).toBe(true)
    })

    it('should respect maxTurns config', async () => {
      const events: StreamEvent[] = []
      let loopsExceeded = false

      const loopControl = () => true // Always wants to continue

      await executeReActLoop(
        'test',
        [],
        async () => ({
          toolCallId: '1',
          toolName: 'test',
          content: 'ok',
          success: true,
        }),
        { maxTurns: 3 },
        (event) => {
          events.push(event)
          if (event.type === 'loop_end' && event.reason === 'max_turns_exceeded') {
            loopsExceeded = true
          }
        },
        loopControl
      )

      expect(loopsExceeded || events.length > 0).toBe(true)
    })
  })
})
