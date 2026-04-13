import React from 'react'
import { render } from 'ink'
import { App } from './components/App.js'
import { loadAllTools } from './core/toolLoader.js'
import { loadAllSkillMeta } from './core/skillLoader.js'
import { createSkillTool } from './tools/skillTool.js'
import { loadMcpTools, closeMcpConnections } from './core/mcpClient.js'

export async function startApp(resumeSessionId?: string) {
  const [builtinTools, skillMetas, mcpResult] = await Promise.all([
    loadAllTools(),
    loadAllSkillMeta(),
    loadMcpTools(),
  ])

  const tools = [...builtinTools, ...mcpResult.tools]

  if (skillMetas.length > 0) {
    tools.push(createSkillTool(skillMetas))
  }

  // Clean up MCP connections on exit
  const cleanup = () => { closeMcpConnections().catch(() => {}) }
  process.on('exit', cleanup)
  process.on('SIGINT', () => { cleanup(); process.exit(0) })
  process.on('SIGTERM', () => { cleanup(); process.exit(0) })

  const { waitUntilExit } = render(
    <App
      tools={tools}
      skillCount={skillMetas.length}
      mcpServerCount={mcpResult.serverCount}
      resumeSessionId={resumeSessionId}
    />,
  )

  try {
    await waitUntilExit()
  } finally {
    await closeMcpConnections()
  }
}
