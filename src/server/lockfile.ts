/**
 * Server lockfile management.
 */
export async function probeRunningServer(): Promise<{ pid: number; httpUrl: string } | null> {
  return null
}
export async function writeServerLock(_info: {
  pid: number; port: number; host: string; httpUrl: string; startedAt: number
}): Promise<void> {}
export async function removeServerLock(): Promise<void> {}
