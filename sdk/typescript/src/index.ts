/**
 * @legna/legnacode-sdk — TypeScript SDK for LegnaCode.
 *
 * Provides programmatic access to the LegnaCode CLI via JSON-RPC
 * over stdio or WebSocket transport.
 */

export { LegnaCode } from './client.js'
export { Thread } from './thread.js'
export type {
  LegnaCodeConfig,
  ThreadConfig,
  TurnResult,
  ToolCallResult,
  StreamEvent,
  ThreadSummary,
} from './types.js'
export type { Transport } from './transport.js'
export { StdioTransport, WebSocketTransport } from './transport.js'
export { withStructuredOutput, withJsonSchema } from './structured-output.js'

// Codex compatibility alias
export { LegnaCode as Codex } from './client.js'
