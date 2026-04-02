// Stub: sessionTranscript module — not included in source extraction.
// Provides no-op exports so KAIROS-gated callers in compact.ts don't crash.

import type { Message } from '../../types/message.js'

export async function writeSessionTranscriptSegment(
  _messages: Message[],
): Promise<void> {
  // no-op — session transcript infrastructure not available
}
