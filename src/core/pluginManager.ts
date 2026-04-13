import * as fs from 'fs/promises'
import * as path from 'path'
import { execSync } from 'child_process'

// ── plugins.json state management ──

interface PluginState {
  enabled: boolean
  source: 'local' | 'git'
  path: string
}

type PluginsJson = Record<string, PluginState>

function getPluginsJsonPath(): string {
  return path.join(process.cwd(), '.mini-agent', 'plugins.json')
}

async function ensureMiniAgentDir(): Promise<void> {
  const dir = path.join(process.cwd(), '.mini-agent', 'plugins')
  await fs.mkdir(dir, { recursive: true })
}

async function readPluginsJson(): Promise<PluginsJson> {
  try {
    const raw = await fs.readFile(getPluginsJsonPath(), 'utf-8')
    return JSON.parse(raw) as PluginsJson
  } catch {
    return {}
  }
}

async function writePluginsJson(data: PluginsJson): Promise<void> {
  await ensureMiniAgentDir()
  await fs.writeFile(getPluginsJsonPath(), JSON.stringify(data, null, 2) + '\n')
}

// ── Manifest reading ──

interface PluginManifest {
  name: string
  version?: string
  description?: string
}

async function readManifest(pluginDir: string): Promise<PluginManifest | null> {
  try {
    const raw = await fs.readFile(path.join(pluginDir, 'plugin.json'), 'utf-8')
    return JSON.parse(raw) as PluginManifest
  } catch {
    return null
  }
}

// ── CLI operations ──

function isGitUrl(source: string): boolean {
  return (
    source.startsWith('https://') ||
    source.startsWith('git@') ||
    source.startsWith('http://') ||
    source.endsWith('.git')
  )
}

export async function pluginAdd(source: string): Promise<void> {
  await ensureMiniAgentDir()
  const installDir = path.join(process.cwd(), '.mini-agent', 'plugins')

  if (isGitUrl(source)) {
    // Clone from git
    const repoName = path.basename(source, '.git').replace(/[^a-zA-Z0-9_-]/g, '_')
    const targetDir = path.join(installDir, repoName)

    try {
      await fs.access(targetDir)
      console.error(`Plugin "${repoName}" already exists at ${targetDir}`)
      console.error(`Remove it first: npm start -- plugin remove ${repoName}`)
      process.exit(1)
    } catch {
      // doesn't exist — good
    }

    console.log(`Cloning ${source}...`)
    try {
      execSync(`git clone --depth 1 "${source}" "${targetDir}"`, { stdio: 'inherit' })
    } catch {
      console.error(`Failed to clone ${source}`)
      process.exit(1)
    }

    const manifest = await readManifest(targetDir)
    if (!manifest) {
      console.error(`Cloned repo has no plugin.json — removing`)
      await fs.rm(targetDir, { recursive: true, force: true })
      process.exit(1)
    }

    const state = await readPluginsJson()
    state[manifest.name] = { enabled: true, source: 'git', path: targetDir }
    await writePluginsJson(state)

    console.log(`Plugin "${manifest.name}" installed from git.`)
  } else {
    // Install from local path (copy)
    const sourcePath = path.resolve(source)
    const manifest = await readManifest(sourcePath)
    if (!manifest) {
      console.error(`No valid plugin.json found at ${sourcePath}`)
      process.exit(1)
    }

    const targetDir = path.join(installDir, manifest.name)
    await fs.cp(sourcePath, targetDir, { recursive: true })

    const state = await readPluginsJson()
    state[manifest.name] = { enabled: true, source: 'local', path: targetDir }
    await writePluginsJson(state)

    console.log(`Plugin "${manifest.name}" installed from local path.`)
  }
}

export async function pluginRemove(name: string): Promise<void> {
  const state = await readPluginsJson()
  const entry = state[name]

  if (!entry) {
    // Also check .mini-agent/plugins directly
    const dir = path.join(process.cwd(), '.mini-agent', 'plugins', name)
    try {
      await fs.access(dir)
      await fs.rm(dir, { recursive: true, force: true })
      console.log(`Plugin "${name}" removed (directory deleted).`)
      return
    } catch {
      console.error(`Plugin "${name}" not found.`)
      process.exit(1)
    }
  }

  // Remove directory if it's in .mini-agent/plugins
  if (entry.path.includes('.mini-agent')) {
    await fs.rm(entry.path, { recursive: true, force: true }).catch(() => {})
  }

  delete state[name]
  await writePluginsJson(state)
  console.log(`Plugin "${name}" removed.`)
}

export async function pluginEnable(name: string): Promise<void> {
  const state = await readPluginsJson()
  if (state[name]) {
    state[name]!.enabled = true
  } else {
    state[name] = { enabled: true, source: 'local', path: '' }
  }
  await writePluginsJson(state)
  console.log(`Plugin "${name}" enabled.`)
}

export async function pluginDisable(name: string): Promise<void> {
  const state = await readPluginsJson()
  if (state[name]) {
    state[name]!.enabled = false
  } else {
    state[name] = { enabled: false, source: 'local', path: '' }
  }
  await writePluginsJson(state)
  console.log(`Plugin "${name}" disabled. Restart agent to take effect.`)
}

export async function pluginList(): Promise<void> {
  const state = await readPluginsJson()

  // Also scan directories for plugins not in state
  const pluginDirs = [
    path.join(process.cwd(), 'plugins'),
    path.join(process.cwd(), '.mini-agent', 'plugins'),
  ]

  const allPlugins = new Map<string, { path: string; enabled: boolean; source: string; version: string; description: string }>()

  // From state file
  for (const [name, entry] of Object.entries(state)) {
    allPlugins.set(name, {
      path: entry.path,
      enabled: entry.enabled,
      source: entry.source,
      version: '',
      description: '',
    })
  }

  // Scan directories
  for (const dir of pluginDirs) {
    let entries: string[]
    try {
      entries = await fs.readdir(dir)
    } catch {
      continue
    }

    for (const entry of entries) {
      if (entry.startsWith('_') || entry.startsWith('.')) continue
      const pluginDir = path.join(dir, entry)
      const manifest = await readManifest(pluginDir)
      if (!manifest) continue

      const existing = allPlugins.get(manifest.name)
      if (existing) {
        existing.version = manifest.version ?? ''
        existing.description = manifest.description ?? ''
      } else {
        const stateEntry = state[manifest.name]
        allPlugins.set(manifest.name, {
          path: pluginDir,
          enabled: stateEntry ? stateEntry.enabled !== false : true,
          source: dir.includes('.mini-agent') ? 'installed' : 'project',
          version: manifest.version ?? '',
          description: manifest.description ?? '',
        })
      }
    }
  }

  if (allPlugins.size === 0) {
    console.log('No plugins found.\n')
    console.log('Add a plugin:')
    console.log('  npm start -- plugin add <path-or-git-url>\n')
    return
  }

  console.log('Installed plugins:\n')
  for (const [name, info] of allPlugins) {
    const status = info.enabled ? '\x1b[32m enabled\x1b[0m' : '\x1b[31mdisabled\x1b[0m'
    const ver = info.version ? ` v${info.version}` : ''
    const desc = info.description ? ` — ${info.description}` : ''
    console.log(`  ${name}${ver}  [${status}]${desc}`)
  }
  console.log('')
}

/**
 * Handle `plugin <subcommand> [args]` from CLI.
 * Returns true if a plugin command was handled.
 */
export async function handlePluginCommand(args: string[]): Promise<boolean> {
  if (args.length === 0 || args[0] !== 'plugin') return false

  const subcommand = args[1]
  const target = args[2]

  switch (subcommand) {
    case 'add':
      if (!target) {
        console.error('Usage: npm start -- plugin add <path-or-git-url>')
        process.exit(1)
      }
      await pluginAdd(target)
      return true

    case 'remove':
    case 'rm':
      if (!target) {
        console.error('Usage: npm start -- plugin remove <name>')
        process.exit(1)
      }
      await pluginRemove(target)
      return true

    case 'enable':
      if (!target) {
        console.error('Usage: npm start -- plugin enable <name>')
        process.exit(1)
      }
      await pluginEnable(target)
      return true

    case 'disable':
      if (!target) {
        console.error('Usage: npm start -- plugin disable <name>')
        process.exit(1)
      }
      await pluginDisable(target)
      return true

    case 'list':
    case 'ls':
      await pluginList()
      return true

    default:
      console.error(`Unknown plugin command: ${subcommand}`)
      console.error('Available: add, remove, enable, disable, list')
      process.exit(1)
  }
}
