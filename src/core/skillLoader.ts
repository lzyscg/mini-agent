import * as fs from 'fs/promises'
import * as path from 'path'

export interface Skill {
  /** Unique identifier derived from filename */
  id: string
  name: string
  description: string
  /** Keywords that trigger this skill */
  triggers: string[]
  /** Full markdown content (excluding frontmatter) */
  content: string
  /** Source file path */
  source: string
}

/**
 * Directories to scan for skill files (.md with YAML frontmatter).
 */
function getSkillDirs(): string[] {
  const cwd = process.cwd()
  return [
    path.join(cwd, 'skills'),
    path.join(cwd, '.mini-agent', 'skills'),
  ]
}

/**
 * Parse YAML-like frontmatter from a markdown string.
 * Supports: name, description, triggers (as comma-separated or YAML list).
 *
 * Format:
 * ```
 * ---
 * name: My Skill
 * description: What this skill does
 * triggers: keyword1, keyword2, keyword3
 * ---
 * (markdown content)
 * ```
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
  const lines = match[1]!.split('\n')

  for (const line of lines) {
    const colonIdx = line.indexOf(':')
    if (colonIdx === -1) continue
    const key = line.slice(0, colonIdx).trim()
    let value = line.slice(colonIdx + 1).trim()
    // Strip surrounding quotes
    if ((value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1)
    }
    meta[key] = value
  }

  return { meta, content: match[2]!.trim() }
}

function parseTriggers(raw: string): string[] {
  // Support both "a, b, c" and YAML list "- a\n- b\n- c"
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

async function loadSkillsFromDir(dir: string): Promise<Skill[]> {
  const skills: Skill[] = []

  let entries: string[]
  try {
    entries = await fs.readdir(dir)
  } catch {
    return skills
  }

  const mdFiles = entries.filter(
    (f) => f.endsWith('.md') && !f.startsWith('_'),
  )

  for (const file of mdFiles) {
    const filePath = path.join(dir, file)
    try {
      const raw = await fs.readFile(filePath, 'utf-8')
      const { meta, content } = parseFrontmatter(raw)

      if (!content) {
        console.warn(`[skill-loader] Skipping ${file}: empty content`)
        continue
      }

      const id = file.replace(/\.md$/, '')
      const name = meta.name || id
      const description = meta.description || content.slice(0, 100)
      const triggers = meta.triggers ? parseTriggers(meta.triggers) : [id]

      skills.push({ id, name, description, triggers, content, source: filePath })
    } catch (err) {
      console.warn(
        `[skill-loader] Failed to load ${filePath}: ${(err as Error).message}`,
      )
    }
  }

  return skills
}

/**
 * Load all skills from skill directories.
 */
export async function loadAllSkills(): Promise<Skill[]> {
  const dirs = getSkillDirs()
  const allSkills: Skill[] = []

  for (const dir of dirs) {
    const skills = await loadSkillsFromDir(dir)
    allSkills.push(...skills)
  }

  // Deduplicate by id (later directories override earlier ones)
  const skillMap = new Map<string, Skill>()
  for (const s of allSkills) {
    skillMap.set(s.id, s)
  }

  const result = [...skillMap.values()]

  if (result.length > 0) {
    const names = result.map((s) => s.name).join(', ')
    console.log(`[skill-loader] Loaded ${result.length} skill(s): ${names}`)
  }

  return result
}
