/**
 * JSON-RPC skills methods — list skills and collaboration modes.
 */

import type { JsonRpcRouter } from '../router.js'

export function registerSkillsMethods(router: JsonRpcRouter): void {
  router.register('skills/list', async () => {
    // Placeholder — will integrate with skill registry
    return { skills: [] }
  })

  router.register('collaborationMode/list', async () => {
    try {
      const { getModeManager } = await import('../../../services/collaborationModes/index.js')
      const manager = getModeManager()
      const modes = manager.listModes()
      const activeId = manager.getActiveModeId()
      return {
        modes: modes.map(m => ({
          id: m.id,
          name: m.name,
          description: m.description,
          active: m.id === activeId,
          behaviorFlags: m.behaviorFlags,
        })),
      }
    } catch {
      return { modes: [] }
    }
  })
}
