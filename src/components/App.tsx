import React from 'react'
import { Box, Text } from 'ink'
import type { Tool } from '../tools/types.js'
import { REPL } from './REPL.js'

interface AppProps {
  tools: Tool[]
  skillCount: number
  mcpServerCount: number
  pluginCount: number
  resumeSessionId?: string
}

export function App({ tools, skillCount, mcpServerCount, pluginCount, resumeSessionId }: AppProps) {
  const parts = [`${tools.length} tools`]
  if (skillCount > 0) parts.push(`${skillCount} skills`)
  if (mcpServerCount > 0) parts.push(`${mcpServerCount} MCP`)
  if (pluginCount > 0) parts.push(`${pluginCount} plugins`)

  return (
    <Box flexDirection="column">
      <Box borderStyle="single" borderColor="cyan" paddingX={1}>
        <Text color="cyan" bold>Mini Agent</Text>
        <Text> — </Text>
        <Text dimColor>{parts.join(', ')} loaded (Ctrl+C to exit)</Text>
      </Box>
      <REPL tools={tools} resumeSessionId={resumeSessionId} />
    </Box>
  )
}
