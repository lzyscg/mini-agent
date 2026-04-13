import type { Message } from '../../types.js'
import { estimateMessageTokens } from '../tokens.js'
import { applyToolResultBudget } from './toolResultBudget.js'
import { snipOldMessages } from './snip.js'
import { microCompact } from './microCompact.js'
import { contextCollapse } from './contextCollapse.js'
import { autoCompact } from './autoCompact.js'

export interface CompressResult {
  messages: Message[]
  strategy: string | null
  tokensBefore: number
  tokensAfter: number
}

/**
 * Five-level progressive context compression pipeline.
 * Applied before each model call to keep the conversation within context limits.
 *
 * 1. Tool Result Budget  — truncate oversized tool results
 * 2. Snip                — remove oldest conversation rounds
 * 3. Microcompact        — clear old tool result content
 * 4. Context Collapse    — summarize old segments via model
 * 5. Autocompact         — full conversation summary as last resort
 */
export async function compressContext(messages: Message[]): Promise<CompressResult> {
  const tokensBefore = estimateMessageTokens(messages)
  let result = messages
  let strategy: string | null = null

  // Level 1: always applied (cheap, no model call)
  result = applyToolResultBudget(result)

  // Level 2: snip if over 70% threshold
  const snipResult = snipOldMessages(result)
  if (snipResult.tokensFreed > 0) {
    result = snipResult.messages
    strategy = 'snip'
  }

  // Level 3: always applied (cheap, no model call)
  result = microCompact(result)

  // Level 4: collapse if still over 85% threshold
  const preCollapse = result.length
  result = await contextCollapse(result)
  if (result.length < preCollapse) {
    strategy = 'collapse'
  }

  // Level 5: autocompact if still near limit
  const preAutocompact = result.length
  result = await autoCompact(result)
  if (result.length < preAutocompact) {
    strategy = 'autocompact'
  }

  const tokensAfter = estimateMessageTokens(result)

  if (!strategy && tokensAfter < tokensBefore) {
    strategy = 'budget+micro'
  }

  return { messages: result, strategy, tokensBefore, tokensAfter }
}
