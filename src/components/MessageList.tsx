import React from 'react'
import { Box, Text } from 'ink'
import type { Message, ToolCall } from '../types.js'

interface MessageListProps {
  messages: Message[]
  streamingText: string
}

function renderToolCall(tc: ToolCall): string {
  let argsStr = tc.function.arguments
  try {
    const parsed = JSON.parse(argsStr)
    argsStr = JSON.stringify(parsed, null, 2)
  } catch {
    // keep raw string
  }
  return `${tc.function.name}(${argsStr})`
}

function truncateContent(content: string, maxLines: number = 15): string {
  const lines = content.split('\n')
  if (lines.length <= maxLines) return content
  return (
    lines.slice(0, maxLines).join('\n') +
    `\n... (${lines.length - maxLines} more lines)`
  )
}

export function MessageList({ messages, streamingText }: MessageListProps) {
  // Only show non-system messages for display
  const displayMessages = messages.filter((m) => m.role !== 'system')

  return (
    <Box flexDirection="column" gap={1}>
      {displayMessages.map((msg, i) => {
        switch (msg.role) {
          case 'user':
            return (
              <Box key={i} flexDirection="column">
                <Text color="green" bold>You:</Text>
                <Text>{msg.content}</Text>
              </Box>
            )

          case 'assistant':
            return (
              <Box key={i} flexDirection="column">
                <Text color="cyan" bold>Assistant:</Text>
                {msg.content && <Text>{msg.content}</Text>}
                {msg.tool_calls?.map((tc) => (
                  <Box key={tc.id} flexDirection="column" marginLeft={2}>
                    <Text color="yellow">{'⚡ '}{renderToolCall(tc)}</Text>
                  </Box>
                ))}
              </Box>
            )

          case 'tool':
            return (
              <Box key={i} flexDirection="column" marginLeft={2}>
                <Text color="magenta">{'⇦ result '}<Text dimColor>[{msg.tool_call_id.slice(0, 12)}]</Text></Text>
                <Box marginLeft={2}>
                  <Text dimColor>{truncateContent(msg.content)}</Text>
                </Box>
              </Box>
            )

          default:
            return null
        }
      })}

      {streamingText && (
        <Box flexDirection="column">
          <Text color="cyan" bold>Assistant:</Text>
          <Text>{streamingText}</Text>
          <Text color="gray">▍</Text>
        </Box>
      )}
    </Box>
  )
}
