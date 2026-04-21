/**
 * stdio transport — JSONL over stdin/stdout.
 *
 * Reads one JSON-RPC message per line from stdin,
 * writes one JSON-RPC response per line to stdout.
 */

import { createInterface } from 'readline'
import type { JsonRpcRouter } from '../router.js'
import type { StreamingNotifier } from '../streaming.js'
import type { JsonRpcNotification } from '../types.js'

export class StdioTransport {
  private running = false

  constructor(
    private router: JsonRpcRouter,
    private notifier?: StreamingNotifier,
  ) {}

  /** Start listening on stdin. */
  start(): void {
    if (this.running) return
    this.running = true

    // Wire up streaming notifications to stdout
    if (this.notifier) {
      this.notifier.addSink((n: JsonRpcNotification) => {
        this.writeLine(JSON.stringify(n))
      })
    }

    const rl = createInterface({ input: process.stdin, terminal: false })

    rl.on('line', async (line) => {
      const trimmed = line.trim()
      if (!trimmed) return

      const response = await this.router.handleRaw(trimmed)
      if (response) {
        this.writeLine(JSON.stringify(response))
      }
    })

    rl.on('close', () => {
      this.running = false
    })
  }

  /** Write a line to stdout. */
  private writeLine(data: string): void {
    process.stdout.write(data + '\n')
  }

  /** Check if transport is running. */
  isRunning(): boolean {
    return this.running
  }
}
