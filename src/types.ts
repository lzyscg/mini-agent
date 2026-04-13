export interface SystemMessage {
  role: 'system'
  content: string
}

export interface UserMessage {
  role: 'user'
  content: string
}

export interface AssistantMessage {
  role: 'assistant'
  content: string | null
  tool_calls?: ToolCall[]
}

export interface ToolResultMessage {
  role: 'tool'
  tool_call_id: string
  content: string
}

export type Message =
  | SystemMessage
  | UserMessage
  | AssistantMessage
  | ToolResultMessage

export interface ToolCall {
  id: string
  type: 'function'
  function: {
    name: string
    arguments: string
  }
}

export interface StreamDelta {
  role?: 'assistant'
  content?: string | null
  tool_calls?: Array<{
    index: number
    id?: string
    type?: 'function'
    function?: {
      name?: string
      arguments?: string
    }
  }>
}

export interface StreamChoice {
  index: number
  delta: StreamDelta
  finish_reason: string | null
}

export interface StreamChunk {
  id: string
  choices: StreamChoice[]
}

/**
 * Events yielded by the query loop for the TUI to consume.
 */
export type QueryEvent =
  | { type: 'assistant_text'; text: string }
  | { type: 'tool_start'; toolCall: ToolCall }
  | { type: 'tool_end'; toolCallId: string; result: string }
  | { type: 'turn_complete'; messages: Message[] }
  | { type: 'error'; error: string }
  | { type: 'context_compressed'; strategy: string; tokensBefore: number; tokensAfter: number }
  | { type: 'subagent_start'; description: string }
  | { type: 'subagent_end'; description: string; result: string }
