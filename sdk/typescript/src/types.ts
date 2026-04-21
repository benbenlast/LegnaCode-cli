/**
 * SDK type definitions.
 *
 * Wire-compatible with the LegnaCode app-server JSON-RPC protocol.
 */

export interface LegnaCodeConfig {
  /** Model to use (e.g. 'claude-sonnet-4-20250514'). */
  model?: string
  /** Anthropic API key. Falls back to ANTHROPIC_API_KEY env var. */
  apiKey?: string
  /** Base URL for the API. */
  baseUrl?: string
  /** Working directory for the session. Defaults to cwd. */
  workingDir?: string
  /** Extra environment variables passed to the subprocess. */
  env?: Record<string, string>
  /** Sandbox mode for file/command execution. */
  sandboxMode?: 'read-only' | 'workspace-write' | 'danger-full-access'
  /** Approval mode for tool calls. */
  approvalMode?: 'auto' | 'guardian' | 'manual'
  /** Transport type. Defaults to 'stdio'. */
  transport?: 'stdio' | 'websocket'
  /** WebSocket port (only used when transport is 'websocket'). */
  port?: number
  /** Path to the legnacode binary. Defaults to 'legnacode'. */
  binaryPath?: string
}

export interface ThreadConfig {
  /** Override model for this thread. */
  model?: string
  /** Custom system prompt. */
  systemPrompt?: string
  /** Collaboration mode (e.g. 'pair', 'autonomous'). */
  collaborationMode?: string
  /** Structured output schema constraint. */
  structuredOutput?: { schema: Record<string, unknown> }
}

export interface TurnResult {
  id: string
  content: string
  toolCalls: ToolCallResult[]
  structuredOutput?: unknown
  usage: { inputTokens: number; outputTokens: number }
}

export interface ToolCallResult {
  name: string
  input: unknown
  output: unknown
  duration_ms: number
}

export interface StreamEvent {
  type:
    | 'turn.started'
    | 'turn.completed'
    | 'item.started'
    | 'item.completed'
    | 'message.delta'
  data: unknown
}

export interface ThreadSummary {
  id: string
  title?: string
  createdAt: string
  lastActiveAt: string
  messageCount: number
}

/** JSON-RPC 2.0 request envelope. */
export interface JsonRpcRequest {
  jsonrpc: '2.0'
  id: string | number
  method: string
  params?: unknown
}

/** JSON-RPC 2.0 response envelope. */
export interface JsonRpcResponse {
  jsonrpc: '2.0'
  id: string | number
  result?: unknown
  error?: { code: number; message: string; data?: unknown }
}

/** JSON-RPC 2.0 notification (no id). */
export interface JsonRpcNotification {
  jsonrpc: '2.0'
  method: string
  params?: unknown
}
