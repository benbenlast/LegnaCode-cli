/**
 * Budget Pressure — inject context budget warnings into tool results.
 *
 * When context usage exceeds a threshold, append a gentle nudge to tool
 * results so the model knows to wrap up. This avoids hard cutoffs.
 */

const PRESSURE_THRESHOLD = 0.80 // 80% of context window
const CRITICAL_THRESHOLD = 0.92 // 92% — urgent

/**
 * Generate a budget pressure message based on usage ratio.
 * Returns null if no pressure needed.
 */
export function getBudgetPressureMessage(
  usedTokens: number,
  maxTokens: number,
): string | null {
  if (maxTokens <= 0) return null
  const ratio = usedTokens / maxTokens

  if (ratio >= CRITICAL_THRESHOLD) {
    return `[Context budget critical: ${Math.round(ratio * 100)}% used. Finish current task immediately and summarize results.]`
  }
  if (ratio >= PRESSURE_THRESHOLD) {
    return `[Context budget at ${Math.round(ratio * 100)}%. Consider wrapping up the current task soon.]`
  }
  return null
}

/**
 * Append budget pressure to a tool result string if needed.
 */
export function appendBudgetPressure(
  toolResult: string,
  usedTokens: number,
  maxTokens: number,
): string {
  const msg = getBudgetPressureMessage(usedTokens, maxTokens)
  if (!msg) return toolResult
  return `${toolResult}\n\n${msg}`
}
