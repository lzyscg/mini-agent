import type { Message, AssistantMessage, QueryEvent } from '../types.js'
import type { Tool } from '../tools/types.js'
import type { Skill } from './skillLoader.js'
import { callModelStreaming } from './openaiAdapter.js'
import { runTools } from './toolRunner.js'
import { buildMessages, truncateMessages } from './messagePipeline.js'
import { matchSkills, formatSkillContext } from './skillMatcher.js'

const MAX_CONTEXT_MESSAGES = 100
const MAX_TURNS = 50

export interface QueryParams {
  userMessage: string
  history: Message[]
  tools: Tool[]
  skills: Skill[]
  systemPrompt: string
}

/**
 * Core agent loop: call model → execute tools → repeat until no tool_calls.
 * Yields QueryEvents for the TUI to consume in real-time.
 */
export async function* queryLoop(
  params: QueryParams,
): AsyncGenerator<QueryEvent> {
  const { userMessage, tools, skills, systemPrompt } = params

  let messages: Message[] = buildMessages(
    systemPrompt,
    params.history,
    { role: 'user', content: userMessage },
  )

  // Match skills based on user input and inject as context
  if (skills.length > 0) {
    const matched = matchSkills(userMessage, skills)
    if (matched.length > 0) {
      const skillContext = formatSkillContext(matched)
      // Insert skill context right after the system message
      const systemMsg = messages[0]!
      const rest = messages.slice(1)
      messages = [
        systemMsg,
        { role: 'user', content: skillContext },
        { role: 'assistant', content: 'I will follow the activated skill guidelines.' },
        ...rest,
      ]
    }
  }

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

  yield { type: 'error', error: `Reached maximum turns (${MAX_TURNS})` }
}
