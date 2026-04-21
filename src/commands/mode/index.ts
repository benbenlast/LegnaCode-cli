/**
 * /mode command registration.
 */

import type { Command } from '../../commands.js'

export const modeCommand: Command = {
  type: 'local',
  name: 'mode',
  description: 'Switch collaboration mode (default, plan, execute, pair)',
  isEnabled: true,
  isHidden: false,
  async call(args: string[]) {
    const { getModeManager } = await import('../../services/collaborationModes/index.js')
    const manager = getModeManager()
    const target = args[0]?.trim()

    if (!target) {
      // List all modes
      const modes = manager.listModes()
      const activeId = manager.getActiveModeId()
      const lines = modes.map(m => {
        const marker = m.id === activeId ? ' ← active' : ''
        return `  ${m.id}: ${m.description}${marker}`
      })
      return {
        type: 'result' as const,
        result: `Available modes:\n${lines.join('\n')}`,
      }
    }

    // Switch mode
    const ok = manager.switchMode(target)
    if (!ok) {
      const available = manager.listModes().map(m => m.id).join(', ')
      return {
        type: 'result' as const,
        result: `Mode "${target}" not found. Available: ${available}`,
      }
    }

    const mode = manager.getActiveMode()
    const flags: string[] = []
    if (mode.behaviorFlags.readOnly) flags.push('read-only')
    if (mode.behaviorFlags.autoExecute) flags.push('auto-execute')
    if (mode.behaviorFlags.stepByStep) flags.push('step-by-step')
    if (mode.behaviorFlags.requirePlan) flags.push('require-plan')

    const flagStr = flags.length > 0 ? ` [${flags.join(', ')}]` : ''
    return {
      type: 'result' as const,
      result: `Switched to ${mode.name} mode.${flagStr}\n${mode.description}`,
    }
  },
}
