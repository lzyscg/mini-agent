import * as fs from 'fs/promises'
import * as path from 'path'

/**
 * Lightweight skill metadata — loaded eagerly at startup.
 * Content is NOT loaded here (deferred to call time).
 */
export interface SkillMeta {
  id: string
  name: string
  description: string
  triggers: string[]
  source: string
}

function getSkillDirs(): string[] {
  const cwd = process.cwd()
  return [
    path.join(cwd, 'skills'),
    path.join(cwd, '.mini-agent', 'skills'),
  ]
}

/**
 * Parse YAML-like frontmatter, returning metadata and raw content separately.
 */
function parseFrontmatter(raw: string): {
  meta: Record<string, string>
  content: string
} {
  const match = raw.match(/^---\s*\n([\s\S]*?)\n---\s*\n([\s\S]*)$/)
  if (!match) {
    return { meta: {}, content: raw }
  }

  const meta: Record<string, string> = {}
  for (const line of match[1]!.split('\n')) {
    const colonIdx = line.indexOf(':')
    if (colonIdx === -1) continue
    const key = line.slice(0, colonIdx).trim()
    let value = line.slice(colonIdx + 1).trim()
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1)
    }
    meta[key] = value
  }

  return { meta, content: match[2]!.trim() }
}

function parseTriggers(raw: string): string[] {
  if (raw.includes('\n')) {
    return raw
      .split('\n')
      .map((line) => line.replace(/^-\s*/, '').trim())
      .filter(Boolean)
  }
  return raw
    .split(',')
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean)
}

export async function loadMetaFromDir(dir: string): Promise<SkillMeta[]> {
  const metas: SkillMeta[] = []

  let entries: string[]
  try {
    entries = await fs.readdir(dir)
  } catch {
    return metas
  }

  const mdFiles = entries.filter(
    (f) => f.endsWith('.md') && !f.startsWith('_'),
  )

  for (const file of mdFiles) {
    const filePath = path.join(dir, file)
    try {
      const raw = await fs.readFile(filePath, 'utf-8')
      const { meta, content } = parseFrontmatter(raw)

      if (!content) continue

      const id = file.replace(/\.md$/, '')
      metas.push({
        id,
        name: meta.name || id,
        description: meta.description || content.slice(0, 100),
        triggers: meta.triggers ? parseTriggers(meta.triggers) : [id],
        source: filePath,
      })
    } catch (err) {
      console.warn(
        `[skill-loader] Failed to parse ${filePath}: ${(err as Error).message}`,
      )
    }
  }

  return metas
}

/**
 * Load metadata for all skills (no content — that's deferred).
 */
export async function loadAllSkillMeta(): Promise<SkillMeta[]> {
  const dirs = getSkillDirs()
  const all: SkillMeta[] = []

  for (const dir of dirs) {
    all.push(...(await loadMetaFromDir(dir)))
  }

  const map = new Map<string, SkillMeta>()
  for (const s of all) {
    map.set(s.id, s)
  }

  const result = [...map.values()]
  if (result.length > 0) {
    console.log(
      `[skill-loader] Found ${result.length} skill(s): ${result.map((s) => s.name).join(', ')}`,
    )
  }
  return result
}

/**
 * Lazily load a single skill's full markdown content from disk.
 */
export async function loadSkillContent(source: string): Promise<string> {
  const raw = await fs.readFile(source, 'utf-8')
  const { content } = parseFrontmatter(raw)
  return content
}
