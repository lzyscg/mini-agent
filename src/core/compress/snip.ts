import type { Message } from '../../types.js'
import { estimateMessageTokens, getContextWindowSize } from '../tokens.js'

const SNIP_THRESHOLD_PCT = 0.7

interface MessageGroup {
  messages: Message[]
  tokens: number
}

/**
 * Group messages into API rounds: each round is
 * [user, assistant, ...tool_results] (one conversational turn).
 * System message is excluded from grouping.
 */
function groupByRound(messages: Message[]): { system: Message | null; groups: MessageGroup[] } {
  const system = messages[0]?.role === 'system' ? messages[0] : null
  const rest = system ? messages.slice(1) : messages

  const groups: MessageGroup[] = []
  let current: Message[] = []

  for (const m of rest) {
    if (m.role === 'user' && current.length > 0) {
      groups.push({
        messages: current,
        tokens: estimateMessageTokens(current),
      })
      current = []
    }
    current.push(m)
  }

  if (current.length > 0) {
    groups.push({
      messages: current,
      tokens: estimateMessageTokens(current),
    })
  }

  return { system, groups }
}

export interface SnipResult {
  messages: Message[]
  tokensFreed: number
}

/**
 * Level 2: Snip old message groups from the head when context exceeds 70%.
 * Removes complete conversation rounds (user + assistant + tool results)
 * from oldest to newest until below threshold.
 */
export function snipOldMessages(messages: Message[]): SnipResult {
  const threshold = getContextWindowSize() * SNIP_THRESHOLD_PCT
  const currentTokens = estimateMessageTokens(messages)

  if (currentTokens <= threshold) {
    return { messages, tokensFreed: 0 }
  }

  const { system, groups } = groupByRound(messages)

  // Always keep at least the last 2 groups (current turn context)
  const minKeep = 2
  if (groups.length <= minKeep) {
    return { messages, tokensFreed: 0 }
  }

  let tokensFreed = 0
  let removeCount = 0
  let runningTokens = currentTokens

  for (let i = 0; i < groups.length - minKeep; i++) {
    if (runningTokens <= threshold) break
    runningTokens -= groups[i]!.tokens
    tokensFreed += groups[i]!.tokens
    removeCount++
  }

  if (removeCount === 0) {
    return { messages, tokensFreed: 0 }
  }

  const kept = groups.slice(removeCount).flatMap((g) => g.messages)
  const result = system ? [system, ...kept] : kept

  return { messages: result, tokensFreed }
}
