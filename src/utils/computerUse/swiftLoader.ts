/**
 * Lazy loader for Computer Use Swift module — STUB.
 * The Python bridge replaces @ant/computer-use-swift entirely.
 * This file is kept so existing imports don't break at compile time.
 */

export function requireComputerUseSwift(): never {
  throw new Error(
    'requireComputerUseSwift is no longer available. ' +
    'Computer Use now uses the Python bridge (runtime/mac_helper.py). ' +
    'All callers should use callPythonBridge() instead.'
  )
}
