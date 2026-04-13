import type { Message } from '../../types.js'

const MAX_TOOL_RESULT_CHARS = 30_000
const PREVIEW_SIZE = 2_000

/**
 * Level 1: Truncate oversized tool results.
 * Any tool result exceeding MAX_TOOL_RESULT_CHARS is cut to PREVIEW_SIZE
 * with a truncation notice. Does not change array structure.
 */
export function applyToolResultBudget(messages: Message[]): Message[] {
  return messages.map((m) => {
    if (m.role !== 'tool') return m
    if (m.content.length <= MAX_TOOL_RESULT_CHARS) return m

    const preview = m.content.slice(0, PREVIEW_SIZE)
    const total = m.content.length
    return {
      ...m,
      content: `${preview}\n\n...[truncated, showing first ${PREVIEW_SIZE} chars of ${total} total]`,
    }
  })
}
