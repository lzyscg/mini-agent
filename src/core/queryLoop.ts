import type { Message, AssistantMessage, QueryEvent } from '../types.js'
import type { Tool } from '../tools/types.js'
import { callModelStreaming } from './openaiAdapter.js'
import { runTools } from './toolRunner.js'
import { buildMessages, truncateMessages } from './messagePipeline.js'

const MAX_CONTEXT_MESSAGES = 100
const MAX_TURNS = 50

export interface QueryParams {
  userMessage: string
  history: Message[]
  tools: Tool[]
  systemPrompt: string
}

/**
 * Core agent loop: call model → execute tools → repeat until no tool_calls.
 * Yields QueryEvents for the TUI to consume in real-time.
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

  while (turnCount < MAX_TURNS) {
    turnCount++

    messages = truncateMessages(messages, MAX_CONTEXT_MESSAGES)

    let assistantMsg: AssistantMessage | undefined
    try {
      const gen = callModelStreaming(messages, tools)

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

    // Emit tool_start for each pending tool call
    for (const tc of assistantMsg.tool_calls) {
      yield { type: 'tool_start', toolCall: tc }
    }

    const toolResults = await runTools(assistantMsg.tool_calls, tools)

    // Emit tool_end for each result
    for (const result of toolResults) {
      yield {
        type: 'tool_end',
        toolCallId: result.tool_call_id,
        result: result.content,
      }
    }

    messages = [...messages, ...toolResults]
  }

  yield { type: 'error', error: `Reached maximum turns (${MAX_TURNS})` }
}
