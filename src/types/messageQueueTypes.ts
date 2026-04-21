/**
 * Message queue operation types for session transcript logging.
 *
 * Reconstructed from usage in messageQueueManager.ts and sessionStorage.ts.
 */

export type QueueOperation = 'enqueue' | 'dequeue' | 'remove' | 'popAll'

export type QueueOperationMessage = {
  type: 'queue-operation'
  operation: QueueOperation
  timestamp: string
  sessionId: string
  content?: string
}
