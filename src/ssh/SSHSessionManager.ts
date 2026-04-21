/**
 * SSH session manager interface.
 */
export interface SSHSessionManager {
  connect(): void
  sendMessage(content: unknown): Promise<boolean>
  sendInterrupt(): void
  disconnect(): void
}
