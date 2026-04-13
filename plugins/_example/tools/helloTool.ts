import type { Tool } from '../../../src/tools/types.js'

export const tool: Tool = {
  name: 'hello',
  description: 'A simple greeting tool that returns a welcome message. Use this to test that the plugin system is working.',
  parameters: {
    type: 'object',
    properties: {
      name: {
        type: 'string',
        description: 'Name to greet',
      },
    },
    required: ['name'],
  },
  async call(args: Record<string, unknown>): Promise<string> {
    const name = (args.name as string) || 'World'
    return `Hello, ${name}! This response comes from the example plugin.`
  },
  isReadOnly(): boolean {
    return true
  },
}
