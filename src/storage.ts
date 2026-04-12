import * as fs from 'fs/promises'
import * as path from 'path'
import * as crypto from 'crypto'
import type { Message } from './types.js'

const STORAGE_DIR = path.join(process.cwd(), '.mini-agent', 'conversations')

interface ConversationMeta {
  id: string
  createdAt: string
  updatedAt: string
  messageCount: number
  /** First user message as a preview */
  preview: string
}

interface ConversationData {
  meta: ConversationMeta
  messages: Message[]
}

async function ensureDir() {
  await fs.mkdir(STORAGE_DIR, { recursive: true })
}

function filePath(id: string): string {
  return path.join(STORAGE_DIR, `${id}.json`)
}

export function generateSessionId(): string {
  return crypto.randomUUID()
}

/**
 * Save a conversation to disk.
 */
export async function saveConversation(
  id: string,
  messages: Message[],
  createdAt?: string,
): Promise<void> {
  await ensureDir()

  const firstUserMsg = messages.find((m) => m.role === 'user')
  const preview = firstUserMsg
    ? (firstUserMsg as { content: string }).content.slice(0, 80)
    : '(empty)'

  const data: ConversationData = {
    meta: {
      id,
      createdAt: createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      messageCount: messages.length,
      preview,
    },
    messages,
  }

  await fs.writeFile(filePath(id), JSON.stringify(data, null, 2), 'utf-8')
}

/**
 * Load a conversation from disk. Returns null if not found.
 */
export async function loadConversation(
  id: string,
): Promise<{ messages: Message[]; createdAt: string } | null> {
  try {
    const raw = await fs.readFile(filePath(id), 'utf-8')
    const data: ConversationData = JSON.parse(raw)
    return { messages: data.messages, createdAt: data.meta.createdAt }
  } catch {
    return null
  }
}

/**
 * List all saved conversations, sorted by most recently updated.
 */
export async function listConversations(): Promise<ConversationMeta[]> {
  await ensureDir()

  const files = await fs.readdir(STORAGE_DIR)
  const jsonFiles = files.filter((f) => f.endsWith('.json'))

  const metas: ConversationMeta[] = []

  for (const file of jsonFiles) {
    try {
      const raw = await fs.readFile(path.join(STORAGE_DIR, file), 'utf-8')
      const data: ConversationData = JSON.parse(raw)
      metas.push(data.meta)
    } catch {
      // skip corrupted files
    }
  }

  return metas.sort(
    (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime(),
  )
}

/**
 * Get the most recent conversation ID, or null if none exist.
 */
export async function getLatestConversationId(): Promise<string | null> {
  const list = await listConversations()
  return list.length > 0 ? list[0]!.id : null
}
