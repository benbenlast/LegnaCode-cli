/**
 * Collaboration mode manager — runtime mode switching.
 *
 * Manages the active collaboration mode and applies its template
 * to the system prompt.
 */

import { logForDebugging } from '../../utils/debug.js'
import { loadAllModes } from './modeLoader.js'
import type { CollaborationMode } from './types.js'

export class CollaborationModeManager {
  private modes: Map<string, CollaborationMode> = new Map()
  private activeModeId: string = 'default'

  constructor() {
    this.reload()
  }

  /** Reload all modes from disk. */
  reload(): void {
    this.modes.clear()
    for (const mode of loadAllModes()) {
      this.modes.set(mode.id, mode)
    }
    // Ensure default exists
    if (!this.modes.has('default')) {
      this.modes.set('default', {
        id: 'default',
        name: 'Default',
        description: 'Standard coding assistant mode',
        systemPromptTemplate: 'You are a helpful coding assistant.',
        behaviorFlags: {
          readOnly: false,
          autoExecute: false,
          stepByStep: false,
          requirePlan: false,
        },
      })
    }
  }

  /** List all available modes. */
  listModes(): CollaborationMode[] {
    return Array.from(this.modes.values())
  }

  /** Get the currently active mode. */
  getActiveMode(): CollaborationMode {
    return this.modes.get(this.activeModeId) ?? this.modes.get('default')!
  }

  /** Get the active mode ID. */
  getActiveModeId(): string {
    return this.activeModeId
  }

  /** Switch to a different mode by ID. Returns false if mode not found. */
  switchMode(id: string): boolean {
    if (!this.modes.has(id)) {
      logForDebugging(`[ModeManager] Mode "${id}" not found.`)
      return false
    }
    this.activeModeId = id
    logForDebugging(`[ModeManager] Switched to mode: ${id}`)
    return true
  }

  /** Get a mode by ID. */
  getMode(id: string): CollaborationMode | undefined {
    return this.modes.get(id)
  }

  /**
   * Apply the active mode's template to a base system prompt.
   * Inserts the mode template as a section within the prompt.
   */
  applyMode(baseSystemPrompt: string): string {
    const mode = this.getActiveMode()

    if (mode.id === 'default') {
      return baseSystemPrompt
    }

    const modeSection = [
      '',
      `<collaboration_mode id="${mode.id}" name="${mode.name}">`,
      mode.systemPromptTemplate,
      '</collaboration_mode>',
      '',
    ].join('\n')

    return baseSystemPrompt + modeSection
  }

  /**
   * Check if a tool is allowed in the current mode.
   */
  isToolAllowed(toolName: string): boolean {
    const mode = this.getActiveMode()
    if (!mode.toolRestrictions) return true

    const { allowed, denied } = mode.toolRestrictions

    if (denied && denied.includes(toolName)) return false
    if (allowed && allowed.length > 0 && !allowed.includes(toolName)) return false

    return true
  }
}

// ── Singleton ────────────────────────────────────────────────────────────

let _instance: CollaborationModeManager | null = null

export function getModeManager(): CollaborationModeManager {
  if (!_instance) {
    _instance = new CollaborationModeManager()
  }
  return _instance
}

export function resetModeManagerForTesting(): void {
  _instance = null
}
