import type { UUID } from 'crypto'
import { readFile } from 'fs/promises'
import { getOriginalCwd, getSessionId } from '../../bootstrap/state.js'
import type { LocalJSXCommandContext } from '../../commands.js'
import { logEvent } from '../../services/analytics/index.js'
import type { LocalJSXCommandOnDone } from '../../types/command.js'
import type { Entry, LogOption, TranscriptMessage } from '../../types/logs.js'
import { parseJSONL } from '../../utils/json.js'
import {
  fetchLogs,
  getTranscriptPath,
  isTranscriptMessage,
  saveCustomTitle,
} from '../../utils/sessionStorage.js'
import {
  createFork,
  deriveFirstPrompt,
  getUniqueForkName,
} from '../branch/branch.js'

// --- helpers ---

/** Resolve @N syntax: N = Nth user message (1-based). Returns the index in
 *  mainConversationEntries that includes the full round (user + assistant reply). */
function resolveMessageIndex(
  entries: TranscriptMessage[],
  n: number,
): number {
  let userCount = 0
  let lastMatchIdx = -1
  for (let i = 0; i < entries.length; i++) {
    const e = entries[i]!
    if (e.type === 'user' && !(e as any).isMeta) {
      userCount++
      if (userCount === n) {
        lastMatchIdx = i
        // include the assistant reply that follows
        break
      }
    }
  }
  if (lastMatchIdx === -1) {
    throw new Error(`Only ${userCount} user messages — cannot locate @${n}`)
  }
  // Walk forward to include the assistant response for this user turn
  let end = lastMatchIdx
  for (let j = lastMatchIdx + 1; j < entries.length; j++) {
    const e = entries[j]!
    if (e.type === 'assistant') {
      end = j
      break
    }
    if (e.type === 'user') break // next user turn — stop
    end = j // progress / other entries belong to this turn
  }
  return end
}

// --- /fork list ---

type ForkNode = {
  sessionId: string
  title: string
  messageCount: number
  isCurrent: boolean
  children: ForkNode[]
}

async function listForks(onDone: LocalJSXCommandOnDone): Promise<null> {
  const currentSessionId = getSessionId()
  const logs = await fetchLogs(200)

  // Build a map of forkedFrom relationships by scanning JSONL heads
  const forkedFromMap = new Map<string, string>() // childSessionId → parentSessionId
  const logMap = new Map<string, LogOption>()

  for (const log of logs) {
    if (log.sessionId) logMap.set(log.sessionId, log)
  }

  // Read forkedFrom from each session's first entry
  for (const log of logs) {
    if (!log.fullPath || !log.sessionId) continue
    try {
      const buf = await readFile(log.fullPath)
      const firstLine = buf.toString('utf8').split('\n')[0]
      if (!firstLine) continue
      const entry = JSON.parse(firstLine)
      if (entry.forkedFrom?.sessionId) {
        forkedFromMap.set(log.sessionId, entry.forkedFrom.sessionId)
      }
    } catch { /* skip unreadable */ }
  }

  // Find the root session for the current session
  let rootId: string = currentSessionId
  const visited = new Set<string>()
  while (forkedFromMap.has(rootId) && !visited.has(rootId)) {
    visited.add(rootId)
    rootId = forkedFromMap.get(rootId)!
  }

  // Build tree from root
  function buildNode(sessionId: string): ForkNode {
    const log = logMap.get(sessionId)
    const children: ForkNode[] = []
    for (const [childId, parentId] of forkedFromMap) {
      if (parentId === sessionId) {
        children.push(buildNode(childId))
      }
    }
    return {
      sessionId,
      title: log?.customTitle || log?.firstPrompt || sessionId.slice(0, 8),
      messageCount: log?.messageCount || 0,
      isCurrent: sessionId === currentSessionId,
      children,
    }
  }

  const tree = buildNode(rootId)

  // Render ASCII tree
  function renderTree(node: ForkNode, prefix: string, isLast: boolean, isRoot: boolean): string[] {
    const marker = node.isCurrent ? ' ← current' : ''
    const connector = isRoot ? '' : (isLast ? '└── ' : '├── ')
    const line = `${prefix}${connector}${node.title} (${node.messageCount} msgs)${marker}`
    const lines = [line]
    const childPrefix = isRoot ? '' : (prefix + (isLast ? '    ' : '│   '))
    for (let i = 0; i < node.children.length; i++) {
      lines.push(...renderTree(node.children[i]!, childPrefix, i === node.children.length - 1, false))
    }
    return lines
  }

  const hasAnyForks = forkedFromMap.size > 0 && (tree.children.length > 0 || forkedFromMap.has(currentSessionId))

  if (!hasAnyForks) {
    onDone('No forks found for this conversation.')
    return null
  }

  const output = renderTree(tree, '', true, true).join('\n')
  onDone(output)
  return null
}

// --- /fork switch ---

async function switchFork(
  target: string,
  onDone: LocalJSXCommandOnDone,
  context: LocalJSXCommandContext,
): Promise<null> {
  const logs = await fetchLogs(200)

  // Match by session ID prefix or custom title
  const match = logs.find(
    (log) =>
      log.sessionId?.startsWith(target) ||
      log.customTitle?.toLowerCase() === target.toLowerCase(),
  )

  if (!match || !match.sessionId) {
    onDone(`No session found matching "${target}". Use /fork list to see available branches.`)
    return null
  }

  if (context.resume) {
    await context.resume(match.sessionId as UUID, match, 'fork')
    onDone(`Switched to: ${match.customTitle || match.sessionId}`, { display: 'system' })
  } else {
    onDone(`Resume with: legna -r ${match.sessionId}`)
  }
  return null
}

// --- /fork (create) ---

async function doFork(
  onDone: LocalJSXCommandOnDone,
  context: LocalJSXCommandContext,
  customTitle?: string,
  atMessageIndex?: number,
): Promise<null> {
  const originalSessionId = getSessionId()

  const {
    sessionId,
    title,
    forkPath,
    serializedMessages,
    contentReplacementRecords,
  } = await createFork(customTitle, atMessageIndex)

  const now = new Date()
  const firstPrompt = deriveFirstPrompt(
    serializedMessages.find(m => m.type === 'user'),
  )

  const baseName = title ?? firstPrompt
  const effectiveTitle = await getUniqueForkName(baseName)
  await saveCustomTitle(sessionId, effectiveTitle, forkPath)

  logEvent('tengu_conversation_forked', {
    message_count: serializedMessages.length,
    has_custom_title: !!title,
    at_message_index: atMessageIndex,
  })

  const forkLog: LogOption = {
    date: now.toISOString().split('T')[0]!,
    messages: serializedMessages,
    fullPath: forkPath,
    value: now.getTime(),
    created: now,
    modified: now,
    firstPrompt,
    messageCount: serializedMessages.length,
    isSidechain: false,
    sessionId,
    customTitle: effectiveTitle,
    contentReplacements: contentReplacementRecords,
  }

  const titleInfo = title ? ` "${title}"` : ''
  const truncInfo = atMessageIndex !== undefined ? ` (from message @${atMessageIndex})` : ''
  const resumeHint = `\nTo resume the original: legna -r ${originalSessionId}`
  const successMessage = `Forked conversation${titleInfo}${truncInfo}. You are now in the fork.${resumeHint}`

  if (context.resume) {
    await context.resume(sessionId, forkLog, 'fork')
    onDone(successMessage, { display: 'system' })
  } else {
    onDone(`Forked conversation${titleInfo}. Resume with: /resume ${sessionId}`)
  }
  return null
}

// --- main entry ---

export async function call(
  onDone: LocalJSXCommandOnDone,
  context: LocalJSXCommandContext,
  args: string,
): Promise<React.ReactNode> {
  const trimmed = args?.trim() || ''

  try {
    // /fork list
    if (trimmed === 'list' || trimmed === 'ls') {
      return listForks(onDone)
    }

    // /fork switch <id|name>
    if (trimmed.startsWith('switch ')) {
      const target = trimmed.slice(7).trim()
      if (!target) {
        onDone('Usage: /fork switch <session-id or branch name>')
        return null
      }
      return switchFork(target, onDone, context)
    }

    // /fork @N — fork from Nth user message
    const atMatch = trimmed.match(/^@(\d+)(?:\s+(.+))?$/)
    if (atMatch) {
      const n = parseInt(atMatch[1]!, 10)
      const name = atMatch[2]?.trim() || undefined

      // Read current transcript to resolve the index
      const transcriptPath = getTranscriptPath()
      const buf = await readFile(transcriptPath)
      const entries = parseJSONL<Entry>(buf)
      const mainEntries = entries.filter(
        (e): e is TranscriptMessage => isTranscriptMessage(e) && !e.isSidechain,
      )
      const idx = resolveMessageIndex(mainEntries, n)
      return doFork(onDone, context, name, idx)
    }

    // /fork or /fork <name>
    const customTitle = trimmed || undefined
    return doFork(onDone, context, customTitle)
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    onDone(`Fork failed: ${message}`)
    return null
  }
}
