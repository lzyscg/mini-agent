import type { Message } from '../types.js'

/**
 * Rough token estimate: ~4 characters per token for English/code mixed text.
 */
export function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4)
}

/**
 * Estimate total tokens for a message array.
 * Each message has ~4 token overhead (role markers, separators).
 */
export function estimateMessageTokens(messages: Message[]): number {
  return messages.reduce((sum, m) => {
    const content = typeof m.content === 'string' ? m.content : ''
    let extra = 0
    if (m.role === 'assistant' && m.tool_calls) {
      extra = estimateTokens(JSON.stringify(m.tool_calls))
    }
    return sum + estimateTokens(content) + extra + 4
  }, 0)
}

/**
 * Get the model's context window size in tokens.
 * Override with CONTEXT_WINDOW_TOKENS env var.
 */
export function getContextWindowSize(): number {
  return parseInt(process.env.CONTEXT_WINDOW_TOKENS ?? '128000', 10)
}

/**
 * Get the model name to use for compaction/summarization.
 */
export function getCompactModel(): string {
  return process.env.COMPACT_MODEL || process.env.MODEL_NAME || 'gpt-4o'
}
