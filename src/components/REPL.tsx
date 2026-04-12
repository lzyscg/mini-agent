import React, { useState, useCallback, useEffect, useRef } from 'react'
import { Box, Text } from 'ink'
import type { Message } from '../types.js'
import type { Tool } from '../tools/types.js'
import { queryLoop } from '../core/queryLoop.js'
import { getSystemPrompt } from '../prompts.js'
import { MessageList } from './MessageList.js'
import { PromptInput } from './PromptInput.js'
import {
  saveConversation,
  loadConversation,
  generateSessionId,
} from '../storage.js'

interface REPLProps {
  tools: Tool[]
  resumeSessionId?: string
}

export function REPL({ tools, resumeSessionId }: REPLProps) {
  const [messages, setMessages] = useState<Message[]>([])
  const [streamingText, setStreamingText] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [sessionReady, setSessionReady] = useState(false)

  const sessionIdRef = useRef<string>(resumeSessionId || generateSessionId())
  const createdAtRef = useRef<string>(new Date().toISOString())

  // Load conversation on mount if resuming
  useEffect(() => {
    async function load() {
      if (resumeSessionId) {
        const data = await loadConversation(resumeSessionId)
        if (data) {
          setMessages(data.messages)
          createdAtRef.current = data.createdAt
        }
      }
      setSessionReady(true)
    }
    load()
  }, [resumeSessionId])

  const handleSubmit = useCallback(
    async (userInput: string) => {
      if (isLoading) return

      const userMessage: Message = { role: 'user', content: userInput }
      const updatedHistory = [...messages, userMessage]
      setMessages(updatedHistory)
      setIsLoading(true)
      setStreamingText('')

      let accumulated = ''
      const displayMessages = [...updatedHistory]

      try {
        const gen = queryLoop({
          userMessage: userInput,
          history: messages,
          tools,
          systemPrompt: getSystemPrompt(),
        })

        for await (const event of gen) {
          switch (event.type) {
            case 'assistant_text':
              accumulated += event.text
              setStreamingText(accumulated)
              break

            case 'tool_start':
              break

            case 'tool_end':
              break

            case 'turn_complete': {
              const finalMessages = event.messages.filter(
                (m) => m.role !== 'system',
              )
              setMessages(finalMessages)
              setStreamingText('')

              // Persist to disk
              await saveConversation(
                sessionIdRef.current,
                finalMessages,
                createdAtRef.current,
              )
              break
            }

            case 'error':
              displayMessages.push({
                role: 'assistant',
                content: `Error: ${event.error}`,
              })
              setMessages([...displayMessages])
              break
          }
        }
      } catch (err) {
        displayMessages.push({
          role: 'assistant',
          content: `Unexpected error: ${(err as Error).message}`,
        })
        setMessages([...displayMessages])
      } finally {
        setIsLoading(false)
        setStreamingText('')
      }
    },
    [messages, isLoading, tools],
  )

  if (!sessionReady) {
    return (
      <Box padding={1}>
        <Text color="yellow">Loading conversation...</Text>
      </Box>
    )
  }

  return (
    <Box flexDirection="column" padding={1}>
      <Box marginBottom={1}>
        <Text dimColor>Session: {sessionIdRef.current.slice(0, 8)}</Text>
      </Box>
      <MessageList messages={messages} streamingText={streamingText} />
      <Box marginTop={1}>
        <PromptInput onSubmit={handleSubmit} isLoading={isLoading} />
      </Box>
    </Box>
  )
}
