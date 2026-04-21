/**
 * SSH session creation.
 */
import type { SSHSessionManager } from './SSHSessionManager.js'

export interface SSHSession {
  createManager(opts: {
    onMessage: (msg: unknown) => void
    onPermissionRequest: (request: unknown, requestId: string) => void
  }): SSHSessionManager
  proxy: { stop(): void }
}
