import * as fs from 'fs/promises'
import * as path from 'path'
import { pathToFileURL } from 'url'
import type { Tool } from '../tools/types.js'
import type { SkillMeta } from './skillLoader.js'
import type { McpServerConfig } from './mcpClient.js'
import type { HookEvent, HookFn } from './hooks.js'
import { hookBus } from './hooks.js'
import { loadToolsFromDir } from './toolLoader.js'
import { loadMetaFromDir } from './skillLoader.js'

// ── Plugin manifest types ──

export interface PluginManifest {
  name: string
  version?: string
  description?: string
  author?: string
  tools?: string
  skills?: string
  mcpServers?: string | Record<string, McpServerConfig>
  hooks?: Partial<Record<HookEvent, string>>
}

export interface PluginInfo {
  name: string
  version: string
  description: string
  author: string
  path: string
  enabled: boolean
  tools: number
  skills: number
  mcpServers: number
  hooks: number
}

export interface PluginLoadResult {
  tools: Tool[]
  skillMetas: SkillMeta[]
  mcpServers: Record<string, McpServerConfig>
  plugins: PluginInfo[]
}

// ── Plugin state (persisted in .mini-agent/plugins.json) ──

interface PluginState {
  enabled: boolean
  source: 'local' | 'git'
  path: string
}

type PluginsJson = Record<string, PluginState>

async function loadPluginsJson(): Promise<PluginsJson> {
  const filePath = path.join(process.cwd(), '.mini-agent', 'plugins.json')
  try {
    const raw = await fs.readFile(filePath, 'utf-8')
    return JSON.parse(raw) as PluginsJson
  } catch {
    return {}
  }
}

function isPluginEnabled(name: string, state: PluginsJson): boolean {
  const entry = state[name]
  // Default: enabled unless explicitly disabled
  return entry ? entry.enabled !== false : true
}

// ── Directory scanning ──

function getPluginDirs(): string[] {
  const cwd = process.cwd()
  return [
    path.join(cwd, 'plugins'),
    path.join(cwd, '.mini-agent', 'plugins'),
  ]
}

async function discoverPlugins(
  dirs: string[],
): Promise<{ name: string; dir: string; manifest: PluginManifest }[]> {
  const found: { name: string; dir: string; manifest: PluginManifest }[] = []

  for (const parentDir of dirs) {
    let entries: string[]
    try {
      entries = await fs.readdir(parentDir)
    } catch {
      continue
    }

    for (const entry of entries) {
      if (entry.startsWith('_') || entry.startsWith('.')) continue

      const pluginDir = path.join(parentDir, entry)
      const stat = await fs.stat(pluginDir).catch(() => null)
      if (!stat?.isDirectory()) continue

      const manifestPath = path.join(pluginDir, 'plugin.json')
      try {
        const raw = await fs.readFile(manifestPath, 'utf-8')
        const manifest = JSON.parse(raw) as PluginManifest
        if (!manifest.name) {
          console.warn(`[plugin] Skipping ${entry}: plugin.json missing "name"`)
          continue
        }
        found.push({ name: manifest.name, dir: pluginDir, manifest })
      } catch {
        // No plugin.json or invalid — skip silently
      }
    }
  }

  return found
}

// ── Hook loading ──

async function loadHookFile(
  filePath: string,
  event: HookEvent,
): Promise<HookFn | null> {
  try {
    const fileUrl = pathToFileURL(filePath).href
    const mod = await import(fileUrl)
    const fn = mod.default || mod[Object.keys(mod)[0]!]
    if (typeof fn !== 'function') {
      console.warn(`[plugin] Hook ${filePath} does not export a function`)
      return null
    }
    return fn as HookFn
  } catch (err) {
    console.warn(`[plugin] Failed to load hook ${filePath}: ${(err as Error).message}`)
    return null
  }
}

// ── MCP config loading ──

async function loadMcpFromPlugin(
  pluginDir: string,
  mcpField: string | Record<string, McpServerConfig>,
): Promise<Record<string, McpServerConfig>> {
  if (typeof mcpField === 'object') {
    return mcpField
  }
  // It's a path to a JSON file
  const filePath = path.join(pluginDir, mcpField)
  try {
    const raw = await fs.readFile(filePath, 'utf-8')
    const parsed = JSON.parse(raw) as { mcpServers?: Record<string, McpServerConfig> }
    return parsed.mcpServers ?? {}
  } catch (err) {
    console.warn(`[plugin] Failed to load MCP config ${filePath}: ${(err as Error).message}`)
    return {}
  }
}

// ── Main loader ──

export async function loadAllPlugins(): Promise<PluginLoadResult> {
  const result: PluginLoadResult = {
    tools: [],
    skillMetas: [],
    mcpServers: {},
    plugins: [],
  }

  const dirs = getPluginDirs()
  const state = await loadPluginsJson()
  const discovered = await discoverPlugins(dirs)

  if (discovered.length === 0) return result

  for (const { name, dir, manifest } of discovered) {
    if (!isPluginEnabled(name, state)) {
      console.log(`[plugin] "${name}" is disabled, skipping`)
      continue
    }

    let toolCount = 0
    let skillCount = 0
    let mcpCount = 0
    let hookCount = 0

    // Load tools
    if (manifest.tools) {
      const toolsDir = path.join(dir, manifest.tools)
      const tools = await loadToolsFromDir(toolsDir)
      result.tools.push(...tools)
      toolCount = tools.length
    }

    // Load skills
    if (manifest.skills) {
      const skillsDir = path.join(dir, manifest.skills)
      const metas = await loadMetaFromDir(skillsDir)
      result.skillMetas.push(...metas)
      skillCount = metas.length
    }

    // Load MCP servers
    if (manifest.mcpServers) {
      const servers = await loadMcpFromPlugin(dir, manifest.mcpServers)
      Object.assign(result.mcpServers, servers)
      mcpCount = Object.keys(servers).length
    }

    // Load hooks
    if (manifest.hooks) {
      for (const [event, hookPath] of Object.entries(manifest.hooks)) {
        if (!hookPath) continue
        const fullPath = path.join(dir, hookPath)
        const fn = await loadHookFile(fullPath, event as HookEvent)
        if (fn) {
          hookBus.register(event as HookEvent, fn)
          hookCount++
        }
      }
    }

    const parts: string[] = []
    if (toolCount > 0) parts.push(`${toolCount} tools`)
    if (skillCount > 0) parts.push(`${skillCount} skills`)
    if (mcpCount > 0) parts.push(`${mcpCount} MCP`)
    if (hookCount > 0) parts.push(`${hookCount} hooks`)

    console.log(
      `[plugin] Loaded "${name}" (${parts.join(', ') || 'empty'})`,
    )

    result.plugins.push({
      name,
      version: manifest.version ?? '0.0.0',
      description: manifest.description ?? '',
      author: manifest.author ?? '',
      path: dir,
      enabled: true,
      tools: toolCount,
      skills: skillCount,
      mcpServers: mcpCount,
      hooks: hookCount,
    })
  }

  return result
}
