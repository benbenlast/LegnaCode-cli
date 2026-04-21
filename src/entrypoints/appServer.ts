/**
 * app-server entrypoint — standalone JSON-RPC server for IDE integration.
 *
 * Usage:
 *   legnacode app-server --transport stdio
 *   legnacode app-server --transport websocket --port 3100
 */

import { logForDebugging } from '../utils/debug.js'
import { JsonRpcRouter } from '../server/jsonrpc/router.js'
import { StreamingNotifier } from '../server/jsonrpc/streaming.js'
import { StdioTransport } from '../server/jsonrpc/transport/stdio.js'
import { WebSocketTransport } from '../server/jsonrpc/transport/websocket.js'
import { registerThreadMethods } from '../server/jsonrpc/methods/thread.js'
import { registerTurnMethods } from '../server/jsonrpc/methods/turn.js'
import { registerFsMethods } from '../server/jsonrpc/methods/fs.js'
import { registerConfigMethods } from '../server/jsonrpc/methods/config.js'
import { registerMcpMethods } from '../server/jsonrpc/methods/mcp.js'
import { registerModelMethods } from '../server/jsonrpc/methods/model.js'
import { registerSkillsMethods } from '../server/jsonrpc/methods/skills.js'

export interface AppServerOptions {
  transport: 'stdio' | 'websocket'
  port?: number
  host?: string
}

export async function startAppServer(options: AppServerOptions): Promise<void> {
  const router = new JsonRpcRouter()
  const notifier = new StreamingNotifier()

  // Register all methods
  registerThreadMethods(router)
  registerTurnMethods(router)
  registerFsMethods(router)
  registerConfigMethods(router)
  registerMcpMethods(router)
  registerModelMethods(router)
  registerSkillsMethods(router)

  // Register meta method
  router.register('rpc/listMethods', async () => {
    return { methods: router.listMethods() }
  })

  logForDebugging(`[AppServer] Starting with transport: ${options.transport}`)

  if (options.transport === 'stdio') {
    const transport = new StdioTransport(router, notifier)
    transport.start()
    logForDebugging('[AppServer] stdio transport started. Waiting for input...')
  } else if (options.transport === 'websocket') {
    const port = options.port ?? 3100
    const host = options.host ?? '127.0.0.1'
    const transport = new WebSocketTransport(router, notifier, { port, host })
    await transport.start()
    logForDebugging(`[AppServer] WebSocket transport started on ws://${host}:${port}`)

    // Graceful shutdown
    const shutdown = async () => {
      logForDebugging('[AppServer] Shutting down...')
      await transport.stop()
      process.exit(0)
    }
    process.on('SIGINT', shutdown)
    process.on('SIGTERM', shutdown)
  } else {
    throw new Error(`Unknown transport: ${options.transport}`)
  }
}

/**
 * Parse CLI args and start the app server.
 * Called from the main CLI entrypoint.
 */
export async function appServerMain(argv: string[]): Promise<void> {
  let transport: 'stdio' | 'websocket' = 'stdio'
  let port = 3100
  let host = '127.0.0.1'

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i]
    if (arg === '--transport' && argv[i + 1]) {
      transport = argv[++i] as 'stdio' | 'websocket'
    } else if (arg === '--port' && argv[i + 1]) {
      port = parseInt(argv[++i]!, 10)
    } else if (arg === '--host' && argv[i + 1]) {
      host = argv[++i]!
    }
  }

  await startAppServer({ transport, port, host })
}
