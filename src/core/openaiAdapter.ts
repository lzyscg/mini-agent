import OpenAI from 'openai'
import type { Message, AssistantMessage, ToolCall } from '../types.js'
import type { Tool } from '../tools/types.js'
import { toolToOpenAISchema } from '../tools/types.js'

let client: OpenAI | null = null

function getClient(): OpenAI {
  if (!client) {
    client = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
      baseURL: process.env.OPENAI_BASE_URL || undefined,
    })
  }
  return client
}

function getModel(): string {
  return process.env.MODEL_NAME || 'gpt-4o'
}

export interface CallModelResult {
  message: AssistantMessage
  textChunks: string[]
}

export interface CallModelOptions {
  model?: string
}

/**
 * Call the model with streaming, yielding text chunks as they arrive.
 * Returns the fully assembled assistant message (with tool_calls if any).
 */
export async function* callModelStreaming(
  messages: Message[],
  tools: Tool[],
  options?: CallModelOptions,
): AsyncGenerator<{ type: 'text_delta'; text: string }, CallModelResult> {
  const openai = getClient()

  const toolSchemas = tools.map(toolToOpenAISchema)

  const stream = await openai.chat.completions.create({
    model: options?.model || getModel(),
    messages: messages as OpenAI.ChatCompletionMessageParam[],
    tools: toolSchemas.length > 0 ? toolSchemas : undefined,
    stream: true,
  })

  let contentParts: string[] = []
  const toolCallAccumulators = new Map<
    number,
    { id: string; name: string; arguments: string }
  >()

  for await (const chunk of stream) {
    const delta = chunk.choices[0]?.delta
    if (!delta) continue

    if (delta.content) {
      contentParts.push(delta.content)
      yield { type: 'text_delta', text: delta.content }
    }

    if (delta.tool_calls) {
      for (const tc of delta.tool_calls) {
        const existing = toolCallAccumulators.get(tc.index)
        if (existing) {
          if (tc.function?.arguments) {
            existing.arguments += tc.function.arguments
          }
        } else {
          toolCallAccumulators.set(tc.index, {
            id: tc.id || '',
            name: tc.function?.name || '',
            arguments: tc.function?.arguments || '',
          })
        }
      }
    }
  }

  const content = contentParts.join('') || null
  const toolCalls: ToolCall[] = []

  for (const [, acc] of [...toolCallAccumulators.entries()].sort(
    (a, b) => a[0] - b[0],
  )) {
    toolCalls.push({
      id: acc.id,
      type: 'function',
      function: {
        name: acc.name,
        arguments: acc.arguments,
      },
    })
  }

  const message: AssistantMessage = {
    role: 'assistant',
    content,
    ...(toolCalls.length > 0 ? { tool_calls: toolCalls } : {}),
  }

  return { message, textChunks: contentParts }
}
