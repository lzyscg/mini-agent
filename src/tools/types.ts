export interface Tool {
  name: string
  description: string
  parameters: Record<string, unknown>
  call(args: Record<string, unknown>): Promise<string>
  isReadOnly(args: Record<string, unknown>): boolean
}

export function toolToOpenAISchema(tool: Tool) {
  return {
    type: 'function' as const,
    function: {
      name: tool.name,
      description: tool.description,
      parameters: tool.parameters,
    },
  }
}
