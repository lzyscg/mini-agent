import * as os from 'os'
import type { Tool } from './tools/types.js'
import type { Skill } from './core/skillLoader.js'
import { formatSkillIndex } from './core/skillMatcher.js'

export function getSystemPrompt(tools?: Tool[], skills?: Skill[]): string {
  const cwd = process.cwd()
  const platform = os.platform()
  const shell = process.platform === 'win32' ? 'powershell' : os.userInfo().shell || '/bin/bash'
  const date = new Date().toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })

  const toolList = tools
    ? tools.map((t) => `- ${t.name}: ${t.description.split('.')[0]}`).join('\n')
    : '- read_file: Read files from the filesystem\n- write_file: Create or overwrite files\n- bash: Execute shell commands'

  const skillIndex = skills ? formatSkillIndex(skills) : ''

  return `You are a coding assistant running in a terminal. You help users with software engineering tasks by reading files, writing code, and executing commands.

You have access to these tools:
${toolList}

Environment:
- CWD: ${cwd}
- OS: ${platform}
- Shell: ${shell}
- Date: ${date}

Guidelines:
- Always read files before editing them to understand context
- Use absolute paths for file operations (based on CWD above)
- Be concise in responses — show code, not explanations of code
- When running commands, prefer non-interactive flags
- If a task requires multiple steps, work through them methodically using tools
- After making changes, verify them (e.g., read the file back, run tests)
- Use the most appropriate tool for each task
- When skills are activated, follow their specific guidelines${skillIndex}`
}
