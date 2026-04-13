import type { ToolCall, ToolResultMessage } from '../types.js'
import type { Tool } from '../tools/types.js'
import { hookBus } from './hooks.js'
import type { BeforeToolCallContext, AfterToolCallContext } from './hooks.js'

/**
 * Execute a single tool call with before/after hooks.
 */
async function executeTool(
  toolCall: ToolCall,
  tools: Tool[],
): Promise<ToolResultMessage> {
  const tool = tools.find((t) => t.name === toolCall.function.name)

  if (!tool) {
    return {
      role: 'tool',
      tool_call_id: toolCall.id,
      content: `Error: Unknown tool "${toolCall.function.name}"`,
    }
  }

  let args: Record<string, unknown>
  try {
    args = JSON.parse(toolCall.function.arguments)
  } catch {
    return {
      role: 'tool',
      tool_call_id: toolCall.id,
      content: `Error: Invalid JSON arguments: ${toolCall.function.arguments}`,
    }
  }

  // ── before_tool_call hook ──
  const beforeCtx: BeforeToolCallContext = {
    toolName: tool.name,
    args,
    aborted: false,
  }
  await hookBus.emit({ event: 'before_tool_call', data: beforeCtx })

  if (beforeCtx.aborted) {
    return {
      role: 'tool',
      tool_call_id: toolCall.id,
      content: beforeCtx.abortReason ?? `Tool "${tool.name}" was blocked by a hook.`,
    }
  }

  // ── Execute ──
  const startTime = Date.now()
  let result: string

  try {
    result = await tool.call(args)
  } catch (err) {
    result = `Error executing ${tool.name}: ${(err as Error).message}`
  }

  const durationMs = Date.now() - startTime

  // ── after_tool_call hook ──
  const afterCtx: AfterToolCallContext = {
    toolName: tool.name,
    args,
    result,
    durationMs,
  }
  await hookBus.emit({ event: 'after_tool_call', data: afterCtx })

  return {
    role: 'tool',
    tool_call_id: toolCall.id,
    content: result,
  }
}

/**
 * Run all tool calls and return results. Read-only tools run concurrently,
 * write tools run sequentially.
 */
export async function runTools(
  toolCalls: ToolCall[],
  tools: Tool[],
  onToolStart?: (tc: ToolCall) => void,
  onToolEnd?: (tc: ToolCall, result: string) => void,
): Promise<ToolResultMessage[]> {
  const results: ToolResultMessage[] = []

  const readOnlyCalls: ToolCall[] = []
  const writeCalls: ToolCall[] = []

  for (const tc of toolCalls) {
    const tool = tools.find((t) => t.name === tc.function.name)
    let args: Record<string, unknown> = {}
    try {
      args = JSON.parse(tc.function.arguments)
    } catch {
      // will be caught during execution
    }
    if (tool?.isReadOnly(args)) {
      readOnlyCalls.push(tc)
    } else {
      writeCalls.push(tc)
    }
  }

  if (readOnlyCalls.length > 0) {
    const readResults = await Promise.all(
      readOnlyCalls.map(async (tc) => {
        onToolStart?.(tc)
        const result = await executeTool(tc, tools)
        onToolEnd?.(tc, result.content)
        return result
      }),
    )
    results.push(...readResults)
  }

  for (const tc of writeCalls) {
    onToolStart?.(tc)
    const result = await executeTool(tc, tools)
    onToolEnd?.(tc, result.content)
    results.push(result)
  }

  return results
}
