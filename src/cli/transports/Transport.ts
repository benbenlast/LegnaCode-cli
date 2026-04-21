/**
 * Transport interface for CLI remote connections (SSE, WebSocket).
 */

export interface Transport {
  connect(): Promise<void>
  write(data: string): void | Promise<void>
  close(): void | Promise<void>
  setOnData(callback: (data: string) => void): void
  setOnClose?(callback: (closeCode?: number) => void): void
  setOnConnect?(callback: () => void): void
}
