/**
 * CFRunLoop drain — STUB. The Python bridge approach doesn't need
 * CFRunLoop pumping since all native calls go through subprocess I/O.
 * This file is kept as a no-op shim so existing imports don't break.
 */

export const retainPump = (): void => {}
export const releasePump = (): void => {}

export async function drainRunLoop<T>(fn: () => Promise<T>): Promise<T> {
  return fn()
}
