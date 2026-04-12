import * as fs from 'fs/promises'
import * as path from 'path'
import type { Tool } from './types.js'

const MAX_LINES = 2000

export const readTool: Tool = {
  name: 'read_file',
  description:
    'Read a file from the local filesystem. Returns the file content with line numbers. ' +
    'The file_path must be an absolute path. You can optionally specify offset (1-based line number) ' +
    'and limit (number of lines) to read a specific portion of the file.',
  parameters: {
    type: 'object',
    properties: {
      file_path: {
        type: 'string',
        description: 'Absolute path to the file to read',
      },
      offset: {
        type: 'number',
        description: 'Line number to start reading from (1-based). Defaults to 1.',
      },
      limit: {
        type: 'number',
        description: `Max number of lines to read. Defaults to ${MAX_LINES}.`,
      },
    },
    required: ['file_path'],
  },

  async call(args) {
    const filePath = args.file_path as string
    const offset = (args.offset as number) || 1
    const limit = (args.limit as number) || MAX_LINES

    const resolved = path.resolve(filePath)

    try {
      const content = await fs.readFile(resolved, 'utf-8')
      const lines = content.split('\n')
      const start = Math.max(0, offset - 1)
      const end = Math.min(lines.length, start + limit)
      const sliced = lines.slice(start, end)

      const numbered = sliced
        .map((line, i) => `${String(start + i + 1).padStart(6)}|${line}`)
        .join('\n')

      if (lines.length > end) {
        return `${numbered}\n\n... (${lines.length - end} more lines not shown)`
      }
      return numbered || '(empty file)'
    } catch (err: unknown) {
      const code = (err as NodeJS.ErrnoException).code
      if (code === 'ENOENT') {
        return `Error: File not found: ${resolved}`
      }
      if (code === 'EISDIR') {
        const entries = await fs.readdir(resolved)
        return `Error: Path is a directory. Contents:\n${entries.join('\n')}`
      }
      return `Error reading file: ${(err as Error).message}`
    }
  },

  isReadOnly() {
    return true
  },
}
