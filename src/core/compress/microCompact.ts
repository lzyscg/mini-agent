import type { Message } from '../../types.js'

const KEEP_RECENT = 5
const PLACEHOLDER = '[Tool result cleared to save context]'

const COMPRESSIBLE_TOOLS = new Set([
  'read_file',
  'write_file',
  'bash',
  'fetch_url',
])

function isCompressible(toolCallId: string, messages: Message[]): boolean {
  // Find the assistant message that contains the tool_call for this tool result
  for (const m of messages) {
    if (m.role !== 'assistant' || !m.tool_calls) continue
    for (const tc of m.tool_calls) {
      if (tc.id !== toolCallId) continue
      const name = tc.function.name
      return COMPRESSIBLE_TOOLS.has(name) || name.startsWith('mcp__')
    }
  }
  // If we can't determine the tool, compress it anyway
  return true
}

/**
 * Level 3: Clear old tool result contents.
 * Keeps the most recent KEEP_RECENT tool results intact.
 * Older compressible tool results have their content replaced with a placeholder.
 */
export function microCompact(messages: Message[]): Message[] {
  // Collect indices of all tool-role messages
  const toolIndices: number[] = []
  for (let i = 0; i < messages.length; i++) {
    if (messages[i]!.role === 'tool') {
      toolIndices.push(i)
    }
  }

  if (toolIndices.length <= KEEP_RECENT) return messages

  // The last KEEP_RECENT tool messages are protected
  const toCompress = toolIndices.slice(0, toolIndices.length - KEEP_RECENT)
  const compressSet = new Set(toCompress)

  return messages.map((m, idx) => {
    if (!compressSet.has(idx)) return m
    if (m.role !== 'tool') return m
    if (m.content === PLACEHOLDER) return m

    if (!isCompressible(m.tool_call_id, messages)) return m

    return { ...m, content: PLACEHOLDER }
  })
}
