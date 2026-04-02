import { isAutoMemoryEnabled, getAutoMemPath } from '../../memdir/paths.js'
import { registerBundledSkill } from '../bundledSkills.js'
import { buildConsolidationPrompt } from '../../services/autoDream/consolidationPrompt.js'
import { getProjectDir } from '../../utils/sessionStorage.js'
import { getOriginalCwd } from '../../bootstrap/state.js'

export function registerDreamSkill(): void {
  registerBundledSkill({
    name: 'dream',
    description:
      'Consolidate and organize your memory files — synthesize recent sessions into durable, well-organized memories.',
    whenToUse:
      'Use when the user wants to organize, consolidate, or clean up memory files, or when memories have accumulated and need distillation.',
    userInvocable: true,
    isEnabled: () => isAutoMemoryEnabled(),
    async getPromptForCommand(args) {
      const memoryRoot = getAutoMemPath()
      const transcriptDir = getProjectDir(getOriginalCwd())
      const extra = args ? `\nUser request: ${args}` : ''
      const prompt = buildConsolidationPrompt(memoryRoot, transcriptDir, extra)
      return [{ type: 'text', text: prompt }]
    },
  })
}
