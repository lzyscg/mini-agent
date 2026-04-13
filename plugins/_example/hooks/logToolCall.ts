import type { HookContext } from '../../../src/core/hooks.js'

/**
 * Example hook: logs every tool call with timing info.
 * This demonstrates the after_tool_call hook point.
 */
export default async function logToolCall(ctx: HookContext): Promise<void> {
  if (ctx.event !== 'after_tool_call') return

  const { toolName, durationMs } = ctx.data
  console.log(`[example-plugin] Tool "${toolName}" completed in ${durationMs}ms`)
}
