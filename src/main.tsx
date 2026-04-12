import React from 'react'
import { render } from 'ink'
import { App } from './components/App.js'
import { readTool } from './tools/readTool.js'
import { writeTool } from './tools/writeTool.js'
import { bashTool } from './tools/bashTool.js'
import type { Tool } from './tools/types.js'

const tools: Tool[] = [readTool, writeTool, bashTool]

export function startApp(resumeSessionId?: string) {
  const { waitUntilExit } = render(
    <App tools={tools} resumeSessionId={resumeSessionId} />,
  )
  return waitUntilExit()
}
