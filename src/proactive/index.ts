// Proactive module — manages the "always-on" autonomous tick loop.
// Activated by --proactive flag, /proactive command, or CLAUDE_CODE_PROACTIVE env.

const _subscribers = new Set<() => void>()
let _active = false
let _paused = false
let _contextBlocked = false
let _source: string | undefined

function notify(): void {
  for (const cb of _subscribers) cb()
}

/** Whether proactive mode is enabled (for tool filtering, system prompt). */
export function isProactiveActive(): boolean {
  return _active
}

/** Whether tick delivery is currently suppressed. */
export function isTickingSuppressed(): boolean {
  return _paused || _contextBlocked
}

export function activateProactive(source: string): void {
  if (_active) return
  _active = true
  _source = source
  notify()
}

export function deactivateProactive(): void {
  if (!_active) return
  _active = false
  _paused = false
  _contextBlocked = false
  _source = undefined
  notify()
}

export function pauseProactive(): void {
  if (_paused) return
  _paused = true
  notify()
}

export function resumeProactive(): void {
  if (!_paused) return
  _paused = false
  notify()
}

export function setContextBlocked(blocked: boolean): void {
  if (_contextBlocked === blocked) return
  _contextBlocked = blocked
  notify()
}

export function getProactiveSource(): string | undefined {
  return _source
}

/** useSyncExternalStore-compatible subscribe. */
export function subscribeToProactiveChanges(
  callback: () => void,
): () => void {
  _subscribers.add(callback)
  return () => {
    _subscribers.delete(callback)
  }
}

/** Default interval between ticks (ms). */
export function getTickInterval(): number {
  return 30_000
}
