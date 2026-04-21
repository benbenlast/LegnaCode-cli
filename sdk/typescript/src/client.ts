/**
 * LegnaCode client — main entry point for the SDK.
 *
 * Spawns (or connects to) a legnacode app-server process and
 * exposes thread management via JSON-RPC.
 */

import { StdioTransport, WebSocketTransport, type Transport } from './transport.js'
import { Thread } from './thread.js'
import type {
  LegnaCodeConfig,
  ThreadConfig,
  ThreadSummary,
  JsonRpcRequest,
  JsonRpcResponse,
} from './types.js'

let nextId = 1

export class LegnaCode {
  private transport: Transport | null = null
  private config: LegnaCodeConfig

  constructor(config?: LegnaCodeConfig) {
    this.config = config ?? {}
  }

  /** Initialize the transport connection. Called lazily on first use. */
  private async ensureConnected(): Promise<Transport> {
    if (this.transport?.isConnected()) return this.transport

    if (this.config.transport === 'websocket') {
      const url = `ws://127.0.0.1:${this.config.port ?? 3100}`
      const ws = new WebSocketTransport(url)
      await ws.start()
      this.transport = ws
    } else {
      const stdio = new StdioTransport(
        this.config.binaryPath,
        this.config.workingDir,
        {
          ...this.config.env,
          ...(this.config.apiKey ? { ANTHROPIC_API_KEY: this.config.apiKey } : {}),
          ...(this.config.model ? { ANTHROPIC_MODEL: this.config.model } : {}),
        },
      )
      await stdio.start()
      this.transport = stdio
    }

    return this.transport
  }

  /** Send a JSON-RPC request and return the result. */
  async call(method: string, params?: unknown): Promise<unknown> {
    const transport = await this.ensureConnected()
    const request: JsonRpcRequest = {
      jsonrpc: '2.0',
      id: nextId++,
      method,
      ...(params !== undefined ? { params } : {}),
    }
    const response: JsonRpcResponse = await transport.send(request)
    if (response.error) {
      const err = new Error(response.error.message) as Error & { code: number; data: unknown }
      err.code = response.error.code
      err.data = response.error.data
      throw err
    }
    return response.result
  }

  /** Create a new conversation thread. */
  async startThread(config?: ThreadConfig): Promise<Thread> {
    const result = (await this.call('thread/start', config ?? {})) as { threadId: string }
    return new Thread(result.threadId, this)
  }

  /** Resume an existing thread by ID. */
  async resumeThread(threadId: string): Promise<Thread> {
    await this.call('thread/resume', { threadId })
    return new Thread(threadId, this)
  }

  /** List all available threads. */
  async listThreads(): Promise<ThreadSummary[]> {
    return (await this.call('thread/list')) as ThreadSummary[]
  }

  /** Get the underlying transport (for notification subscriptions). */
  getTransport(): Transport | null {
    return this.transport
  }

  /** Close the client and release resources. */
  async close(): Promise<void> {
    await this.transport?.close()
    this.transport = null
  }
}
