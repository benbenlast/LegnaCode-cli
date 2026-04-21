/**
 * JSON-RPC thread methods — session/conversation management.
 *
 * Maps to existing LegnaCode session infrastructure.
 */

import type { JsonRpcRouter } from '../router.js'

interface ThreadStartParams {
  model?: string
  systemPrompt?: string
  workingDir?: string
}

interface ThreadResumeParams {
  threadId: string
}

interface ThreadForkParams {
  threadId: string
  atMessageId?: string
}

interface ThreadReadParams {
  threadId: string
  limit?: number
  offset?: number
}

interface ThreadRollbackParams {
  threadId: string
  targetMessageId: string
}

export function registerThreadMethods(router: JsonRpcRouter): void {
  router.register('thread/start', async (params) => {
    const p = (params ?? {}) as ThreadStartParams
    return {
      threadId: generateThreadId(),
      model: p.model ?? 'default',
      workingDir: p.workingDir ?? process.cwd(),
      createdAt: new Date().toISOString(),
    }
  })

  router.register('thread/resume', async (params) => {
    const p = params as ThreadResumeParams
    if (!p?.threadId) throw new Error('Invalid params: threadId required.')
    return {
      threadId: p.threadId,
      resumed: true,
      resumedAt: new Date().toISOString(),
    }
  })

  router.register('thread/fork', async (params) => {
    const p = params as ThreadForkParams
    if (!p?.threadId) throw new Error('Invalid params: threadId required.')
    return {
      originalThreadId: p.threadId,
      forkedThreadId: generateThreadId(),
      atMessageId: p.atMessageId ?? 'HEAD',
      createdAt: new Date().toISOString(),
    }
  })

  router.register('thread/list', async () => {
    // Placeholder — will integrate with session store
    return { threads: [] }
  })

  router.register('thread/read', async (params) => {
    const p = params as ThreadReadParams
    if (!p?.threadId) throw new Error('Invalid params: threadId required.')
    return {
      threadId: p.threadId,
      messages: [],
      hasMore: false,
    }
  })

  router.register('thread/archive', async (params) => {
    const p = params as { threadId: string }
    if (!p?.threadId) throw new Error('Invalid params: threadId required.')
    return { threadId: p.threadId, archived: true }
  })

  router.register('thread/compact/start', async (params) => {
    const p = params as { threadId: string }
    if (!p?.threadId) throw new Error('Invalid params: threadId required.')
    return { threadId: p.threadId, compacting: true }
  })

  router.register('thread/rollback', async (params) => {
    const p = params as ThreadRollbackParams
    if (!p?.threadId || !p?.targetMessageId) {
      throw new Error('Invalid params: threadId and targetMessageId required.')
    }
    return {
      threadId: p.threadId,
      rolledBackTo: p.targetMessageId,
    }
  })
}

function generateThreadId(): string {
  return `thread_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`
}
