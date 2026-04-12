import { exec } from 'child_process'
import type { Tool } from './types.js'

const MAX_OUTPUT = 50_000
const DEFAULT_TIMEOUT_MS = 30_000

export const bashTool: Tool = {
  name: 'bash',
  description:
    'Execute a shell command and return its output (stdout + stderr). ' +
    'Use this for running programs, installing packages, git operations, ' +
    'listing directories, and any other terminal task. ' +
    'Commands run in the current working directory.',
  parameters: {
    type: 'object',
    properties: {
      command: {
        type: 'string',
        description: 'The shell command to execute',
      },
      timeout_ms: {
        type: 'number',
        description: `Timeout in milliseconds. Defaults to ${DEFAULT_TIMEOUT_MS}.`,
      },
    },
    required: ['command'],
  },

  async call(args) {
    const command = args.command as string
    const timeout = (args.timeout_ms as number) || DEFAULT_TIMEOUT_MS

    return new Promise<string>((resolve) => {
      const child = exec(
        command,
        {
          timeout,
          maxBuffer: MAX_OUTPUT * 2,
          shell: process.platform === 'win32' ? 'powershell.exe' : '/bin/bash',
        },
        (error, stdout, stderr) => {
          const parts: string[] = []

          if (stdout) {
            const out = stdout.length > MAX_OUTPUT
              ? stdout.slice(0, MAX_OUTPUT) + '\n... (output truncated)'
              : stdout
            parts.push(out)
          }

          if (stderr) {
            const err = stderr.length > MAX_OUTPUT
              ? stderr.slice(0, MAX_OUTPUT) + '\n... (stderr truncated)'
              : stderr
            parts.push(`[stderr]\n${err}`)
          }

          if (error && error.killed) {
            parts.push(`[error] Command timed out after ${timeout}ms`)
          } else if (error) {
            parts.push(`[exit code ${error.code ?? 1}]`)
          }

          resolve(parts.join('\n') || '(no output)')
        },
      )

      child.stdin?.end()
    })
  },

  isReadOnly(args) {
    const cmd = (args.command as string) || ''
    const readOnlyPrefixes = ['ls', 'cat', 'head', 'tail', 'find', 'grep', 'rg', 'wc', 'file', 'which', 'echo', 'pwd', 'date', 'whoami', 'uname', 'git status', 'git log', 'git diff', 'git branch']
    return readOnlyPrefixes.some((p) => cmd.trimStart().startsWith(p))
  },
}
