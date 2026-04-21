/**
 * WebSocket transport — JSON-RPC over WebSocket.
 *
 * Supports multiple concurrent connections with heartbeat keepalive.
 * Uses the `ws` package if available, otherwise provides a no-op stub.
 */

import { createServer, type Server as HttpServer } from 'http'
import { logForDebugging } from '../../../utils/debug.js'
import type { JsonRpcRouter } from '../router.js'
import type { StreamingNotifier } from '../streaming.js'
import type { JsonRpcNotification } from '../types.js'

export interface WebSocketTransportOptions {
  port: number
  host?: string
  heartbeatInterval?: number // ms, default 30000
}

interface WsLike {
  send(data: string): void
  on(event: string, cb: (...args: unknown[]) => void): void
  close(): void
  readyState: number
  ping?(): void
}

interface WsServerLike {
  on(event: string, cb: (...args: unknown[]) => void): void
  close(cb?: () => void): void
}

export class WebSocketTransport {
  private httpServer: HttpServer | null = null
  private wss: WsServerLike | null = null
  private clients = new Set<WsLike>()
  private heartbeatTimer: ReturnType<typeof setInterval> | null = null
  private running = false

  constructor(
    private router: JsonRpcRouter,
    private notifier?: StreamingNotifier,
    private options: WebSocketTransportOptions = { port: 3100 },
  ) {}

  /** Start the WebSocket server. */
  async start(): Promise<void> {
    if (this.running) return

    // Dynamic import — ws may not be installed
    let WebSocketServer: unknown
    try {
      const ws = await import('ws')
      WebSocketServer = ws.WebSocketServer ?? (ws as Record<string, unknown>).default?.Server
    } catch {
      logForDebugging('[WsTransport] ws package not available. WebSocket transport disabled.')
      return
    }

    this.httpServer = createServer()
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    this.wss = new (WebSocketServer as any)({ server: this.httpServer }) as WsServerLike

    // Wire up streaming notifications
    if (this.notifier) {
      this.notifier.addSink((n: JsonRpcNotification) => {
        this.broadcast(JSON.stringify(n))
      })
    }

    this.wss.on('connection', (ws: WsLike) => {
      this.clients.add(ws)
      logForDebugging(`[WsTransport] Client connected. Total: ${this.clients.size}`)

      ws.on('message', async (data: unknown) => {
        const raw = typeof data === 'string' ? data : String(data)
        const response = await this.router.handleRaw(raw)
        if (response) {
          ws.send(JSON.stringify(response))
        }
      })

      ws.on('close', () => {
        this.clients.delete(ws)
        logForDebugging(`[WsTransport] Client disconnected. Total: ${this.clients.size}`)
      })

      ws.on('error', (err: unknown) => {
        logForDebugging(`[WsTransport] Client error: ${err}`)
        this.clients.delete(ws)
      })
    })

    // Heartbeat
    const interval = this.options.heartbeatInterval ?? 30_000
    this.heartbeatTimer = setInterval(() => {
      for (const ws of this.clients) {
        if (ws.readyState === 1 && ws.ping) {
          ws.ping()
        }
      }
    }, interval)

    const host = this.options.host ?? '127.0.0.1'
    const port = this.options.port

    await new Promise<void>((resolve) => {
      this.httpServer!.listen(port, host, () => {
        this.running = true
        logForDebugging(`[WsTransport] Listening on ws://${host}:${port}`)
        resolve()
      })
    })
  }

  /** Broadcast a message to all connected clients. */
  private broadcast(data: string): void {
    for (const ws of this.clients) {
      if (ws.readyState === 1) {
        try { ws.send(data) } catch { /* skip broken clients */ }
      }
    }
  }

  /** Stop the WebSocket server. */
  async stop(): Promise<void> {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer)
      this.heartbeatTimer = null
    }
    for (const ws of this.clients) {
      ws.close()
    }
    this.clients.clear()

    await new Promise<void>((resolve) => {
      if (this.wss) this.wss.close(() => resolve())
      else resolve()
    })

    await new Promise<void>((resolve) => {
      if (this.httpServer) this.httpServer.close(() => resolve())
      else resolve()
    })

    this.running = false
  }

  isRunning(): boolean {
    return this.running
  }

  getClientCount(): number {
    return this.clients.size
  }
}
