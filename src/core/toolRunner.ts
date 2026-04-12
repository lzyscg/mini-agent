import type { ToolCall, ToolResultMessage } from '../types.js'
import type { Tool } from '../tools/types.js'

/**
 * Execute a single tool call and return the result message.
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

  try {
    const result = await tool.call(args)
    return {
      role: 'tool',
      tool_call_id: toolCall.id,
      content: result,
    }
  } catch (err) {
    return {
      role: 'tool',
      tool_call_id: toolCall.id,
      content: `Error executing ${tool.name}: ${(err as Error).message}`,
    }
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

  // Partition into read-only and write groups (preserving order)
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

  // Run read-only tools concurrently
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

  // Run write tools sequentially
  for (const tc of writeCalls) {
    onToolStart?.(tc)
    const result = await executeTool(tc, tools)
    onToolEnd?.(tc, result.content)
    results.push(result)
  }

  return results
}
