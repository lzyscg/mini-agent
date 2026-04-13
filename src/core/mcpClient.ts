import * as fs from 'fs/promises'
import * as path from 'path'
import { Client } from '@modelcontextprotocol/sdk/client/index.js'
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js'
import type { Tool } from '../tools/types.js'

// ── Config types ──

interface McpServerConfig {
  /** Executable command to start the MCP server */
  command: string
  /** Arguments passed to the command */
  args?: string[]
  /** Environment variables for the server process */
  env?: Record<string, string>
  /** Working directory (defaults to cwd) */
  cwd?: string
  /** Whether the server is disabled */
  disabled?: boolean
}

interface McpConfig {
  mcpServers: Record<string, McpServerConfig>
}

// ── Connection tracking ──

interface McpConnection {
  name: string
  client: Client
  transport: StdioClientTransport
  tools: Tool[]
}

const connections: McpConnection[] = []

// ── Config loading ──

function getMcpConfigPaths(): string[] {
  const cwd = process.cwd()
  return [
    path.join(cwd, 'mcp.json'),
    path.join(cwd, '.mini-agent', 'mcp.json'),
  ]
}

async function loadMcpConfig(): Promise<McpConfig> {
  const merged: McpConfig = { mcpServers: {} }

  for (const configPath of getMcpConfigPaths()) {
    try {
      const raw = await fs.readFile(configPath, 'utf-8')
      const parsed = JSON.parse(raw) as McpConfig
      if (parsed.mcpServers) {
        Object.assign(merged.mcpServers, parsed.mcpServers)
      }
    } catch {
      // File doesn't exist or is invalid — skip
    }
  }

  return merged
}

// ── Tool translation ──

function buildToolName(serverName: string, toolName: string): string {
  const sanitize = (s: string) => s.replace(/[^a-zA-Z0-9_]/g, '_')
  return `mcp__${sanitize(serverName)}__${sanitize(toolName)}`
}

function mcpToolToTool(
  serverName: string,
  mcpTool: { name: string; description?: string; inputSchema: Record<string, unknown> },
  client: Client,
): Tool {
  return {
    name: buildToolName(serverName, mcpTool.name),
    description: mcpTool.description || `MCP tool from ${serverName}`,
    parameters: mcpTool.inputSchema,
    async call(args: Record<string, unknown>): Promise<string> {
      const result = await client.callTool({
        name: mcpTool.name,
        arguments: args,
      })

      if (!result.content || !Array.isArray(result.content)) {
        return String(result.content ?? '')
      }

      return (result.content as Array<{ type: string; text?: string }>)
        .filter((c) => c.type === 'text' && c.text)
        .map((c) => c.text!)
        .join('\n')
    },
    isReadOnly(): boolean {
      return true
    },
  }
}

// ── Connection management ──

const CONNECT_TIMEOUT_MS = 30_000

async function connectServer(
  name: string,
  config: McpServerConfig,
): Promise<McpConnection | null> {
  const client = new Client(
    { name: 'mini-agent', version: '1.0.0' },
  )

  const transport = new StdioClientTransport({
    command: config.command,
    args: config.args,
    env: { ...process.env as Record<string, string>, ...config.env },
    cwd: config.cwd,
    stderr: 'pipe',
  })

  try {
    await Promise.race([
      client.connect(transport),
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error(`Connection timeout (${CONNECT_TIMEOUT_MS}ms)`)), CONNECT_TIMEOUT_MS),
      ),
    ])

    const { tools: mcpTools } = await client.listTools()
    const tools = mcpTools.map((t) => mcpToolToTool(name, t, client))

    console.log(
      `[mcp] Connected to "${name}" — ${tools.length} tool(s): ${tools.map((t) => t.name).join(', ')}`,
    )

    return { name, client, transport, tools }
  } catch (err) {
    console.warn(
      `[mcp] Failed to connect to "${name}": ${(err as Error).message}`,
    )
    try { await transport.close() } catch { /* ignore */ }
    return null
  }
}

// ── Public API ──

export interface McpLoadResult {
  tools: Tool[]
  serverCount: number
}

/**
 * Load MCP config, connect to all servers, and return translated tools.
 * Failed connections are skipped gracefully.
 */
export async function loadMcpTools(): Promise<McpLoadResult> {
  const config = await loadMcpConfig()
  const entries = Object.entries(config.mcpServers).filter(
    ([, cfg]) => !cfg.disabled,
  )

  if (entries.length === 0) {
    return { tools: [], serverCount: 0 }
  }

  console.log(`[mcp] Connecting to ${entries.length} server(s)...`)

  const results = await Promise.allSettled(
    entries.map(([name, cfg]) => connectServer(name, cfg)),
  )

  let connectedCount = 0
  const allTools: Tool[] = []

  for (const result of results) {
    if (result.status === 'fulfilled' && result.value) {
      connections.push(result.value)
      allTools.push(...result.value.tools)
      connectedCount++
    }
  }

  if (connectedCount > 0) {
    console.log(
      `[mcp] Ready: ${connectedCount}/${entries.length} server(s), ${allTools.length} tool(s) total`,
    )
  }

  return { tools: allTools, serverCount: connectedCount }
}

/**
 * Gracefully close all MCP connections.
 * Should be called on process exit.
 */
export async function closeMcpConnections(): Promise<void> {
  for (const conn of connections) {
    try {
      await conn.transport.close()
    } catch {
      // best-effort cleanup
    }
  }
  connections.length = 0
}
