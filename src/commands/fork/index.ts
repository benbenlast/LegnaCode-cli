import type { Command } from '../../commands.js'

const fork = {
  type: 'local-jsx',
  name: 'fork',
  aliases: ['branch'],
  description: 'Fork conversation at current point or from a specific message',
  argumentHint: '[list | switch <id> | @N | <name>]',
  load: () => import('./fork.js'),
} satisfies Command

export default fork
