/**
 * Custom Tool Template
 *
 * Copy this file, rename it, and implement your tool.
 * Files starting with _ are ignored by the tool loader.
 *
 * Place the file in one of these directories:
 *   - tools/              (project-level, can be version controlled)
 *   - .mini-agent/tools/  (user-level, gitignored)
 *
 * The tool loader supports these export styles:
 *   - export const tool = { ... }       (named export)
 *   - export default { ... }            (default export)
 */

import type { Tool } from '../src/tools/types.js'

export const tool: Tool = {
  // Unique tool name (used in tool_calls from the model)
  name: 'my_custom_tool',

  // Description shown to the model — be specific about what the tool does,
  // when to use it, and what it returns. This is part of the prompt.
  description: 'Describe what this tool does. The model reads this to decide when to use it.',

  // JSON Schema for the tool's input parameters
  parameters: {
    type: 'object',
    properties: {
      param1: {
        type: 'string',
        description: 'Description of param1',
      },
      param2: {
        type: 'number',
        description: 'Description of param2 (optional)',
      },
    },
    required: ['param1'],
  },

  // The actual implementation. Receives parsed arguments, returns a string result.
  // The returned string is sent back to the model as the tool result.
  async call(args) {
    const param1 = args.param1 as string
    const param2 = (args.param2 as number) || 0

    // TODO: implement your tool logic here
    return `Result for ${param1} (${param2})`
  },

  // Whether this tool only reads data (true) or modifies state (false).
  // Read-only tools can run concurrently; write tools run sequentially.
  isReadOnly() {
    return true
  },
}
