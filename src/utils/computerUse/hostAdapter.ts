import type {
  ComputerUseHostAdapter,
  Logger,
} from './mcp/types.js'
import { execFile } from 'child_process'
import { format } from 'util'
import { promisify } from 'util'
import { logForDebugging } from '../debug.js'
import { COMPUTER_USE_MCP_SERVER_NAME } from './common.js'
import { createCliExecutor } from './executor.js'
import { getChicagoEnabled, getChicagoSubGates } from './gates.js'
import { callPythonBridge } from './pythonBridge.js'

const execFileAsync = promisify(execFile)

// ── macOS permission check via inline Swift (no Python needed) ──────────────

const SWIFT_PERMISSION_CHECK = `
import Cocoa
import CoreGraphics

let opts = [kAXTrustedCheckOptionPrompt.takeUnretainedValue() as String: true] as CFDictionary
let ax = AXIsProcessTrustedWithOptions(opts)
CGRequestScreenCaptureAccess()
let sr = CGPreflightScreenCaptureAccess()
print("{\\"accessibility\\":\\(ax),\\"screenRecording\\":\\(sr)}")
`

async function checkMacPermissions(): Promise<{ accessibility: boolean; screenRecording: boolean }> {
  try {
    const { stdout } = await execFileAsync('swift', ['-e', SWIFT_PERMISSION_CHECK], {
      timeout: 10_000,
    })
    return JSON.parse(stdout.trim())
  } catch (err) {
    logForDebugging(`[computer-use] Swift permission check failed: ${err}`)
    return { accessibility: false, screenRecording: false }
  }
}

class DebugLogger implements Logger {
  silly(message: string, ...args: unknown[]): void {
    logForDebugging(format(message, ...args), { level: 'debug' })
  }
  debug(message: string, ...args: unknown[]): void {
    logForDebugging(format(message, ...args), { level: 'debug' })
  }
  info(message: string, ...args: unknown[]): void {
    logForDebugging(format(message, ...args), { level: 'info' })
  }
  warn(message: string, ...args: unknown[]): void {
    logForDebugging(format(message, ...args), { level: 'warn' })
  }
  error(message: string, ...args: unknown[]): void {
    logForDebugging(format(message, ...args), { level: 'error' })
  }
}

let cached: ComputerUseHostAdapter | undefined

/**
 * Process-lifetime singleton. Built once on first CU tool call.
 * Uses Python bridge instead of native modules — no degraded mode,
 * but requires Python + venv to be set up.
 */
export function getComputerUseHostAdapter(): ComputerUseHostAdapter {
  if (cached) return cached
  cached = {
    serverName: COMPUTER_USE_MCP_SERVER_NAME,
    logger: new DebugLogger(),
    executor: createCliExecutor({
      getMouseAnimationEnabled: () => getChicagoSubGates().mouseAnimation,
      getHideBeforeActionEnabled: () => getChicagoSubGates().hideBeforeAction,
    }),
    ensureOsPermissions: async () => {
      if (process.platform === 'win32') {
        return { granted: true }
      }

      if (process.platform === 'darwin') {
        const perms = await checkMacPermissions()
        const { accessibility, screenRecording } = perms

        if (accessibility && screenRecording) {
          return { granted: true }
        }

        // Auto-open the relevant System Settings pane
        const missing: string[] = []
        if (!accessibility) missing.push('Accessibility (辅助功能)')
        if (!screenRecording) missing.push('Screen Recording (屏幕录制)')
        logForDebugging(
          `[computer-use] Missing macOS permissions: ${missing.join(', ')}. Opening System Settings...`,
        )
        try {
          if (!accessibility) {
            execFile('open', ['x-apple.systempreferences:com.apple.preference.security?Privacy_Accessibility'])
          }
          if (!screenRecording) {
            execFile('open', ['x-apple.systempreferences:com.apple.preference.security?Privacy_ScreenCapture'])
          }
        } catch {}

        return { granted: false, accessibility, screenRecording }
      }

      // Unsupported platform
      return { granted: false, accessibility: false, screenRecording: false }
    },
    isDisabled: () => !getChicagoEnabled(),
    getSubGates: getChicagoSubGates,
    getAutoUnhideEnabled: () => true,
    // Pixel validation via Python PIL crop — returns null to skip for now.
    // The sub-gate defaults to false anyway.
    cropRawPatch: () => null,
  }
  return cached
}
