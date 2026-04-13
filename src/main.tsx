import React from 'react'
import { render } from 'ink'
import { App } from './components/App.js'
import { loadAllTools } from './core/toolLoader.js'

export async function startApp(resumeSessionId?: string) {
  const tools = await loadAllTools()

  const { waitUntilExit } = render(
    <App tools={tools} resumeSessionId={resumeSessionId} />,
  )
  return waitUntilExit()
}
