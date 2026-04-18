/**
 * Tool Intelligence — lightweight agent enhancements ported from AtomCode.
 *
 * 1. Loop detection: blocks repeated identical tool calls (same tool + same args hash)
 * 2. Error file pre-injection: extracts file paths from bash errors for auto-read
 * 3. First-read full file: forces full read on first encounter of a file
 *
 * All state resets on each user message. Zero new dependencies.
 */

import { createHash } from 'crypto'
import { existsSync } from 'fs'
import { readFileSync } from 'fs'

// ── Loop Detection ──────────────────────────────────────────────────

const MAX_REPEATS = 3
const recentCalls: Array<{ hash: string; tool: string }> = []

/** Record a tool call. Returns block message if loop detected, null otherwise. */
export function checkToolLoop(toolName: string, args: Record<string, unknown>): string | null {
  // For file reads, only hash the path (ignore offset/limit)
  const key = toolName === 'Read' || toolName === 'FileReadTool'
    ? String(args.file_path ?? args.path ?? '')
    : JSON.stringify(args)
  const hash = createHash('sha256').update(`${toolName}\0${key}`).digest('hex').slice(0, 16)

  const count = recentCalls.filter(c => c.hash === hash).length
  recentCalls.push({ hash, tool: toolName })
  // Keep only last 15 calls
  if (recentCalls.length > 15) recentCalls.splice(0, recentCalls.length - 15)

  if (count >= MAX_REPEATS) {
    return `[Loop detected] You've called ${toolName} with the same arguments ${count + 1} times. Stop retrying and try a fundamentally different approach.`
  }
  return null
}

/** Reset loop tracking (call on each new user message). */
export function resetToolIntelligence(): void {
  recentCalls.length = 0
  firstReadFiles.clear()
}

// ── Error File Pre-Injection ────────────────────────────────────────

const FILE_PATH_RE = /(?:^|\s|['"`])((?:\/[\w.-]+)+\.(?:ts|tsx|js|jsx|py|rs|go|java|c|cpp|h|hpp|rb|swift|kt|cs|vue|svelte|json|yaml|yml|toml|md))\b/g

/** Extract file paths from error output and read first 30 lines of each. */
export function extractErrorFiles(output: string, exitCode: number): string {
  if (exitCode === 0) return ''

  const paths = new Set<string>()
  let match: RegExpExecArray | null
  FILE_PATH_RE.lastIndex = 0
  while ((match = FILE_PATH_RE.exec(output)) !== null) {
    const p = match[1]!
    if (existsSync(p) && paths.size < 3) {
      paths.add(p)
    }
  }

  if (paths.size === 0) return ''

  const parts: string[] = ['\n[Auto-injected error context]']
  for (const p of paths) {
    try {
      const content = readFileSync(p, 'utf-8')
      const lines = content.split('\n').slice(0, 30)
      parts.push(`--- ${p} (first 30 lines) ---\n${lines.join('\n')}`)
    } catch { /* skip unreadable */ }
  }
  return parts.join('\n')
}

// ── First-Read Full File ────────────────────────────────────────────

const firstReadFiles = new Set<string>()

/**
 * Check if this is the first read of a file. If so, return true to force full read.
 * Subsequent reads use the AI's requested offset/limit.
 */
export function shouldForceFullRead(filePath: string): boolean {
  if (firstReadFiles.has(filePath)) return false
  firstReadFiles.add(filePath)
  return true
}
