import 'dotenv/config'
import { startApp } from './main.js'
import { getLatestConversationId, listConversations } from './storage.js'
import { handlePluginCommand } from './core/pluginManager.js'

function validateEnv() {
  if (!process.env.OPENAI_API_KEY) {
    console.error(
      'Error: OPENAI_API_KEY is not set.\n' +
      'Create a .env file in the project root or export it:\n' +
      '  export OPENAI_API_KEY=sk-...\n' +
      'Optionally set OPENAI_BASE_URL and MODEL_NAME for compatible providers.',
    )
    process.exit(1)
  }
}

function parseArgs(): { resume: boolean; sessionId?: string } {
  const args = process.argv.slice(2)

  if (args.includes('--new') || args.includes('-n')) {
    return { resume: false }
  }

  if (args.includes('--resume') || args.includes('-r')) {
    const idx = args.indexOf('--resume') !== -1
      ? args.indexOf('--resume')
      : args.indexOf('-r')
    const nextArg = args[idx + 1]
    const explicitId = nextArg && !nextArg.startsWith('-') ? nextArg : undefined
    return { resume: true, sessionId: explicitId }
  }

  if (args.includes('--list') || args.includes('-l')) {
    return { resume: false, sessionId: '__list__' }
  }

  return { resume: false }
}

async function showConversationList() {
  const conversations = await listConversations()
  if (conversations.length === 0) {
    console.log('No saved conversations.\n')
    return
  }
  console.log('Saved conversations:\n')
  for (const c of conversations) {
    const date = new Date(c.updatedAt).toLocaleString()
    console.log(`  ${c.id.slice(0, 8)}  ${date}  (${c.messageCount} msgs)  ${c.preview}`)
  }
  console.log(`\nResume with: npm start -- --resume <id>`)
  console.log(`Resume latest: npm start -- --resume\n`)
}

async function main() {
  const args = process.argv.slice(2)

  // Handle plugin subcommands (don't require API key)
  if (args[0] === 'plugin') {
    const handled = await handlePluginCommand(args)
    if (handled) process.exit(0)
  }

  validateEnv()

  const { resume, sessionId } = parseArgs()

  if (sessionId === '__list__') {
    await showConversationList()
    process.exit(0)
  }

  let resolvedSessionId: string | undefined

  if (resume) {
    if (sessionId) {
      const conversations = await listConversations()
      const match = conversations.find((c) => c.id.startsWith(sessionId))
      if (match) {
        resolvedSessionId = match.id
        console.log(`Resuming conversation ${match.id.slice(0, 8)}... (${match.messageCount} msgs)`)
      } else {
        console.error(`No conversation found matching "${sessionId}"`)
        process.exit(1)
      }
    } else {
      resolvedSessionId = await getLatestConversationId() ?? undefined
      if (resolvedSessionId) {
        console.log(`Resuming latest conversation ${resolvedSessionId.slice(0, 8)}...`)
      } else {
        console.log('No previous conversation found, starting new session.')
      }
    }
  }

  console.log(
    `Model: ${process.env.MODEL_NAME || 'gpt-4o'} | ` +
    `API: ${process.env.OPENAI_BASE_URL || 'https://api.openai.com/v1'}\n`,
  )

  try {
    await startApp(resolvedSessionId)
  } catch (err) {
    console.error('Fatal error:', (err as Error).message)
    process.exit(1)
  }
}

main()
