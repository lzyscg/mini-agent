import type { Message, AssistantMessage, QueryEvent } from '../types.js'
import type { Tool } from '../tools/types.js'
import { callModelStreaming } from './openaiAdapter.js'
import { runTools } from './toolRunner.js'
import { buildMessages } from './messagePipeline.js'
import { compressContext } from './compress/index.js'

function getMaxTurns(): number {
  return parseInt(process.env.MAX_TURNS ?? '50', 10)
}

function getSubAgentMaxTurns(): number {
  return parseInt(process.env.SUBAGENT_MAX_TURNS ?? '30', 10)
}

export interface QueryParams {
  userMessage: string
  history: Message[]
  tools: Tool[]
  systemPrompt: string
  model?: string
  isSubAgent?: boolean
}

/**
 * Core agent loop: call model → execute tools → repeat until no tool_calls.
 * Yields QueryEvents for the TUI to consume in real-time.
 *
 * Skills are now just tools — when the model calls `use_skill`, the content
 * flows back as a normal tool result and the loop continues naturally.
 */
export async function* queryLoop(
  params: QueryParams,
): AsyncGenerator<QueryEvent> {
  const { userMessage, tools, systemPrompt } = params

  let messages: Message[] = buildMessages(
    systemPrompt,
    params.history,
    { role: 'user', content: userMessage },
  )

  let turnCount = 0

  const maxTurns = params.isSubAgent ? getSubAgentMaxTurns() : getMaxTurns()

  while (turnCount < maxTurns) {
    turnCount++

    const compressed = await compressContext(messages)
    messages = compressed.messages
    if (compressed.strategy) {
      yield {
        type: 'context_compressed',
        strategy: compressed.strategy,
        tokensBefore: compressed.tokensBefore,
        tokensAfter: compressed.tokensAfter,
      }
    }

    let assistantMsg: AssistantMessage | undefined
    try {
      const gen = callModelStreaming(messages, tools, { model: params.model })

      while (true) {
        const { value, done } = await gen.next()
        if (done) {
          assistantMsg = (value as { message: AssistantMessage }).message
          break
        }
        if (value.type === 'text_delta') {
          yield { type: 'assistant_text', text: value.text }
        }
      }
    } catch (err) {
      yield { type: 'error', error: (err as Error).message }
      return
    }

    if (!assistantMsg) {
      yield { type: 'error', error: 'No response from model' }
      return
    }

    messages = [...messages, assistantMsg]

    if (!assistantMsg.tool_calls?.length) {
      yield { type: 'turn_complete', messages }
      return
    }

    for (const tc of assistantMsg.tool_calls) {
      yield { type: 'tool_start', toolCall: tc }
    }

    const toolResults = await runTools(assistantMsg.tool_calls, tools)

    for (const result of toolResults) {
      yield {
        type: 'tool_end',
        toolCallId: result.tool_call_id,
        result: result.content,
      }
    }

    messages = [...messages, ...toolResults]
  }

  yield { type: 'error', error: `Reached maximum turns (${maxTurns})` }
}
