import OpenAI from 'openai'
import type { Message } from '../../types.js'
import {
  estimateMessageTokens,
  getContextWindowSize,
  getCompactModel,
} from '../tokens.js'

const COLLAPSE_THRESHOLD_PCT = 0.85
const OLD_SEGMENT_PCT = 0.6

const COLLAPSE_PROMPT = `You are a conversation compressor. Summarize the following conversation segment into a concise but information-dense summary.

IMPORTANT — you MUST preserve:
- All file paths mentioned
- Key code snippets and changes made
- Current task status and what was being worked on
- Any errors encountered and their resolutions
- Important decisions and their rationale

Output ONLY the summary text, no preamble.`

function getClient(): OpenAI {
  return new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
    baseURL: process.env.OPENAI_BASE_URL || undefined,
  })
}

function messagesToText(messages: Message[]): string {
  return messages
    .map((m) => {
      if (m.role === 'tool') {
        return `[tool:${m.tool_call_id}] ${m.content.slice(0, 500)}`
      }
      const content = m.content ?? ''
      if (m.role === 'assistant' && m.tool_calls) {
        const calls = m.tool_calls.map((tc) => tc.function.name).join(', ')
        return `assistant: ${content}\n[called: ${calls}]`
      }
      return `${m.role}: ${content}`
    })
    .join('\n')
}

/**
 * Level 4: Collapse old conversation segments into a model-generated summary.
 * Triggered when token usage exceeds 85% of context window.
 * Splits conversation into old (60%) and new (40%) segments,
 * summarizes the old segment, and replaces it with a compact summary pair.
 */
export async function contextCollapse(messages: Message[]): Promise<Message[]> {
  const threshold = getContextWindowSize() * COLLAPSE_THRESHOLD_PCT
  const currentTokens = estimateMessageTokens(messages)

  if (currentTokens <= threshold) return messages

  const system = messages[0]?.role === 'system' ? messages[0] : null
  const rest = system ? messages.slice(1) : messages

  // Split into old and new segments by message count
  const splitPoint = Math.floor(rest.length * OLD_SEGMENT_PCT)
  if (splitPoint < 2) return messages

  const oldSegment = rest.slice(0, splitPoint)
  const newSegment = rest.slice(splitPoint)

  const segmentText = messagesToText(oldSegment)

  try {
    const client = getClient()
    const response = await client.chat.completions.create({
      model: getCompactModel(),
      messages: [
        { role: 'system', content: COLLAPSE_PROMPT },
        { role: 'user', content: segmentText },
      ],
      max_tokens: 2000,
    })

    const summary = response.choices[0]?.message?.content
    if (!summary) return messages

    const collapsed: Message[] = [
      ...(system ? [system] : []),
      {
        role: 'user' as const,
        content: `[Conversation history collapsed]\n${summary}`,
      },
      {
        role: 'assistant' as const,
        content: 'Understood. I have the context from the collapsed conversation history. Continuing with the current task.',
      },
      ...newSegment,
    ]

    return collapsed
  } catch {
    return messages
  }
}
