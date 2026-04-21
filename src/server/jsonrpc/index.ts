/**
 * JSON-RPC layer — barrel export.
 *
 * Provides the complete JSON-RPC 2.0 infrastructure for IDE integration:
 * - Router: method registration and dispatch
 * - Methods: thread, turn, fs, config, mcp, model, skills
 * - Transport: stdio (JSONL) and WebSocket
 * - Streaming: real-time notification push
 */

export { JsonRpcRouter } from './router.js'
export { StreamingNotifier, type NotificationSink } from './streaming.js'
export { StdioTransport } from './transport/stdio.js'
export { WebSocketTransport, type WebSocketTransportOptions } from './transport/websocket.js'

export {
  type JsonRpcRequest,
  type JsonRpcResponse,
  type JsonRpcNotification,
  type JsonRpcError,
  type MethodHandler,
  PARSE_ERROR,
  INVALID_REQUEST,
  METHOD_NOT_FOUND,
  INVALID_PARAMS,
  INTERNAL_ERROR,
  makeError,
  makeResult,
} from './types.js'

// Method registrars
export { registerThreadMethods } from './methods/thread.js'
export { registerTurnMethods } from './methods/turn.js'
export { registerFsMethods } from './methods/fs.js'
export { registerConfigMethods } from './methods/config.js'
export { registerMcpMethods } from './methods/mcp.js'
export { registerModelMethods } from './methods/model.js'
export { registerSkillsMethods } from './methods/skills.js'

/**
 * Create a fully-wired JSON-RPC router with all methods registered.
 */
export function createFullRouter(): import('./router.js').JsonRpcRouter {
  // Lazy imports to avoid circular deps at module level
  const { JsonRpcRouter: Router } = require('./router.js')
  const router = new Router()

  const { registerThreadMethods: regThread } = require('./methods/thread.js')
  const { registerTurnMethods: regTurn } = require('./methods/turn.js')
  const { registerFsMethods: regFs } = require('./methods/fs.js')
  const { registerConfigMethods: regConfig } = require('./methods/config.js')
  const { registerMcpMethods: regMcp } = require('./methods/mcp.js')
  const { registerModelMethods: regModel } = require('./methods/model.js')
  const { registerSkillsMethods: regSkills } = require('./methods/skills.js')

  regThread(router)
  regTurn(router)
  regFs(router)
  regConfig(router)
  regMcp(router)
  regModel(router)
  regSkills(router)

  return router
}
