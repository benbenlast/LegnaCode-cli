/**
 * Thread — represents a single conversation thread.
 *
 * Wraps JSON-RPC calls to the app-server's turn/* methods.
 */

import type { LegnaCode } from './client.js'
import type { TurnResult, StreamEvent, JsonRpcNotification } from './types.js'

export class Thread {
  readonly id: string
  private client: LegnaCode

  constructor(id: string, client: LegnaCode) {
    this.id = id
    this.client = client
  }

  /** Run a prompt synchronously — waits for the full turn to complete. */
  async run(prompt: string): Promise<TurnResult> {
    return (await this.client.call('turn/run', {
      threadId: this.id,
      prompt,
    })) as TurnResult
  }

  /** Run a prompt with streaming — yields events as they arrive. */
  async *runStreamed(prompt: string): AsyncGenerator<StreamEvent> {
    const transport = this.client.getTransport()
    if (!transport) throw new Error('Client not connected')

    // Set up notification listener before sending the request
    const events: StreamEvent[] = []
    let resolve: (() => void) | null = null
    let done = false

    const handler = (n: JsonRpcNotification) => {
      if (n.method === 'turn/event') {
        const event = n.params as StreamEvent
        events.push(event)
        if (event.type === 'turn.completed') done = true
        resolve?.()
      }
    }

    transport.onNotification(handler)

    // Fire the streaming request
    this.client.call('turn/runStreamed', {
      threadId: this.id,
      prompt,
    }).catch(() => { done = true; resolve?.() })

    // Yield events as they arrive
    while (!done) {
      if (events.length === 0) {
        await new Promise<void>((r) => { resolve = r })
      }
      while (events.length > 0) {
        yield events.shift()!
      }
    }
  }

  /** Inject input mid-turn (steering). */
  async steer(input: string): Promise<void> {
    await this.client.call('turn/steer', { threadId: this.id, input })
  }

  /** Interrupt the current turn. */
  async interrupt(): Promise<void> {
    await this.client.call('turn/interrupt', { threadId: this.id })
  }

  /** Fork this thread into a new branch. */
  async fork(): Promise<Thread> {
    const result = (await this.client.call('thread/fork', {
      threadId: this.id,
    })) as { threadId: string }
    return new Thread(result.threadId, this.client)
  }

  /** Rollback to a specific turn or checkpoint. */
  async rollback(target: string): Promise<void> {
    await this.client.call('thread/rollback', { threadId: this.id, target })
  }

  /** Compact/summarize the conversation history. */
  async compact(): Promise<void> {
    await this.client.call('thread/compact', { threadId: this.id })
  }

  /** Attach an image to the next turn. */
  async attachImage(pathOrUrl: string): Promise<void> {
    await this.client.call('thread/attachImage', {
      threadId: this.id,
      pathOrUrl,
    })
  }
}
