// Stub: sessionDiscovery — remote session discovery not available.
// Provides a no-op export so the KAIROS-gated dynamic import in main.tsx resolves.

export type AssistantSession = {
  sessionId: string
  name?: string
  createdAt?: string
}

export async function discoverAssistantSessions(): Promise<AssistantSession[]> {
  return []
}
