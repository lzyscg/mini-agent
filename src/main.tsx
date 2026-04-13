import React from 'react'
import { render } from 'ink'
import { App } from './components/App.js'
import { loadAllTools } from './core/toolLoader.js'
import { loadAllSkillMeta } from './core/skillLoader.js'
import { createSkillTool } from './tools/skillTool.js'

export async function startApp(resumeSessionId?: string) {
  const [tools, skillMetas] = await Promise.all([
    loadAllTools(),
    loadAllSkillMeta(),
  ])

  if (skillMetas.length > 0) {
    tools.push(createSkillTool(skillMetas))
  }

  const { waitUntilExit } = render(
    <App
      tools={tools}
      skillCount={skillMetas.length}
      resumeSessionId={resumeSessionId}
    />,
  )
  return waitUntilExit()
}
