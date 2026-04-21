/**
 * Transport layer — stdio and WebSocket implementations.
 *
 * Both transports speak JSONL (one JSON-RPC message per line).
 */

import { spawn, type ChildProcess } from 'child_process'
import { createInterface } from 'readline'
import type { JsonRpcRequest, JsonRpcResponse, JsonRpcNotification } from './types.js'

export interface Transport {
  send(request: JsonRpcRequest): Promise<JsonRpcResponse>
  onNotification(callback: (n: JsonRpcNotification) => void): void
  close(): Promise<void>
  isConnected(): boolean
}

type NotificationCallback = (n: JsonRpcNotification) => void

/**
 * Stdio transport — spawns `legnacode app-server --transport stdio`
 * and communicates via stdin/stdout JSONL.
 */
export class StdioTransport implements Transport {
  private proc: ChildProcess | null = null
  private pending = new Map<string | number, {
    resolve: (r: JsonRpcResponse) => void
    reject: (e: Error) => void
  }>()
  private notificationListeners: NotificationCallback[] = []
  private connected = false

  constructor(
    private binaryPath: string = 'legnacode',
    private workingDir?: string,
    private env?: Record<string, string>,
  ) {}

  /** Spawn the subprocess and start listening. */
  async start(): Promise<void> {
    if (this.connected) return

    this.proc = spawn(this.binaryPath, ['app-server', '--transport', 'stdio'], {
      cwd: this.workingDir,
      env: { ...process.env, ...this.env },
      stdio: ['pipe', 'pipe', 'pipe'],
    })

    const rl = createInterface({ input: this.proc.stdout!, terminal: false })
    rl.on('line', (line) => {
      const trimmed = line.trim()
      if (!trimmed) return
      try {
        const msg = JSON.parse(trimmed)
        if ('id' in msg && (msg.result !== undefined || msg.error !== undefined)) {
          const pending = this.pending.get(msg.id)
          if (pending) {
            this.pending.delete(msg.id)
            pending.resolve(msg as JsonRpcResponse)
          }
        } else if ('method' in msg && !('id' in msg)) {
          for (const cb of this.notificationListeners) cb(msg as JsonRpcNotification)
        }
      } catch { /* ignore malformed lines */ }
    })

    this.proc.on('exit', () => {
      this.connected = false
      for (const [, p] of this.pending) p.reject(new Error('Process exited'))
      this.pending.clear()
    })

    this.connected = true
  }

  async send(request: JsonRpcRequest): Promise<JsonRpcResponse> {
    if (!this.proc?.stdin?.writable) throw new Error('Transport not connected')
    return new Promise((resolve, reject) => {
      this.pending.set(request.id, { resolve, reject })
      this.proc!.stdin!.write(JSON.stringify(request) + '\n')
    })
  }

  onNotification(callback: NotificationCallback): void {
    this.notificationListeners.push(callback)
  }

  async close(): Promise<void> {
    this.connected = false
    this.proc?.kill('SIGTERM')
    this.proc = null
    for (const [, p] of this.pending) p.reject(new Error('Transport closed'))
    this.pending.clear()
  }

  isConnected(): boolean {
    return this.connected
  }
}

/**
 * WebSocket transport — connects to a running legnacode app-server
 * WebSocket endpoint.
 */
export class WebSocketTransport implements Transport {
  private ws: import('ws').WebSocket | null = null
  private pending = new Map<string | number, {
    resolve: (r: JsonRpcResponse) => void
    reject: (e: Error) => void
  }>()
  private notificationListeners: NotificationCallback[] = []
  private connected = false

  constructor(
    private url: string = 'ws://127.0.0.1:3100',
  ) {}

  async start(): Promise<void> {
    if (this.connected) return
    const { default: WebSocket } = await import('ws')
    this.ws = new WebSocket(this.url)

    await new Promise<void>((resolve, reject) => {
      this.ws!.on('open', () => { this.connected = true; resolve() })
      this.ws!.on('error', reject)
    })

    this.ws.on('message', (data) => {
      try {
        const msg = JSON.parse(String(data))
        if ('id' in msg && (msg.result !== undefined || msg.error !== undefined)) {
          const pending = this.pending.get(msg.id)
          if (pending) { this.pending.delete(msg.id); pending.resolve(msg) }
        } else if ('method' in msg && !('id' in msg)) {
          for (const cb of this.notificationListeners) cb(msg)
        }
      } catch { /* ignore */ }
    })

    this.ws.on('close', () => {
      this.connected = false
      for (const [, p] of this.pending) p.reject(new Error('WebSocket closed'))
      this.pending.clear()
    })
  }

  async send(request: JsonRpcRequest): Promise<JsonRpcResponse> {
    if (!this.ws || !this.connected) throw new Error('Transport not connected')
    return new Promise((resolve, reject) => {
      this.pending.set(request.id, { resolve, reject })
      this.ws!.send(JSON.stringify(request))
    })
  }

  onNotification(callback: NotificationCallback): void {
    this.notificationListeners.push(callback)
  }

  async close(): Promise<void> {
    this.connected = false
    this.ws?.close()
    this.ws = null
    for (const [, p] of this.pending) p.reject(new Error('Transport closed'))
    this.pending.clear()
  }

  isConnected(): boolean {
    return this.connected
  }
}
