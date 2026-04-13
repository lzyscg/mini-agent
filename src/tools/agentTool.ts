import type { Tool } from './types.js'
import { queryLoop } from '../core/queryLoop.js'
import { getSubAgentSystemPrompt } from '../prompts.js'

const AGENT_TOOL_NAME = 'agent'

/**
 * Create a sub-agent tool. When the model calls this tool, it spawns an
 * independent queryLoop with its own context and collects the result.
 *
 * Anti-recursion: the sub-agent's tool set excludes the `agent` tool itself.
 */
export function createAgentTool(parentTools: Tool[]): Tool {
  const childTools = parentTools.filter((t) => t.name !== AGENT_TOOL_NAME)

  return {
    name: AGENT_TOOL_NAME,
    description:
      `Launch a sub-agent to handle a complex subtask independently. ` +
      `The sub-agent has its own conversation context and can use all tools except spawning further sub-agents. ` +
      `Use this when a task can be cleanly decomposed: e.g. "refactor module A" while you work on module B, ` +
      `or delegate an exploration/research task. The sub-agent runs to completion and returns its final result.`,
    parameters: {
      type: 'object',
      properties: {
        prompt: {
          type: 'string',
          description: 'Detailed task description for the sub-agent. Be specific about what files to read, what to change, and what the expected output is.',
        },
        description: {
          type: 'string',
          description: 'Short 3-5 word label for this sub-agent task.',
        },
        model: {
          type: 'string',
          description: 'Optional model override for the sub-agent (e.g. "gpt-4o-mini" for simpler tasks). If omitted, uses the same model as the parent.',
        },
        allowed_tools: {
          type: 'array',
          items: { type: 'string' },
          description: 'Optional whitelist of tool names the sub-agent can use. If omitted, all tools (except agent) are available.',
        },
      },
      required: ['prompt'],
    },

    async call(args: Record<string, unknown>): Promise<string> {
      const prompt = args.prompt as string
      const description = (args.description as string) || 'sub-agent task'
      const model = args.model as string | undefined
      const allowedTools = args.allowed_tools as string[] | undefined

      let tools = childTools
      if (allowedTools && allowedTools.length > 0) {
        const allowSet = new Set(allowedTools)
        tools = childTools.filter((t) => allowSet.has(t.name))
      }

      const systemPrompt = getSubAgentSystemPrompt(tools)

      const chunks: string[] = []
      let toolCallCount = 0
      const toolActions: string[] = []

      try {
        const gen = queryLoop({
          userMessage: prompt,
          history: [],
          tools,
          systemPrompt,
          model,
          isSubAgent: true,
        })

        for await (const event of gen) {
          switch (event.type) {
            case 'assistant_text':
              chunks.push(event.text)
              break
            case 'tool_start':
              toolCallCount++
              toolActions.push(event.toolCall.function.name)
              break
            case 'error':
              return `[Sub-agent "${description}" failed]\nError: ${event.error}`
          }
        }
      } catch (err) {
        return `[Sub-agent "${description}" crashed]\nError: ${(err as Error).message}`
      }

      const resultText = chunks.join('').trim()
      const summary = toolCallCount > 0
        ? `[Sub-agent "${description}" completed — ${toolCallCount} tool call(s): ${[...new Set(toolActions)].join(', ')}]`
        : `[Sub-agent "${description}" completed]`

      return resultText
        ? `${summary}\n\n${resultText}`
        : `${summary}\n\n(No text output from sub-agent)`
    },

    isReadOnly(): boolean {
      return false
    },
  }
}
