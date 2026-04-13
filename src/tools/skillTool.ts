import type { Tool } from './types.js'
import type { SkillMeta } from '../core/skillLoader.js'
import { loadSkillContent } from '../core/skillLoader.js'

/**
 * Create a `use_skill` tool that lets the model activate skills on demand.
 *
 * - The tool description includes an index of all available skills
 *   so the model knows what to choose from.
 * - Content is loaded lazily — only when the model actually calls the tool.
 * - The loaded content is returned as the tool result (inline injection),
 *   so the model receives it as conversation context and follows the guidance.
 */
export function createSkillTool(metas: SkillMeta[]): Tool {
  const skillIndex = metas
    .map((s) => `  - "${s.name}": ${s.description}`)
    .join('\n')

  const validNames = metas.map((m) => m.name)

  return {
    name: 'use_skill',
    description:
      `Activate a skill to receive detailed guidelines for a specific workflow or task.\n` +
      `Use this when you recognize the user's request matches one of the available skills.\n` +
      `Available skills:\n${skillIndex}`,
    parameters: {
      type: 'object',
      properties: {
        name: {
          type: 'string',
          description: `Name of the skill to activate. Must be one of: ${validNames.map((n) => `"${n}"`).join(', ')}`,
        },
      },
      required: ['name'],
    },
    async call(args: Record<string, unknown>): Promise<string> {
      const name = args.name as string
      const meta = metas.find(
        (m) => m.name === name || m.id === name,
      )

      if (!meta) {
        return `Unknown skill "${name}". Available skills: ${validNames.join(', ')}`
      }

      try {
        const content = await loadSkillContent(meta.source)
        return (
          `[Skill Activated: ${meta.name}]\n\n` +
          `Follow these guidelines for the current task:\n\n` +
          content
        )
      } catch (err) {
        return `Failed to load skill "${name}": ${(err as Error).message}`
      }
    },
    isReadOnly(): boolean {
      return true
    },
  }
}
