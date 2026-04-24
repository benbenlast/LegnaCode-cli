/**
 * Lazy loader for Computer Use Input module — STUB.
 * The Python bridge replaces @ant/computer-use-input entirely.
 * This file is kept so existing imports don't break at compile time.
 */

export function requireComputerUseInput(): never {
  throw new Error(
    'requireComputerUseInput is no longer available. ' +
    'Computer Use now uses the Python bridge (runtime/mac_helper.py). ' +
    'All callers should use callPythonBridge() instead.'
  )
}
