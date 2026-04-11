/**
 * Skill Auto-Create — detect repeated patterns and suggest saving as skills.
 *
 * Inspired by Hermes Agent's self-improving tool creation.
 * Tracks tool call sequences within a session and suggests skill creation
 * when similar multi-step patterns repeat.
 */

import { logForDebugging } from '../utils/debug.js'

interface ToolCallRecord {
  toolName: string
  timestamp: number
}

interface PatternMatch {
  sequence: string[]
  count: number
  lastSeen: number
}

const MIN_SEQUENCE_LENGTH = 2
const MIN_REPEAT_COUNT = 2
const SEQUENCE_WINDOW_MS = 5 * 60 * 1000 // 5 minutes

/**
 * Tracks tool call sequences and detects repeated patterns.
 */
export class SkillPatternDetector {
  private history: ToolCallRecord[] = []
  private patterns = new Map<string, PatternMatch>()

  /**
   * Record a tool call.
   */
  record(toolName: string): void {
    this.history.push({ toolName, timestamp: Date.now() })
    // Keep only recent history
    const cutoff = Date.now() - SEQUENCE_WINDOW_MS
    this.history = this.history.filter(r => r.timestamp > cutoff)
    this.detectPatterns()
  }

  /**
   * Get patterns that have repeated enough to suggest skill creation.
   */
  getSuggestablePatterns(): PatternMatch[] {
    return [...this.patterns.values()].filter(
      p => p.count >= MIN_REPEAT_COUNT && p.sequence.length >= MIN_SEQUENCE_LENGTH,
    )
  }

  private detectPatterns(): void {
    const names = this.history.map(r => r.toolName)
    // Sliding window: check subsequences of length 2-5
    for (let len = MIN_SEQUENCE_LENGTH; len <= Math.min(5, names.length); len++) {
      for (let i = 0; i <= names.length - len; i++) {
        const seq = names.slice(i, i + len)
        const key = seq.join(' → ')
        const existing = this.patterns.get(key)
        if (existing) {
          // Only count if not overlapping with last detection
          if (Date.now() - existing.lastSeen > 10_000) {
            existing.count++
            existing.lastSeen = Date.now()
          }
        } else {
          this.patterns.set(key, { sequence: seq, count: 1, lastSeen: Date.now() })
        }
      }
    }
  }

  /**
   * Generate a skill suggestion message for the user.
   */
  getSuggestionMessage(): string | null {
    const patterns = this.getSuggestablePatterns()
    if (patterns.length === 0) return null

    const top = patterns.sort((a, b) => b.count - a.count)[0]!
    logForDebugging(
      `[skillAutoCreate] Detected repeated pattern: ${top.sequence.join(' → ')} (${top.count}x)`,
    )
    return `Detected repeated tool pattern: ${top.sequence.join(' → ')} (used ${top.count} times). Consider saving this as a skill with /skill create.`
  }
}

// Singleton instance
export const skillPatternDetector = new SkillPatternDetector()
