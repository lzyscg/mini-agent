import React from 'react'
import { render } from 'ink'
import { App } from './components/App.js'
import { loadAllTools } from './core/toolLoader.js'
import { loadAllSkillMeta } from './core/skillLoader.js'
import { createSkillTool } from './tools/skillTool.js'
import { createAgentTool } from './tools/agentTool.js'
import { loadMcpTools, closeMcpConnections } from './core/mcpClient.js'
import { loadAllPlugins } from './core/pluginLoader.js'

export async function startApp(resumeSessionId?: string) {
  // Load all extensions in parallel
  const [builtinTools, skillMetas, pluginResult] = await Promise.all([
    loadAllTools(),
    loadAllSkillMeta(),
    loadAllPlugins(),
  ])

  // Merge plugin MCP configs with file-based config, then connect
  const mcpResult = await loadMcpTools(
    Object.keys(pluginResult.mcpServers).length > 0
      ? pluginResult.mcpServers
      : undefined,
  )

  // Assemble tools: builtin + custom → plugin tools → MCP tools
  const tools = [...builtinTools, ...pluginResult.tools, ...mcpResult.tools]

  // Merge skills: directory skills + plugin skills
  const allSkillMetas = [...skillMetas, ...pluginResult.skillMetas]
  if (allSkillMetas.length > 0) {
    tools.push(createSkillTool(allSkillMetas))
  }

  // Sub-agent tool: snapshot current tools so sub-agents get everything except `agent` itself
  tools.push(createAgentTool([...tools]))

  // Clean up MCP connections on exit
  const cleanup = () => { closeMcpConnections().catch(() => {}) }
  process.on('exit', cleanup)
  process.on('SIGINT', () => { cleanup(); process.exit(0) })
  process.on('SIGTERM', () => { cleanup(); process.exit(0) })

  const { waitUntilExit } = render(
    <App
      tools={tools}
      skillCount={allSkillMetas.length}
      mcpServerCount={mcpResult.serverCount}
      pluginCount={pluginResult.plugins.length}
      resumeSessionId={resumeSessionId}
    />,
  )

  try {
    await waitUntilExit()
  } finally {
    await closeMcpConnections()
  }
}
