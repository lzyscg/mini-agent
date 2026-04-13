import OpenAI from 'openai'
import type { Message } from '../../types.js'
import {
  estimateMessageTokens,
  getContextWindowSize,
  getCompactModel,
} from '../tokens.js'

const BUFFER_TOKENS = 10_000
const MAX_COMPACT_FAILURES = 3

const AUTOCOMPACT_PROMPT = `You are a conversation compressor performing an emergency context compaction.
Summarize the ENTIRE conversation below into a comprehensive summary.

You MUST preserve ALL of the following:
- Complete list of files created, modified, or read (with full paths)
- All code changes made and their purpose
- Current task status: what is done, what remains
- Any active errors, bugs, or issues being debugged
- Important architectural decisions
- User preferences and requirements stated
- Any environment details (paths, configs, tools in use)

Be thorough — this summary will REPLACE the entire conversation history.
The agent must be able to continue working seamlessly from this summary alone.

Output ONLY the summary, no preamble or explanation.`

let failureCount = 0

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
        return `[tool:${m.tool_call_id}] ${m.content.slice(0, 300)}`
      }
      const content = m.content ?? ''
      if (m.role === 'assistant' && m.tool_calls) {
        const calls = m.tool_calls.map((tc) => `${tc.function.name}(${tc.function.arguments.slice(0, 100)})`).join(', ')
        return `assistant: ${content}\n[called: ${calls}]`
      }
      return `${m.role}: ${content}`
    })
    .join('\n')
}

/**
 * Level 5: Last-resort full conversation compaction.
 * Triggered when all previous levels still leave tokens above
 * (contextWindow - BUFFER_TOKENS). Calls the model to generate
 * a comprehensive summary and replaces the entire history.
 */
export async function autoCompact(messages: Message[]): Promise<Message[]> {
  const limit = getContextWindowSize() - BUFFER_TOKENS
  const currentTokens = estimateMessageTokens(messages)

  if (currentTokens <= limit) return messages
  if (failureCount >= MAX_COMPACT_FAILURES) return messages

  const system = messages[0]?.role === 'system' ? messages[0] : null
  const rest = system ? messages.slice(1) : messages
  const conversationText = messagesToText(rest)

  try {
    const client = getClient()
    const response = await client.chat.completions.create({
      model: getCompactModel(),
      messages: [
        { role: 'system', content: AUTOCOMPACT_PROMPT },
        { role: 'user', content: conversationText },
      ],
      max_tokens: 4000,
    })

    const summary = response.choices[0]?.message?.content
    if (!summary) {
      failureCount++
      return messages
    }

    failureCount = 0

    const compacted: Message[] = [
      ...(system ? [system] : []),
      {
        role: 'user' as const,
        content: `[Full conversation compacted]\n\n${summary}\n\nPlease continue from where we left off.`,
      },
      {
        role: 'assistant' as const,
        content: 'Understood. I have the full context from the compacted conversation. Ready to continue.',
      },
    ]

    return compacted
  } catch {
    failureCount++
    return messages
  }
}
