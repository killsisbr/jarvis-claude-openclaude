/**
 * ReAct Loop Pattern
 *
 * Structured reasoning + acting loop with max turn limit
 * Adapted from OpenBrowser src/llm/react.ts
 *
 * Pattern:
 * 1. LLM generates response (with tool calls)
 * 2. Parse tool calls
 * 3. Execute tools
 * 4. Re-send results to LLM
 * 5. Repeat until stop reason or max turns
 */

export interface ToolCall {
  id: string
  name: string
  arguments: Record<string, any>
}

export interface ToolResult {
  toolCallId: string
  toolName: string
  content: string
  success: boolean
  error?: string
}

export interface LLMMessage {
  role: 'user' | 'assistant' | 'system' | 'tool'
  content: string | ToolResult[]
}

export interface ReActLoopConfig {
  maxTurns?: number
  debug?: boolean
}

export interface LoopTurnResult {
  turnNumber: number
  toolCalls: ToolCall[]
  toolResults: ToolResult[]
  finalContent: string | null
  continueLoop: boolean
}

export type StreamEventType =
  | 'loop_start'
  | 'tool_call'
  | 'tool_result'
  | 'loop_end'

export interface StreamEvent {
  type: StreamEventType
  turnNumber?: number
  toolCall?: ToolCall
  toolResult?: ToolResult
  finalContent?: string
  reason?: string
}

export type StreamCallback = (event: StreamEvent) => void | Promise<void>

export type ToolExecutor = (
  toolCall: ToolCall
) => Promise<ToolResult>

export type LoopControl = (
  turnNumber: number,
  hasToolCalls: boolean
) => boolean | Promise<boolean>

/**
 * Main ReAct loop orchestrator
 *
 * @param initialPrompt - User prompt to start with
 * @param messages - Message history
 * @param toolExecutor - Function to execute tool calls
 * @param config - Loop configuration (maxTurns, etc)
 * @param streamCallback - Stream events for real-time feedback
 * @param loopControl - Custom logic to determine loop continuation
 */
export async function executeReActLoop(
  initialPrompt: string,
  messages: LLMMessage[],
  toolExecutor: ToolExecutor,
  config: ReActLoopConfig = {},
  streamCallback?: StreamCallback,
  loopControl?: LoopControl
): Promise<LoopTurnResult> {
  const maxTurns = config.maxTurns ?? 15
  const debug = config.debug ?? false

  let turnNumber = 0
  let toolCalls: ToolCall[] = []
  let toolResults: ToolResult[] = []
  let finalContent: string | null = null

  // Default loop control: max 15 turns or no tool calls
  if (!loopControl) {
    loopControl = (turn: number, hasTools: boolean) => {
      return turn < maxTurns && hasTools
    }
  }

  while (turnNumber < maxTurns) {
    turnNumber++

    if (debug) {
      console.log(`[ReAct] Turn ${turnNumber}/${maxTurns}`)
    }

    // Emit loop start event
    await streamCallback?.({
      type: 'loop_start',
      turnNumber,
    })

    // Simulate LLM call (in real use, would call actual LLM)
    // This would be injected by the REPL
    toolCalls = []

    // Check loop control condition BEFORE executing tools
    const shouldContinue = await loopControl(turnNumber, toolCalls.length > 0)

    if (!shouldContinue) {
      await streamCallback?.({
        type: 'loop_end',
        turnNumber,
        reason: 'loop_control_false'
      })
      break
    }

    // Execute tool calls (if any)
    toolResults = []
    for (const toolCall of toolCalls) {
      await streamCallback?.({
        type: 'tool_call',
        turnNumber,
        toolCall,
      })

      const result = await toolExecutor(toolCall)
      toolResults.push(result)

      await streamCallback?.({
        type: 'tool_result',
        turnNumber,
        toolResult: result,
      })

      if (debug) {
        console.log(`[ReAct] Tool: ${toolCall.name} → ${result.success ? 'OK' : 'FAIL'}`)
      }
    }

    // If no tool calls, we're done
    if (toolCalls.length === 0) {
      await streamCallback?.({
        type: 'loop_end',
        turnNumber,
        finalContent,
        reason: 'no_tool_calls'
      })
      break
    }

    // Emit loop end event before next iteration
    await streamCallback?.({
      type: 'loop_end',
      turnNumber,
      finalContent,
      reason: 'iteration_complete'
    })
  }

  // Check if max turns exceeded
  if (turnNumber >= maxTurns) {
    await streamCallback?.({
      type: 'loop_end',
      turnNumber,
      reason: 'max_turns_exceeded'
    })
  }

  return {
    turnNumber,
    toolCalls,
    toolResults,
    finalContent,
    continueLoop: false,
  }
}

/**
 * Helper: Check if response contains tool calls
 */
export function hasToolCalls(content: string): boolean {
  return content.includes('<tool_call>') && content.includes('</tool_call>')
}

/**
 * Helper: Parse tool calls from XML content
 */
export function parseToolCallsFromXml(content: string): ToolCall[] {
  const toolCalls: ToolCall[] = []
  const regex = /<tool_call>([\s\S]*?)<\/tool_call>/g
  let match

  while ((match = regex.exec(content)) !== null) {
    try {
      const json = JSON.parse(match[1])
      toolCalls.push({
        id: `call_${Math.random().toString(36).slice(2)}`,
        name: json.name || '',
        arguments: json.arguments || {},
      })
    } catch (e) {
      // Skip malformed tool calls
      if (process.env.DEBUG_REACT) {
        console.error('[ReAct] Failed to parse tool call:', match[1])
      }
    }
  }

  return toolCalls
}

/**
 * Helper: Create stream callback for logging
 */
export function createDebugStreamCallback(prefix = '[ReAct]'): StreamCallback {
  return (event: StreamEvent) => {
    switch (event.type) {
      case 'loop_start':
        console.log(`${prefix} Turn ${event.turnNumber}`)
        break
      case 'tool_call':
        console.log(`${prefix} → ${event.toolCall?.name}`)
        break
      case 'tool_result':
        console.log(
          `${prefix} ← ${event.toolResult?.success ? '✓' : '✗'} ${event.toolResult?.toolName}`
        )
        break
      case 'loop_end':
        console.log(`${prefix} Done (${event.reason})`)
        break
    }
  }
}
