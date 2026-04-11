/**
 * /recall command — search historical sessions for relevant context.
 */
import type { Command } from '../../commands.js'

const recall = {
  type: 'local',
  name: 'recall',
  description: 'Search past sessions for relevant context (e.g. /recall "auth bug fix")',
  isHidden: false,
  supportsNonInteractive: false,
  load: () => import('./recall.js'),
} satisfies Command

export default recall
