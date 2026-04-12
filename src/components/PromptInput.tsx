import React, { useState } from 'react'
import { Box, Text, useInput, useApp } from 'ink'

interface PromptInputProps {
  onSubmit: (text: string) => void
  isLoading: boolean
}

export function PromptInput({ onSubmit, isLoading }: PromptInputProps) {
  const [input, setInput] = useState('')
  const { exit } = useApp()

  useInput((inputChar, key) => {
    if (isLoading) return

    if (key.return) {
      const trimmed = input.trim()
      if (trimmed) {
        onSubmit(trimmed)
        setInput('')
      }
      return
    }

    if (key.backspace || key.delete) {
      setInput((prev) => prev.slice(0, -1))
      return
    }

    if (key.ctrl && inputChar === 'c') {
      exit()
      return
    }

    if (key.ctrl || key.meta) return

    if (inputChar) {
      setInput((prev) => prev + inputChar)
    }
  })

  if (isLoading) {
    return (
      <Box>
        <Text color="yellow">⟳ thinking...</Text>
      </Box>
    )
  }

  return (
    <Box>
      <Text color="green" bold>{'> '}</Text>
      <Text>{input}</Text>
      <Text color="gray">█</Text>
    </Box>
  )
}
