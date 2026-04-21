/**
 * JSON-RPC 2.0 router — method registration and request dispatch.
 */

import { logForDebugging } from '../../utils/debug.js'
import {
  INTERNAL_ERROR,
  INVALID_PARAMS,
  INVALID_REQUEST,
  METHOD_NOT_FOUND,
  PARSE_ERROR,
  makeError,
  makeResult,
  type JsonRpcNotification,
  type JsonRpcRequest,
  type JsonRpcResponse,
  type MethodHandler,
} from './types.js'

export class JsonRpcRouter {
  private handlers = new Map<string, MethodHandler>()
  private notificationHandlers = new Map<string, MethodHandler>()

  /** Register a method handler. */
  register(method: string, handler: MethodHandler): void {
    this.handlers.set(method, handler)
  }

  /** Register a notification handler (no response expected). */
  onNotification(method: string, handler: MethodHandler): void {
    this.notificationHandlers.set(method, handler)
  }

  /** List all registered methods. */
  listMethods(): string[] {
    return Array.from(this.handlers.keys())
  }

  /** Dispatch a JSON-RPC request and return a response. */
  async dispatch(request: JsonRpcRequest): Promise<JsonRpcResponse> {
    if (!request.method || typeof request.method !== 'string') {
      return makeError(request.id ?? 0, INVALID_REQUEST, 'Missing or invalid method.')
    }

    const handler = this.handlers.get(request.method)
    if (!handler) {
      return makeError(request.id, METHOD_NOT_FOUND, `Method not found: ${request.method}`)
    }

    try {
      const result = await handler(request.params)
      return makeResult(request.id, result)
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err)
      logForDebugging(`[JsonRpc] Error in ${request.method}: ${message}`)

      if (message.includes('Invalid params')) {
        return makeError(request.id, INVALID_PARAMS, message)
      }

      return makeError(request.id, INTERNAL_ERROR, message)
    }
  }

  /** Handle a notification (fire-and-forget). */
  async handleNotification(notification: JsonRpcNotification): Promise<void> {
    const handler = this.notificationHandlers.get(notification.method)
    if (handler) {
      try {
        await handler(notification.params)
      } catch (err) {
        logForDebugging(`[JsonRpc] Notification error in ${notification.method}: ${err}`)
      }
    }
  }

  /**
   * Parse a raw JSON string and dispatch.
   * Returns null for notifications, a response for requests.
   */
  async handleRaw(raw: string): Promise<JsonRpcResponse | null> {
    let parsed: unknown
    try {
      parsed = JSON.parse(raw)
    } catch {
      return makeError(0, PARSE_ERROR, 'Parse error: invalid JSON.')
    }

    const msg = parsed as Record<string, unknown>

    if (msg.jsonrpc !== '2.0') {
      return makeError((msg.id as number) ?? 0, INVALID_REQUEST, 'Missing jsonrpc: "2.0".')
    }

    // Notification (no id)
    if (!('id' in msg) && typeof msg.method === 'string') {
      await this.handleNotification(msg as unknown as JsonRpcNotification)
      return null
    }

    // Request
    return this.dispatch(msg as unknown as JsonRpcRequest)
  }
}
