/**
 * Example custom tool: fetch a URL and return its content.
 *
 * Drop this file into the `tools/` directory and restart the agent.
 * It will be automatically discovered and loaded.
 */

import type { Tool } from '../src/tools/types.js'

const MAX_RESPONSE_LENGTH = 20_000

export const tool: Tool = {
  name: 'fetch_url',
  description:
    'Fetch the content of a URL and return it as text. ' +
    'Useful for reading web pages, APIs, or downloading text files. ' +
    'Returns the response body as a string (truncated if too large).',
  parameters: {
    type: 'object',
    properties: {
      url: {
        type: 'string',
        description: 'The URL to fetch',
      },
      method: {
        type: 'string',
        description: 'HTTP method (GET, POST, etc). Defaults to GET.',
      },
      headers: {
        type: 'object',
        description: 'Optional HTTP headers as key-value pairs',
      },
      body: {
        type: 'string',
        description: 'Optional request body (for POST/PUT requests)',
      },
    },
    required: ['url'],
  },

  async call(args) {
    const url = args.url as string
    const method = (args.method as string) || 'GET'
    const headers = (args.headers as Record<string, string>) || {}
    const body = args.body as string | undefined

    try {
      const response = await fetch(url, {
        method,
        headers,
        body: method !== 'GET' ? body : undefined,
      })

      const status = response.status
      const contentType = response.headers.get('content-type') || ''
      const text = await response.text()

      const truncated = text.length > MAX_RESPONSE_LENGTH
        ? text.slice(0, MAX_RESPONSE_LENGTH) + '\n... (response truncated)'
        : text

      return `[${status}] ${contentType}\n\n${truncated}`
    } catch (err) {
      return `Error fetching ${url}: ${(err as Error).message}`
    }
  },

  isReadOnly() {
    return true
  },
}
