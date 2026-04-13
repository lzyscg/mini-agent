import React from 'react'
import { Box, Text } from 'ink'
import type { Tool } from '../tools/types.js'
import { REPL } from './REPL.js'

interface AppProps {
  tools: Tool[]
  skillCount: number
  resumeSessionId?: string
}

export function App({ tools, skillCount, resumeSessionId }: AppProps) {
  const parts = [`${tools.length} tools`]
  if (skillCount > 0) {
    parts.push(`${skillCount} skills`)
  }

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
