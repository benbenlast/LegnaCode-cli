/**
 * File Memory Provider — default built-in implementation.
 *
 * Uses the existing .legna/memory/ markdown file system.
 * Always active as the first provider, cannot be removed.
 */

import { readFile, writeFile, readdir, mkdir } from 'fs/promises'
import { join } from 'path'
import { MemoryProvider, type ToolSchema } from './MemoryProvider.js'
import { getOriginalCwd } from '../../utils/cwd.js'
import { logForDebugging } from '../../utils/debug.js'

export class FileMemoryProvider extends MemoryProvider {
  readonly name = 'builtin'
  private memoryDir: string = ''

  isAvailable(): boolean {
    return true // Always available
  }

  async initialize(sessionId: string): Promise<void> {
    this.memoryDir = join(getOriginalCwd(), '.legna', 'memory')
    await mkdir(this.memoryDir, { recursive: true })
    logForDebugging(`[FileMemoryProvider] Initialized for session ${sessionId} at ${this.memoryDir}`)
  }

  systemPromptBlock(): string {
    return '' // Built-in memory is loaded separately by the existing system
  }

  async prefetch(query: string): Promise<string> {
    // Simple keyword search across memory files
    const keywords = query.toLowerCase().split(/\s+/).filter(w => w.length > 2)
    if (keywords.length === 0) return ''

    try {
      const files = (await readdir(this.memoryDir)).filter(f => f.endsWith('.md'))
      const matches: string[] = []

      for (const file of files) {
        const content = await readFile(join(this.memoryDir, file), 'utf-8')
        const lower = content.toLowerCase()
        const score = keywords.filter(kw => lower.includes(kw)).length
        if (score > 0) {
          matches.push(`[${file}] ${content.slice(0, 200)}`)
        }
      }

      if (matches.length > 0) {
        return `Relevant memory:\n${matches.slice(0, 5).join('\n---\n')}`
      }
    } catch {
      // Memory dir may not exist yet
    }
    return ''
  }

  async syncTurn(userContent: string, assistantContent: string): Promise<void> {
    // The existing memory system handles writes via MEMORY.md commands.
    // This is a no-op for the built-in provider — writes go through
    // the existing /memory command and memory tool.
    logForDebugging(`[FileMemoryProvider] syncTurn called (${userContent.length} + ${assistantContent.length} chars)`)
  }

  getToolSchemas(): ToolSchema[] {
    // Built-in memory tools are already registered in the main tool system.
    return []
  }

  async shutdown(): Promise<void> {
    logForDebugging('[FileMemoryProvider] Shutdown')
  }

  onSessionEnd(messages: unknown[]): void {
    logForDebugging(`[FileMemoryProvider] Session ended with ${messages.length} messages`)
  }

  onPreCompress(messages: unknown[]): string {
    // Extract key decisions from messages about to be compressed
    // so the compressor preserves them.
    return ''
  }
}
