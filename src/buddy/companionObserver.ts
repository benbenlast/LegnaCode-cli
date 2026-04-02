import type { Message } from '../types/message.js'
import { getCompanion } from './companion.js'
import { getGlobalConfig } from '../utils/config.js'

// Quips the companion can say after a turn completes.
// Kept short so the speech bubble doesn't dominate the UI.
const QUIPS = [
  'Nice one!',
  'Hmm, interesting...',
  'I learned something!',
  'That was a lot of code.',
  'Are we there yet?',
  'Ooh, shiny!',
  '*yawns*',
  'I believe in you!',
  'Bugs? What bugs?',
  'Ship it!',
  '*scribbles notes*',
  'Wait, what just happened?',
  'You make it look easy.',
  'More tests, more better.',
  'I smell a refactor...',
]

// Fire rate: ~30% chance per turn to avoid being annoying.
const FIRE_RATE = 0.3

export async function fireCompanionObserver(
  messages: Message[],
  onReaction: (reaction: string) => void,
): Promise<void> {
  const companion = getCompanion()
  if (!companion || getGlobalConfig().companionMuted) return
  if (messages.length < 2) return
  if (Math.random() > FIRE_RATE) return

  const quip = QUIPS[Math.floor(Math.random() * QUIPS.length)]!
  onReaction(quip)
}
