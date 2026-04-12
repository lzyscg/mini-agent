import * as fs from 'fs/promises'
import * as path from 'path'
import type { Tool } from './types.js'

export const writeTool: Tool = {
  name: 'write_file',
  description:
    'Write content to a file on the local filesystem. Creates parent directories if needed. ' +
    'If the file exists, it will be overwritten. The file_path must be an absolute path.',
  parameters: {
    type: 'object',
    properties: {
      file_path: {
        type: 'string',
        description: 'Absolute path to the file to write',
      },
      content: {
        type: 'string',
        description: 'Content to write to the file',
      },
    },
    required: ['file_path', 'content'],
  },

  async call(args) {
    const filePath = args.file_path as string
    const content = args.content as string

    const resolved = path.resolve(filePath)
    const dir = path.dirname(resolved)

    try {
      await fs.mkdir(dir, { recursive: true })

      let existed = false
      try {
        await fs.access(resolved)
        existed = true
      } catch {
        // file doesn't exist yet
      }

      await fs.writeFile(resolved, content, 'utf-8')
      const lines = content.split('\n').length

      return existed
        ? `File updated: ${resolved} (${lines} lines)`
        : `File created: ${resolved} (${lines} lines)`
    } catch (err: unknown) {
      return `Error writing file: ${(err as Error).message}`
    }
  },

  isReadOnly() {
    return false
  },
}
