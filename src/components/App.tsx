import React from 'react'
import { Box, Text } from 'ink'
import type { Tool } from '../tools/types.js'
import type { Skill } from '../core/skillLoader.js'
import { REPL } from './REPL.js'

interface AppProps {
  tools: Tool[]
  skills: Skill[]
  resumeSessionId?: string
}

export function App({ tools, skills, resumeSessionId }: AppProps) {
  const info = [
    `${tools.length} tools`,
    skills.length > 0 ? `${skills.length} skills` : null,
  ].filter(Boolean).join(', ')

  return (
    <Box flexDirection="column">
      <Box borderStyle="single" borderColor="cyan" paddingX={1}>
        <Text color="cyan" bold>Mini Agent</Text>
        <Text> — </Text>
        <Text dimColor>{info} loaded (Ctrl+C to exit)</Text>
      </Box>
      <REPL tools={tools} skills={skills} resumeSessionId={resumeSessionId} />
    </Box>
  )
}
