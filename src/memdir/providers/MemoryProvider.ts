/**
 * Memory Provider — abstract base class for pluggable memory backends.
 *
 * Adapted from Hermes Agent's memory_provider.py.
 * One external provider is active at a time alongside the built-in
 * memory (.legna/memory/ markdown files). External providers are additive.
 *
 * Lifecycle (called by MemoryManager):
 *   initialize()          — connect, create resources
 *   systemPromptBlock()   — static text for system prompt
 *   prefetch(query)       — background recall before each turn
 *   syncTurn(user, asst)  — async write after each turn
 *   getToolSchemas()      — tool schemas to expose to the model
 *   handleToolCall()      — dispatch a tool call
 *   shutdown()            — clean exit
 *
 * Optional hooks:
 *   onTurnStart(turn, message)    — per-turn tick
 *   onSessionEnd(messages)        — end-of-session extraction
 *   onPreCompress(messages)       — extract before context compression
 *   onDelegation(task, result)    — parent-side observation of subagent work
 */

export interface ToolSchema {
  name: string
  description: string
  input_schema: Record<string, unknown>
}

export abstract class MemoryProvider {
  /** Short identifier (e.g. 'builtin', 'sqlite', 'redis') */
  abstract readonly name: string

  /** Check if provider is configured and ready (no network calls). */
  abstract isAvailable(): boolean

  /** Initialize for a session. */
  abstract initialize(sessionId: string, opts?: Record<string, unknown>): Promise<void>

  /** Return text to include in system prompt. */
  systemPromptBlock(): string {
    return ''
  }

  /** Recall relevant context for the upcoming turn. */
  prefetch(_query: string): Promise<string> {
    return Promise.resolve('')
  }

  /** Queue background recall for the NEXT turn. */
  queuePrefetch(_query: string): void {}

  /** Persist a completed turn to the backend. */
  syncTurn(_userContent: string, _assistantContent: string): Promise<void> {
    return Promise.resolve()
  }

  /** Return tool schemas this provider exposes. */
  abstract getToolSchemas(): ToolSchema[]

  /** Handle a tool call for one of this provider's tools. */
  handleToolCall(_toolName: string, _args: Record<string, unknown>): Promise<string> {
    throw new Error(`Provider ${this.name} does not handle tool calls`)
  }

  /** Clean shutdown — flush queues, close connections. */
  shutdown(): Promise<void> {
    return Promise.resolve()
  }

  // -- Optional hooks --

  /** Called at the start of each turn. */
  onTurnStart(_turnNumber: number, _message: string): void {}

  /** Called when a session ends. */
  onSessionEnd(_messages: unknown[]): void {}

  /** Called before context compression. Return text to preserve. */
  onPreCompress(_messages: unknown[]): string {
    return ''
  }

  /** Called on parent when a subagent completes. */
  onDelegation(_task: string, _result: string): void {}
}
