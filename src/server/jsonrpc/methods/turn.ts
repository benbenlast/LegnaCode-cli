/**
 * JSON-RPC turn methods — conversation turn management.
 *
 * Controls sending messages, steering mid-turn, and interrupting.
 */

import type { JsonRpcRouter } from '../router.js'

interface TurnStartParams {
  threadId: string
  message: string
  attachments?: Array<{ type: string; data: string }>
}

interface TurnSteerParams {
  threadId: string
  message: string
}

interface TurnInterruptParams {
  threadId: string
  reason?: string
}

export function registerTurnMethods(router: JsonRpcRouter): void {
  router.register('turn/start', async (params) => {
    const p = params as TurnStartParams
    if (!p?.threadId || !p?.message) {
      throw new Error('Invalid params: threadId and message required.')
    }
    return {
      turnId: `turn_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`,
      threadId: p.threadId,
      status: 'started',
      startedAt: new Date().toISOString(),
    }
  })

  router.register('turn/steer', async (params) => {
    const p = params as TurnSteerParams
    if (!p?.threadId || !p?.message) {
      throw new Error('Invalid params: threadId and message required.')
    }
    return {
      threadId: p.threadId,
      steered: true,
      injectedMessage: p.message,
    }
  })

  router.register('turn/interrupt', async (params) => {
    const p = params as TurnInterruptParams
    if (!p?.threadId) {
      throw new Error('Invalid params: threadId required.')
    }
    return {
      threadId: p.threadId,
      interrupted: true,
      reason: p.reason ?? 'user_requested',
    }
  })
}
