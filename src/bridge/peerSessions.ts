/**
 * Peer session messaging for inter-Claude communication.
 */
export async function postInterClaudeMessage(
  target: string,
  message: string,
): Promise<{ ok: boolean; error?: string }> {
  return { ok: false, error: 'Peer sessions not available' }
}
