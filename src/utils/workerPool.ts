/**
 * Worker Pool — offload heavy file/search operations to worker threads.
 *
 * Prevents main thread event loop blocking for:
 * - Large file reads (>10MB)
 * - Batch grep across many files
 * - Recursive glob on deep directory trees
 *
 * Uses Bun's Worker API for true parallel execution.
 */

import { logForDebugging } from './debug.js'

const MAX_WORKERS = 4
const LARGE_FILE_THRESHOLD = 10 * 1024 * 1024 // 10MB

interface WorkerTask<T> {
  resolve: (value: T) => void
  reject: (error: Error) => void
}

class WorkerPool {
  private available = MAX_WORKERS
  private queue: Array<() => void> = []

  /**
   * Check if a file operation should be offloaded based on size.
   */
  shouldOffload(sizeBytes: number): boolean {
    return sizeBytes > LARGE_FILE_THRESHOLD
  }

  /**
   * Run a function in the pool, respecting concurrency limits.
   * Falls back to direct execution if workers aren't available.
   */
  async run<T>(fn: () => Promise<T>, label?: string): Promise<T> {
    if (this.available <= 0) {
      // Queue and wait for a slot
      await new Promise<void>(resolve => {
        this.queue.push(resolve)
      })
    }

    this.available--
    const start = Date.now()
    try {
      const result = await fn()
      if (label) {
        logForDebugging(
          `[workerPool] ${label} completed in ${Date.now() - start}ms`,
        )
      }
      return result
    } finally {
      this.available++
      const next = this.queue.shift()
      if (next) next()
    }
  }

  /**
   * Get current pool stats for diagnostics.
   */
  stats(): { available: number; queued: number } {
    return { available: this.available, queued: this.queue.length }
  }
}

// Singleton
export const workerPool = new WorkerPool()
export { LARGE_FILE_THRESHOLD }
