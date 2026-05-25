/**
 * Tool Executor
 *
 * Handles tool call parsing, execution, and result collection
 * Adapted from KimiProxy src/tools/executor.ts
 */

import { robustParseJSON } from '../utils/json-utils'

export interface ParsedToolCall {
  id: string
  name: string
  arguments: Record<string, any>
}

export interface ToolCallResult {
  toolCallId: string
  name: string
  content: string
  isError: boolean
}

export interface ToolRegistry {
  [toolName: string]: (args: Record<string, any>) => Promise<any>
}

/**
 * Parse tool calls from LLM response content
 *
 * Looks for XML-style tool calls:
 * <tool_call>{"name": "...", "arguments": {...}}</tool_call>
 *
 * Robust: Falls back to partial JSON parsing if malformed
 */
export function parseToolCallsFromContent(content: string): {
  textContent: string
  toolCalls: ParsedToolCall[]
} {
  const toolCalls: ParsedToolCall[] = []
  const TOOL_START = '<tool_call>'
  const TOOL_END = '</tool_call>'

  let remaining = content
  let textContent = ''

  while (true) {
    const startIdx = remaining.indexOf(TOOL_START)
    if (startIdx === -1) {
      textContent += remaining
      break
    }

    textContent += remaining.substring(0, startIdx)

    const endIdx = remaining.indexOf(TOOL_END, startIdx + TOOL_START.length)
    if (endIdx === -1) {
      textContent += remaining.substring(startIdx)
      break
    }

    const jsonStr = remaining
      .substring(startIdx + TOOL_START.length, endIdx)
      .trim()

    try {
      const parsed = robustParseJSON(jsonStr)
      if (parsed) {
        toolCalls.push({
          id: `call_${Math.random().toString(36).slice(2, 9)}`,
          name: parsed.name || '',
          arguments: parsed.arguments || {},
        })
      }
    } catch (e) {
      // Skip malformed tool calls
      if (process.env.DEBUG_TOOLS) {
        console.error('[ToolExecutor] Failed to parse:', jsonStr)
      }
    }

    remaining = remaining.substring(endIdx + TOOL_END.length)
  }

  return { textContent, toolCalls }
}

/**
 * Execute a single tool call
 *
 * @param toolCall - The tool call to execute
 * @param registry - Available tools
 * @returns Result with content and error status
 */
export async function executeToolCall(
  toolCall: ParsedToolCall,
  registry: ToolRegistry
): Promise<ToolCallResult> {
  const tool = registry[toolCall.name]

  if (!tool) {
    return {
      toolCallId: toolCall.id,
      name: toolCall.name,
      content: `Error: Tool "${toolCall.name}" not found`,
      isError: true,
    }
  }

  try {
    const result = await tool(toolCall.arguments)
    const content =
      typeof result === 'string'
        ? result
        : JSON.stringify(result, null, 2)

    return {
      toolCallId: toolCall.id,
      name: toolCall.name,
      content,
      isError: false,
    }
  } catch (error) {
    const errorMsg =
      error instanceof Error ? error.message : String(error)

    return {
      toolCallId: toolCall.id,
      name: toolCall.name,
      content: `Error executing ${toolCall.name}: ${errorMsg}`,
      isError: true,
    }
  }
}

/**
 * Execute multiple tool calls in sequence
 *
 * @param toolCalls - Array of tool calls
 * @param registry - Available tools
 * @param parallelLimit - Max concurrent executions (default: 1 = sequential)
 * @returns Array of results in same order
 */
export async function executeToolCalls(
  toolCalls: ParsedToolCall[],
  registry: ToolRegistry,
  parallelLimit: number = 1
): Promise<ToolCallResult[]> {
  if (parallelLimit <= 1) {
    // Sequential execution
    const results: ToolCallResult[] = []
    for (const toolCall of toolCalls) {
      const result = await executeToolCall(toolCall, registry)
      results.push(result)
    }
    return results
  }

  // Parallel execution with limit
  const results: ToolCallResult[] = new Array(toolCalls.length)
  let completed = 0

  return new Promise((resolve, reject) => {
    let executing = 0

    const executeNext = async (index: number) => {
      if (index >= toolCalls.length) {
        if (completed === toolCalls.length) {
          resolve(results)
        }
        return
      }

      executing++
      const toolCall = toolCalls[index]

      try {
        results[index] = await executeToolCall(toolCall, registry)
      } catch (error) {
        results[index] = {
          toolCallId: toolCall.id,
          name: toolCall.name,
          content: `Error: ${error instanceof Error ? error.message : String(error)}`,
          isError: true,
        }
      }

      completed++
      executing--

      if (executing < parallelLimit && index + 1 < toolCalls.length) {
        executeNext(index + 1)
      } else if (completed === toolCalls.length) {
        resolve(results)
      }
    }

    // Start parallel batch
    for (let i = 0; i < Math.min(parallelLimit, toolCalls.length); i++) {
      executeNext(i)
    }
  })
}

/**
 * Executor loop: LLM → parse tools → execute → re-send results
 *
 * @param maxTurns - Max iterations (default: 10)
 * @param registry - Available tools
 * @returns Final content and execution summary
 */
export interface ExecutorLoopConfig {
  maxTurns?: number
  parallelLimit?: number
  debug?: boolean
}

export interface ExecutorLoopResult {
  finalContent: string
  totalTurns: number
  totalToolCalls: number
  errors: string[]
}

export async function executeToolLoop(
  initialContent: string,
  registry: ToolRegistry,
  onTurn?: (turn: number, toolCalls: ParsedToolCall[], results: ToolCallResult[]) => void,
  config: ExecutorLoopConfig = {}
): Promise<ExecutorLoopResult> {
  const maxTurns = config.maxTurns ?? 10
  const parallelLimit = config.parallelLimit ?? 1
  const debug = config.debug ?? false

  let currentContent = initialContent
  let totalToolCalls = 0
  let errors: string[] = []
  let turn = 0

  for (turn = 0; turn < maxTurns; turn++) {
    // Parse tool calls from current content
    const { textContent, toolCalls } = parseToolCallsFromContent(currentContent)
    currentContent = textContent

    if (toolCalls.length === 0) {
      // No more tool calls, stop
      if (debug) {
        console.log(`[ToolLoop] No tool calls in turn ${turn}, stopping`)
      }
      break
    }

    totalToolCalls += toolCalls.length

    // Execute all tool calls
    const results = await executeToolCalls(toolCalls, registry, parallelLimit)

    // Call callback if provided
    if (onTurn) {
      onTurn(turn, toolCalls, results)
    }

    // Track errors
    results.forEach((result) => {
      if (result.isError) {
        errors.push(`${result.name}: ${result.content}`)
      }
    })

    if (debug) {
      console.log(
        `[ToolLoop] Turn ${turn}: ${toolCalls.length} tools, ${results.filter(r => !r.isError).length} OK`
      )
    }

    // In real scenario, would re-send results to LLM
    // For now, just continue with remaining content
  }

  return {
    finalContent: currentContent,
    totalTurns: turn,
    totalToolCalls,
    errors,
  }
}
