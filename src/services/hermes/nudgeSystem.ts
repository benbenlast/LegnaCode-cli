/**
 * Nudge System — counter-driven learning status reports.
 *
 * Tracks tool calls, corrections, and auto-created skills within a session.
 * When thresholds are reached, injects a status report of what was
 * automatically learned — not a suggestion to go learn.
 */

import { logForDebugging } from '../../utils/debug.js'

// Closure-scoped state (same pattern as autoDream)
let toolCallCount = 0
let correctionCount = 0
let autoCreatedSkills: string[] = []
let autoLearnedCount = 0
let lastNudgeTurn = 0

const TOOL_CALL_THRESHOLD = 20
const MIN_TURNS_BETWEEN_NUDGES = 10

/** Called from tool execution path (alongside skillPatternDetector.record). */
export function tickToolCall(): void {
  toolCallCount++
}

/** Called when a behavior correction is auto-written to memory. */
export function tickCorrection(): void {
  correctionCount++
}

/** Called when a skill is auto-created from patterns. */
export function tickSkillCreated(skillName: string): void {
  autoCreatedSkills.push(skillName)
}

/** Called when a learning is auto-written to memory. */
export function tickAutoLearned(): void {
  autoLearnedCount++
}

/** Check if a nudge should be injected into the system prompt. */
export function shouldNudge(currentTurn: number): boolean {
  if (currentTurn - lastNudgeTurn < MIN_TURNS_BETWEEN_NUDGES) return false
  // Only nudge if something was actually learned
  return correctionCount > 0 || autoCreatedSkills.length > 0 || autoLearnedCount > 0
}

/**
 * Generate nudge content — reports what was automatically learned this session.
 * Returns empty string if nothing was learned yet.
 */
export function getNudgeContent(currentTurn: number): string {
  if (!shouldNudge(currentTurn)) return ''

  const parts: string[] = []

  if (autoCreatedSkills.length > 0) {
    parts.push(`Auto-created ${autoCreatedSkills.length} skill(s): ${autoCreatedSkills.join(', ')}`)
  }

  if (autoLearnedCount > 0) {
    parts.push(`Auto-recorded ${autoLearnedCount} learning(s) to memory`)
  }

  if (correctionCount > 0) {
    parts.push(`Captured ${correctionCount} behavior correction(s)`)
  }

  if (parts.length === 0) return ''

  lastNudgeTurn = currentTurn
  const content = `[Session Learning Summary]\n${parts.join('\n')}\nThese are available for future sessions automatically.`
  logForDebugging(`[nudge] Learning summary at turn ${currentTurn}`)
  return content
}

/** Reset counters (for testing or session boundaries). */
export function resetNudgeCounters(): void {
  toolCallCount = 0
  correctionCount = 0
  autoCreatedSkills = []
  autoLearnedCount = 0
  lastNudgeTurn = 0
}
