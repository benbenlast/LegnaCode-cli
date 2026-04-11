/**
 * RPC Server — Unix Domain Socket server for code execution tool.
 *
 * Architecture (adapted from Hermes Agent code_execution_tool.py):
 * 1. Parent generates a legna_tools.js stub module with UDS RPC functions
 * 2. Parent opens a Unix domain socket and starts an RPC listener
 * 3. Parent spawns a child process that runs the AI's script
 * 4. Tool calls travel over the UDS back to the parent for dispatch
 *
 * Only the script's stdout is returned to the LLM; intermediate
 * tool results never enter the context window.
 *
 * Platform: Linux / macOS only (Unix domain sockets). Disabled on Windows.
 */

import { createServer, type Server, type Socket } from 'net'
import { tmpdir } from 'os'
import { join } from 'path'
import { randomUUID } from 'crypto'
import { unlink } from 'fs/promises'
import { logForDebugging } from '../../utils/debug.js'
import { findToolByName, type Tools, type ToolUseContext } from '../../Tool.js'

// Tools allowed inside the RPC sandbox
const SANDBOX_ALLOWED_TOOLS = new Set([
  'Bash',
  'Read',
  'Write',
  'Edit',
  'Glob',
  'Grep',
  'WebFetch',
])

const DEFAULT_TIMEOUT_MS = 300_000 // 5 minutes
const MAX_TOOL_CALLS = 50

export interface RpcServerOptions {
  tools: Tools
  toolUseContext: ToolUseContext
  timeout?: number
  maxToolCalls?: number
}

interface RpcRequest {
  tool: string
  args: Record<string, unknown>
}

export class RpcServer {
  private server: Server | null = null
  private socketPath: string
  private toolCallCount = 0
  private opts: Required<RpcServerOptions>

  constructor(opts: RpcServerOptions) {
    this.socketPath = join(tmpdir(), `legna-rpc-${randomUUID().slice(0, 8)}.sock`)
    this.opts = {
      ...opts,
      timeout: opts.timeout ?? DEFAULT_TIMEOUT_MS,
      maxToolCalls: opts.maxToolCalls ?? MAX_TOOL_CALLS,
    }
  }

  /** Start the UDS RPC server. Returns the socket path for the child process. */
  async start(): Promise<string> {
    // Clean up stale socket
    try { await unlink(this.socketPath) } catch {}

    return new Promise((resolve, reject) => {
      this.server = createServer((socket: Socket) => {
        this.handleConnection(socket)
      })
      this.server.on('error', reject)
      this.server.listen(this.socketPath, () => {
        logForDebugging(`[rpcServer] Listening on ${this.socketPath}`)
        resolve(this.socketPath)
      })
    })
  }

  /** Stop the server and clean up the socket file. */
  async stop(): Promise<void> {
    if (this.server) {
      this.server.close()
      this.server = null
    }
    try { await unlink(this.socketPath) } catch {}
    logForDebugging(`[rpcServer] Stopped. Total tool calls: ${this.toolCallCount}`)
  }

  private handleConnection(socket: Socket): void {
    let buffer = ''

    socket.on('data', (chunk: Buffer) => {
      buffer += chunk.toString()
      // Process complete newline-delimited JSON messages
      let newlineIdx: number
      while ((newlineIdx = buffer.indexOf('\n')) !== -1) {
        const line = buffer.slice(0, newlineIdx).trim()
        buffer = buffer.slice(newlineIdx + 1)
        if (line) {
          void this.handleRequest(socket, line)
        }
      }
    })

    socket.on('error', (err) => {
      logForDebugging(`[rpcServer] Socket error: ${err.message}`)
    })
  }

  private async handleRequest(socket: Socket, line: string): Promise<void> {
    let request: RpcRequest
    try {
      request = JSON.parse(line)
    } catch {
      socket.write(JSON.stringify({ error: 'Invalid JSON' }) + '\n')
      return
    }

    if (this.toolCallCount >= this.opts.maxToolCalls) {
      socket.write(JSON.stringify({ error: `Max tool calls (${this.opts.maxToolCalls}) exceeded` }) + '\n')
      return
    }

    const toolName = request.tool
    if (!SANDBOX_ALLOWED_TOOLS.has(toolName)) {
      socket.write(JSON.stringify({ error: `Tool "${toolName}" not allowed in sandbox` }) + '\n')
      return
    }

    const tool = findToolByName(this.opts.tools, toolName)
    if (!tool) {
      socket.write(JSON.stringify({ error: `Tool "${toolName}" not found` }) + '\n')
      return
    }

    this.toolCallCount++
    logForDebugging(`[rpcServer] Dispatching ${toolName} (call #${this.toolCallCount})`)

    try {
      const result = await tool.call(request.args as any, this.opts.toolUseContext)
      const data = result && typeof result === 'object' && 'data' in result ? result.data : result
      socket.write(JSON.stringify(data) + '\n')
    } catch (err: any) {
      socket.write(JSON.stringify({ error: err.message || 'Tool execution failed' }) + '\n')
    }
  }

  get stats() {
    return { socketPath: this.socketPath, toolCallCount: this.toolCallCount }
  }
}
