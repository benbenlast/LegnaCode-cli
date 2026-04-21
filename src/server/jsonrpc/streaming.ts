/**
 * JSON-RPC streaming — notification emitter for real-time updates.
 *
 * Pushes structured notifications to connected clients:
 * - item/started, item/completed — tool call lifecycle
 * - turn/started, turn/completed — conversation turn lifecycle
 * - agentMessage/delta — incremental text streaming
 */

import type { JsonRpcNotification } from './types.js'

export type NotificationSink = (notification: JsonRpcNotification) => void

export class StreamingNotifier {
  private sinks: Set<NotificationSink> = new Set()

  /** Register a notification sink (transport layer). */
  addSink(sink: NotificationSink): void {
    this.sinks.add(sink)
  }

  /** Remove a notification sink. */
  removeSink(sink: NotificationSink): void {
    this.sinks.delete(sink)
  }

  /** Broadcast a notification to all sinks. */
  private emit(method: string, params: unknown): void {
    const notification: JsonRpcNotification = {
      jsonrpc: '2.0',
      method,
      params,
    }
    for (const sink of this.sinks) {
      try {
        sink(notification)
      } catch {
        // Don't let a broken sink crash the notifier
      }
    }
  }

  // ── Tool call lifecycle ────────────────────────────────────────────

  itemStarted(toolName: string, args: Record<string, unknown>, turnId?: string): void {
    this.emit('item/started', {
      type: 'tool_call',
      toolName,
      args,
      turnId,
      timestamp: Date.now(),
    })
  }

  itemCompleted(toolName: string, result: unknown, turnId?: string): void {
    this.emit('item/completed', {
      type: 'tool_call',
      toolName,
      result,
      turnId,
      timestamp: Date.now(),
    })
  }

  // ── Turn lifecycle ─────────────────────────────────────────────────

  turnStarted(turnId: string, threadId: string): void {
    this.emit('turn/started', {
      turnId,
      threadId,
      timestamp: Date.now(),
    })
  }

  turnCompleted(turnId: string, threadId: string, summary?: string): void {
    this.emit('turn/completed', {
      turnId,
      threadId,
      summary,
      timestamp: Date.now(),
    })
  }

  // ── Text streaming ─────────────────────────────────────────────────

  agentMessageDelta(turnId: string, delta: string, index: number): void {
    this.emit('agentMessage/delta', {
      turnId,
      delta,
      index,
      timestamp: Date.now(),
    })
  }
}
