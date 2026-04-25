import type {
  ComputerUseHostAdapter,
  Logger,
} from './mcp/types.js'
import { format } from 'util'
import { logForDebugging } from '../debug.js'
import { COMPUTER_USE_MCP_SERVER_NAME } from './common.js'
import { createCliExecutor } from './executor.js'
import { getChicagoEnabled, getChicagoSubGates } from './gates.js'
import { callPythonBridge } from './pythonBridge.js'

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
      try {
        const perms = await callPythonBridge<{
          accessibility: boolean
          screenRecording: boolean | null
        }>('check_permissions')
        const accessibility = perms.accessibility === true
        const screenRecording = perms.screenRecording === true

        if (accessibility && screenRecording) {
          return { granted: true }
        }

        // Guide user to grant permissions on macOS
        if (process.platform === 'darwin') {
          const missing: string[] = []
          if (!accessibility) missing.push('Accessibility (辅助功能)')
          if (!screenRecording) missing.push('Screen Recording (屏幕录制)')
          logForDebugging(
            `[computer-use] Missing macOS permissions: ${missing.join(', ')}. ` +
            `Opening System Settings...`,
          )
          // Open the relevant System Settings pane
          try {
            const { execFile: ef } = require('child_process')
            if (!accessibility) {
              ef('open', ['x-apple.systempreferences:com.apple.preference.security?Privacy_Accessibility'])
            }
            if (!screenRecording) {
              ef('open', ['x-apple.systempreferences:com.apple.preference.security?Privacy_ScreenCapture'])
            }
          } catch {}
        }

        return { granted: false, accessibility, screenRecording }
      } catch {
        return { granted: false, accessibility: false, screenRecording: false }
      }
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
