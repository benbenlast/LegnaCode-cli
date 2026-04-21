/**
 * Server session manager.
 */
export class SessionManager {
  constructor(_backend: unknown, _opts: { idleTimeoutMs?: number; maxSessions?: number }) {}
  async destroyAll(): Promise<void> {}
}
