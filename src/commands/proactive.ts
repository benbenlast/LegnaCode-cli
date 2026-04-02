import { feature } from 'bun:bundle'
import type { Command, LocalJSXCommandContext, LocalJSXCommandOnDone } from '../types/command.js'
import type { ToolUseContext } from '../Tool.js'

const proactive = {
  type: 'local-jsx',
  name: 'proactive',
  description: 'Toggle proactive (autonomous) mode',
  isEnabled: () => {
    if (feature('PROACTIVE') || feature('KAIROS')) {
      return true
    }
    return false
  },
  immediate: true,
  load: () =>
    Promise.resolve({
      async call(
        onDone: LocalJSXCommandOnDone,
        _context: ToolUseContext & LocalJSXCommandContext,
      ): Promise<React.ReactNode> {
        /* eslint-disable @typescript-eslint/no-require-imports */
        const {
          isProactiveActive,
          activateProactive,
          deactivateProactive,
        } = require('../proactive/index.js') as typeof import('../proactive/index.js')
        /* eslint-enable @typescript-eslint/no-require-imports */

        if (isProactiveActive()) {
          deactivateProactive()
          onDone('Proactive mode disabled', { display: 'system' })
        } else {
          activateProactive('slash_command')
          onDone(
            'Proactive mode enabled — you will receive periodic <tick> prompts',
            { display: 'system' },
          )
        }
        return null
      },
    }),
} satisfies Command

export default proactive
