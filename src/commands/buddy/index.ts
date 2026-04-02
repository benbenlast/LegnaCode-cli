import type { Command } from '../../commands.js'
import { isBuddyLive } from '../../buddy/useBuddyNotification.js'

const buddy = {
  type: 'local-jsx',
  name: 'buddy',
  description: 'Meet your coding companion',
  isEnabled: () => isBuddyLive(),
  isHidden: false,
  argumentHint: '[hatch|pet|mute|unmute|stats]',
  immediate: true,
  load: () => import('./buddy.js'),
} satisfies Command

export default buddy
