/**
 * /auth-minimax command — configure MiniMax API key.
 */
import type { Command } from '../../commands.js'

const authMinimax = {
  type: 'local',
  name: 'auth-minimax',
  description: 'Configure MiniMax API key for multimodal tools (image, video, speech, music, search, vision)',
  isHidden: false,
  supportsNonInteractive: false,
  load: () => import('./auth-minimax.js'),
} satisfies Command

export default authMinimax
