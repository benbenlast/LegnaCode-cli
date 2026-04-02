// Assistant module — minimal KAIROS assistant mode implementation.
// Provides the exports that main.tsx references when feature('KAIROS') is on.

import { getSettingsForSource } from '../utils/settings/settings.js'

let _forced = false
let _activationPath = 'settings'

/**
 * Check if assistant mode is configured (settings.json `assistant: true`
 * or forced via --assistant CLI flag).
 */
export function isAssistantMode(): boolean {
  if (_forced) return true
  try {
    const settings = getSettingsForSource('localSettings') as
      | (Record<string, unknown> | null)
    return settings?.assistant === true
  } catch {
    return false
  }
}

/**
 * Called when --assistant CLI flag is passed. Forces assistant mode on
 * without checking settings.json.
 */
export function markAssistantForced(): void {
  _forced = true
  _activationPath = 'cli'
}

export function isAssistantForced(): boolean {
  return _forced
}

/**
 * System prompt addendum injected when assistant mode is active.
 * Instructs the model to use daily-log memory, SendUserMessage, etc.
 */
export function getAssistantSystemPromptAddendum(): string {
  return `# Assistant Mode

You are running as a persistent assistant. Your session may last hours or days.

## Key behaviors
- Use the daily log pattern for memories — append to \`logs/YYYY/MM/YYYY-MM-DD.md\`
- Use SendUserMessage for all user-facing output when brief mode is active
- Be proactive about useful work when the user is away
- Keep status updates brief and high-signal
- Use /dream periodically to consolidate memories into topic files

## Session continuity
When you wake up in a new session, read MEMORY.md to orient yourself. Your daily logs from previous sessions have been distilled there by the dream process.`
}

/**
 * Pre-seed an in-process team context. The full implementation sets up
 * teammate mode overrides for Agent spawning. Minimal version returns
 * an empty context — teammates still work via explicit TeamCreate.
 */
export async function initializeAssistantTeam(): Promise<{
  teamName?: string
}> {
  return {}
}

/**
 * Returns how assistant mode was activated (for analytics).
 */
export function getAssistantActivationPath(): string {
  return _activationPath
}
