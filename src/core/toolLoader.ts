import * as fs from 'fs/promises'
import * as path from 'path'
import { pathToFileURL } from 'url'
import type { Tool } from '../tools/types.js'

import { readTool } from '../tools/readTool.js'
import { writeTool } from '../tools/writeTool.js'
import { bashTool } from '../tools/bashTool.js'

const BUILTIN_TOOLS: Tool[] = [readTool, writeTool, bashTool]

/**
 * Where to scan for custom tools:
 *   1. <project>/tools/       (project-level, versioned)
 *   2. .mini-agent/tools/     (user-level, gitignored)
 */
function getCustomToolDirs(): string[] {
  const cwd = process.cwd()
  return [
    path.join(cwd, 'tools'),
    path.join(cwd, '.mini-agent', 'tools'),
  ]
}

function validateTool(obj: unknown, filePath: string): Tool | null {
  if (!obj || typeof obj !== 'object') return null
  const t = obj as Record<string, unknown>

  if (typeof t.name !== 'string' || !t.name) {
    console.warn(`[tool-loader] Skipping ${filePath}: missing "name"`)
    return null
  }
  if (typeof t.description !== 'string') {
    console.warn(`[tool-loader] Skipping ${filePath}: missing "description"`)
    return null
  }
  if (!t.parameters || typeof t.parameters !== 'object') {
    console.warn(`[tool-loader] Skipping ${filePath}: missing "parameters"`)
    return null
  }
  if (typeof t.call !== 'function') {
    console.warn(`[tool-loader] Skipping ${filePath}: missing "call" function`)
    return null
  }
  // isReadOnly is optional, default to false
  if (typeof t.isReadOnly !== 'function') {
    (t as Record<string, unknown>).isReadOnly = () => false
  }

  return t as unknown as Tool
}

async function loadToolsFromDir(dir: string): Promise<Tool[]> {
  const tools: Tool[] = []

  let entries: string[]
  try {
    entries = await fs.readdir(dir)
  } catch {
    return tools
  }

  const toolFiles = entries.filter(
    (f) => (f.endsWith('.ts') || f.endsWith('.js')) && !f.startsWith('_'),
  )

  for (const file of toolFiles) {
    const filePath = path.join(dir, file)
    try {
      const fileUrl = pathToFileURL(filePath).href
      const mod = await import(fileUrl)

      // Support: export default tool, export const tool, or export { tool }
      const toolObj = mod.default || mod.tool || mod[Object.keys(mod)[0]!]

      const validated = validateTool(toolObj, filePath)
      if (validated) {
        tools.push(validated)
      }
    } catch (err) {
      console.warn(
        `[tool-loader] Failed to load ${filePath}: ${(err as Error).message}`,
      )
    }
  }

  return tools
}

/**
 * Load all tools: built-in + custom from tool directories.
 * Custom tools with the same name as built-in tools will override them.
 */
export async function loadAllTools(): Promise<Tool[]> {
  const customDirs = getCustomToolDirs()
  const customTools: Tool[] = []

  for (const dir of customDirs) {
    const tools = await loadToolsFromDir(dir)
    customTools.push(...tools)
  }

  // Build a map: custom tools override built-in tools by name
  const toolMap = new Map<string, Tool>()

  for (const t of BUILTIN_TOOLS) {
    toolMap.set(t.name, t)
  }
  for (const t of customTools) {
    if (toolMap.has(t.name)) {
      console.log(`[tool-loader] Custom tool "${t.name}" overrides built-in`)
    }
    toolMap.set(t.name, t)
  }

  const allTools = [...toolMap.values()]

  if (customTools.length > 0) {
    const names = customTools.map((t) => t.name).join(', ')
    console.log(`[tool-loader] Loaded ${customTools.length} custom tool(s): ${names}`)
  }

  return allTools
}
