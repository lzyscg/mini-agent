import React from 'react'
import { render } from 'ink'
import { App } from './components/App.js'
import { loadAllTools } from './core/toolLoader.js'
import { loadAllSkills } from './core/skillLoader.js'

export async function startApp(resumeSessionId?: string) {
  const [tools, skills] = await Promise.all([
    loadAllTools(),
    loadAllSkills(),
  ])

  const { waitUntilExit } = render(
    <App tools={tools} skills={skills} resumeSessionId={resumeSessionId} />,
  )
  return waitUntilExit()
}
