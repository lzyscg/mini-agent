import type { Message, SystemMessage, UserMessage } from '../types.js'

/**
 * Build the full message array for an API call:
 * [system, ...history, newUserMessage]
 */
export function buildMessages(
  systemPrompt: string,
  history: Message[],
  userMessage: UserMessage,
): Message[] {
  const system: SystemMessage = { role: 'system', content: systemPrompt }

  // Filter history to only include non-system messages
  // (system is always freshly constructed)
  const filtered = history.filter((m) => m.role !== 'system')

  return [system, ...filtered, userMessage]
}

/**
 * Simple sliding-window truncation. Keeps the system message at the front
 * and the most recent N messages after it.
 */
export function truncateMessages(
  messages: Message[],
  maxMessages: number,
): Message[] {
  if (messages.length <= maxMessages) return messages

  const system = messages[0]?.role === 'system' ? messages[0] : null
  const rest = system ? messages.slice(1) : messages

  // Keep the most recent messages, ensuring tool_result messages
  // aren't orphaned from their corresponding assistant tool_calls
  const truncated = rest.slice(-maxMessages)

  // If the first message is a tool result, it's orphaned — drop messages
  // until we find a non-tool message
  let startIdx = 0
  while (
    startIdx < truncated.length &&
    truncated[startIdx]!.role === 'tool'
  ) {
    startIdx++
  }

  const cleaned = truncated.slice(startIdx)
  return system ? [system, ...cleaned] : cleaned
}
