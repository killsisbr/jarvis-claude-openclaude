/**
 * Executor Service — Agentic Loop for /api/exec
 *
 * Implements full execution loop with tool calling:
 * 1. LLM generates response
 * 2. Parse tool calls
 * 3. Execute tools
 * 4. Re-send results to LLM
 * 5. Repeat until stop reason or max turns
 *
 * Adapted from KimiProxy src/tools/executor.ts
 */

import type { LLMFunction } from '../worker-core'
import {
  parseToolCallsFromContent,
  executeToolCalls,
  type ToolCall,
  type ToolResult,
  type ToolRegistry,
} from '../../cli/tool-executor'
import { robustParseJSON } from '../../utils/json-utils'

export interface ExecutionConfig {
  maxTurns?: number
  parallelLimit?: number
  debug?: boolean
}

export interface ExecutorToolCall extends ToolCall {
  turnNumber: number
}

export interface ExecutorToolResult extends ToolResult {
  turnNumber: number
}

export interface ExecutionEvent {
  type: 'start' | 'tool_call' | 'tool_result' | 'turn_end' | 'complete' | 'error'
  turnNumber?: number
  toolCall?: ExecutorToolCall
  toolResult?: ExecutorToolResult
  content?: string
  reason?: string
  error?: string
}

export type ExecutionEventCallback = (event: ExecutionEvent) => void | Promise<void>

export interface ExecutionResult {
  success: boolean
  finalContent: string
  totalTurns: number
  totalToolCalls: number
  toolErrors: string[]
  stopReason: 'max_turns' | 'no_tool_calls' | 'stop_reason' | 'error'
  timeMs: number
}

/**
 * Execute with agentic loop
 */
export async function executeWithTools(
  prompt: string,
  toolRegistry: ToolRegistry,
  llmFunction: LLMFunction,
  config: ExecutionConfig = {},
  onEvent?: ExecutionEventCallback
): Promise<ExecutionResult> {
  const maxTurns = config.maxTurns ?? 10
  const parallelLimit = config.parallelLimit ?? 1
  const debug = config.debug ?? false

  const startTime = Date.now()
  let turnNumber = 0
  let totalToolCalls = 0
  let toolErrors: string[] = []
  let currentContent = prompt
  let stopReason: ExecutionResult['stopReason'] = 'no_tool_calls'

  try {
    // Initial LLM call
    await onEvent?.({
      type: 'start',
      content: prompt,
    })

    while (turnNumber < maxTurns) {
      turnNumber++

      if (debug) {
        console.log(`[ExecutorService] Turn ${turnNumber}/${maxTurns}`)
      }

      // Call LLM
      let llmResponse: string
      try {
        llmResponse = await llmFunction(currentContent)
      } catch (error) {
        const errorMsg =
          error instanceof Error ? error.message : String(error)
        await onEvent?.({
          type: 'error',
          turnNumber,
          error: `LLM call failed: ${errorMsg}`,
        })
        throw error
      }

      // Parse tool calls
      const { textContent, toolCalls } = parseToolCallsFromContent(llmResponse)
      currentContent = textContent

      if (toolCalls.length === 0) {
        // No tool calls, we're done
        await onEvent?.({
          type: 'turn_end',
          turnNumber,
          reason: 'no_tool_calls',
          content: currentContent,
        })
        stopReason = 'no_tool_calls'
        break
      }

      totalToolCalls += toolCalls.length

      // Emit tool calls
      for (const toolCall of toolCalls) {
        await onEvent?.({
          type: 'tool_call',
          turnNumber,
          toolCall: {
            ...toolCall,
            turnNumber,
          },
        })
      }

      // Execute tools
      const results = await executeToolCalls(toolCalls, toolRegistry, parallelLimit)

      // Emit tool results
      for (const result of results) {
        await onEvent?.({
          type: 'tool_result',
          turnNumber,
          toolResult: {
            ...result,
            turnNumber,
          },
        })

        if (result.isError) {
          toolErrors.push(`${result.name}: ${result.content}`)
        }
      }

      if (debug) {
        console.log(
          `[ExecutorService] Turn ${turnNumber}: ${toolCalls.length} tools, ${results.filter(r => !r.isError).length} OK`
        )
      }

      // Emit turn end event
      await onEvent?.({
        type: 'turn_end',
        turnNumber,
        reason: 'iteration_complete',
      })
    }

    // Check if max turns exceeded
    if (turnNumber >= maxTurns) {
      stopReason = 'max_turns'
    }

    await onEvent?.({
      type: 'complete',
      turnNumber,
      content: currentContent,
      reason: stopReason,
    })

    return {
      success: toolErrors.length === 0,
      finalContent: currentContent,
      totalTurns: turnNumber,
      totalToolCalls,
      toolErrors,
      stopReason,
      timeMs: Date.now() - startTime,
    }
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error)

    await onEvent?.({
      type: 'error',
      turnNumber,
      error: errorMsg,
    })

    return {
      success: false,
      finalContent: currentContent,
      totalTurns: turnNumber,
      totalToolCalls,
      toolErrors: [...toolErrors, errorMsg],
      stopReason: 'error',
      timeMs: Date.now() - startTime,
    }
  }
}

/**
 * Stream execution events (for Server-Sent Events)
 */
export async function streamExecutionEvents(
  prompt: string,
  toolRegistry: ToolRegistry,
  llmFunction: LLMFunction,
  onEvent: ExecutionEventCallback,
  config: ExecutionConfig = {}
): Promise<ExecutionResult> {
  return executeWithTools(prompt, toolRegistry, llmFunction, config, onEvent)
}

/**
 * Execute and collect all events
 */
export async function executeAndCollectEvents(
  prompt: string,
  toolRegistry: ToolRegistry,
  llmFunction: LLMFunction,
  config: ExecutionConfig = {}
): Promise<{
  result: ExecutionResult
  events: ExecutionEvent[]
}> {
  const events: ExecutionEvent[] = []

  const result = await executeWithTools(
    prompt,
    toolRegistry,
    llmFunction,
    config,
    (event) => events.push(event)
  )

  return { result, events }
}
