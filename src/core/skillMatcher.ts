import type { Skill } from './skillLoader.js'

/**
 * Match skills against user input using keyword triggers.
 * Returns matched skills sorted by relevance (number of trigger hits).
 */
export function matchSkills(
  userMessage: string,
  skills: Skill[],
): Skill[] {
  if (skills.length === 0) return []

  const lower = userMessage.toLowerCase()
  const words = new Set(lower.split(/\s+/))

  const scored: { skill: Skill; score: number }[] = []

  for (const skill of skills) {
    let score = 0

    for (const trigger of skill.triggers) {
      const triggerLower = trigger.toLowerCase()

      // Exact word match (higher weight)
      if (words.has(triggerLower)) {
        score += 2
        continue
      }

      // Substring match (lower weight)
      if (lower.includes(triggerLower)) {
        score += 1
      }
    }

    if (score > 0) {
      scored.push({ skill, score })
    }
  }

  return scored
    .sort((a, b) => b.score - a.score)
    .map((s) => s.skill)
}

/**
 * Format matched skills as context to inject into the conversation.
 * Injected as a system-like user message so the model sees it as guidance.
 */
export function formatSkillContext(skills: Skill[]): string {
  if (skills.length === 0) return ''

  const sections = skills.map(
    (s) =>
      `## Skill: ${s.name}\n${s.content}`,
  )

  return (
    `<skills>\n` +
    `The following skills are relevant to the user's request. ` +
    `Follow their guidelines when applicable.\n\n` +
    `${sections.join('\n\n---\n\n')}\n` +
    `</skills>`
  )
}

/**
 * Format the skill index for the system prompt,
 * so the model knows what skills are available.
 */
export function formatSkillIndex(skills: Skill[]): string {
  if (skills.length === 0) return ''

  const lines = skills.map(
    (s) => `- ${s.name}: ${s.description} (triggers: ${s.triggers.join(', ')})`,
  )

  return (
    `\nAvailable skills (automatically activated when relevant):\n` +
    lines.join('\n')
  )
}
