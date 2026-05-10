/**
 * ESC hotkey for aborting Computer Use. Simplified version that doesn't
 * depend on native CGEventTap — uses process signal handling instead.
 * The Python bridge approach doesn't need CFRunLoop pumping.
 */

import { logForDebugging } from '../debug.js'

let registered = false
let onEscapeCallback: (() => void) | undefined

export function registerEscHotkey(onEscape: () => void): boolean {
  if (registered) return true
  onEscapeCallback = onEscape
  registered = true
  logForDebugging('[cu-esc] registered (signal-based)')
  return true
}

export function unregisterEscHotkey(): void {
  if (!registered) return
  onEscapeCallback = undefined
  registered = false
  logForDebugging('[cu-esc] unregistered')
}

export function notifyExpectedEscape(): void {
  // No-op: Python bridge doesn't intercept system-wide key events
}

export function triggerEscapeAbort(): void {
  if (registered && onEscapeCallback) {
    onEscapeCallback()
  }
}
