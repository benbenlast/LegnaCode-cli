/**
 * CLI `ComputerExecutor` implementation via Python bridge.
 *
 * Replaces the original native-module approach (`@ant/computer-use-swift` +
 * `@ant/computer-use-input`) with a subprocess call to `runtime/mac_helper.py`
 * (macOS) or `runtime/win_helper.py` (Windows). Communication is one-shot
 * CLI invocation per command: `python3 helper.py <cmd> --payload '<json>'`
 * → stdout JSON `{"ok": true, "result": ...}`.
 *
 * No native modules, no CFRunLoop drain, no NAPI — pure subprocess I/O.
 */

import type {
  ComputerExecutor,
  DisplayGeometry,
  FrontmostApp,
  InstalledApp,
  ResolvePrepareCaptureResult,
  RunningApp,
  ScreenshotResult,
} from './mcp/executor.js'
import { API_RESIZE_PARAMS, targetImageSize } from './mcp/imageResize.js'
import { logForDebugging } from '../debug.js'
import {
  CLI_CU_CAPABILITIES,
  CLI_HOST_BUNDLE_ID,
} from './common.js'
import { callPythonBridge as callPython } from './pythonBridge.js'

// ── Helpers ──────────────────────────────────────────────────────────────────

function computeTargetDims(
  logicalW: number,
  logicalH: number,
  scaleFactor: number,
): [number, number] {
  const physW = Math.round(logicalW * scaleFactor)
  const physH = Math.round(logicalH * scaleFactor)
  return targetImageSize(physW, physH, API_RESIZE_PARAMS)
}

// ── Factory ─────────────────────────────────────────────────────────────────

export function createCliExecutor(_opts: {
  getMouseAnimationEnabled: () => boolean
  getHideBeforeActionEnabled: () => boolean
}): ComputerExecutor {
  if (process.platform !== 'darwin' && process.platform !== 'win32') {
    throw new Error(
      `createCliExecutor called on ${process.platform}. Computer Use requires macOS or Windows.`,
    )
  }

  logForDebugging('[computer-use] Python bridge executor initialized')

  return {
    capabilities: {
      ...CLI_CU_CAPABILITIES,
      platform: process.platform === 'win32' ? 'win32' : 'darwin',
      hostBundleId: CLI_HOST_BUNDLE_ID,
    },

    // ── Pre-action (hide/defocus) ─────────────────────────────────────
    async prepareForAction(_allowlistBundleIds: string[], _displayId?: number): Promise<string[]> {
      return callPython<string[]>('prepare_for_action', {})
    },

    async previewHideSet(_allowlistBundleIds: string[], _displayId?: number) {
      return callPython<Array<{ bundleId: string; displayName: string }>>('preview_hide_set', {})
    },

    // ── Display ───────────────────────────────────────────────────────
    async getDisplaySize(displayId?: number): Promise<DisplayGeometry> {
      return callPython<DisplayGeometry>('get_display_size', { displayId })
    },

    async listDisplays(): Promise<DisplayGeometry[]> {
      return callPython<DisplayGeometry[]>('list_displays')
    },

    async findWindowDisplays(bundleIds: string[]) {
      return callPython<Array<{ bundleId: string; displayIds: number[] }>>('find_window_displays', { bundleIds })
    },

    async resolvePrepareCapture(opts): Promise<ResolvePrepareCaptureResult> {
      const d = await callPython<DisplayGeometry>('get_display_size', { displayId: opts.preferredDisplayId })
      const [targetW, targetH] = computeTargetDims(d.width, d.height, d.scaleFactor)
      const result = await callPython<ResolvePrepareCaptureResult>('resolve_prepare_capture', {
        preferredDisplayId: opts.preferredDisplayId,
        targetWidth: targetW,
        targetHeight: targetH,
      })
      return result
    },

    // ── Screenshot ─────────────────────────────────────────────────────
    async screenshot(opts: { allowedBundleIds: string[]; displayId?: number }): Promise<ScreenshotResult> {
      const d = await callPython<DisplayGeometry>('get_display_size', { displayId: opts.displayId })
      const [targetW, targetH] = computeTargetDims(d.width, d.height, d.scaleFactor)
      return callPython<ScreenshotResult>('screenshot', {
        displayId: opts.displayId,
        targetWidth: targetW,
        targetHeight: targetH,
      })
    },

    async zoom(
      regionLogical: { x: number; y: number; w: number; h: number },
      _allowedBundleIds: string[],
      displayId?: number,
    ): Promise<{ base64: string; width: number; height: number }> {
      const d = await callPython<DisplayGeometry>('get_display_size', { displayId })
      const [outW, outH] = computeTargetDims(regionLogical.w, regionLogical.h, d.scaleFactor)
      return callPython<{ base64: string; width: number; height: number }>('zoom', {
        x: regionLogical.x,
        y: regionLogical.y,
        width: regionLogical.w,
        height: regionLogical.h,
        targetWidth: outW,
        targetHeight: outH,
      })
    },

    // ── Keyboard ─────────────────────────────────────────────────────
    async key(keySequence: string, repeat?: number): Promise<void> {
      await callPython('key', { keySequence, repeat: repeat ?? 1 })
    },

    async holdKey(keyNames: string[], durationMs: number): Promise<void> {
      await callPython('hold_key', { keyNames, durationMs })
    },

    async type(text: string, opts: { viaClipboard: boolean }): Promise<void> {
      if (opts.viaClipboard) {
        await callPython('paste_clipboard')
      } else {
        await callPython('type', { text })
      }
    },

    async readClipboard(): Promise<string> {
      return callPython<string>('read_clipboard')
    },

    async writeClipboard(text: string): Promise<void> {
      await callPython('write_clipboard', { text })
    },

    // ── Mouse ────────────────────────────────────────────────────────
    async moveMouse(x: number, y: number): Promise<void> {
      await callPython('move_mouse', { x, y })
    },

    async click(
      x: number, y: number,
      button: 'left' | 'right' | 'middle',
      count: 1 | 2 | 3,
      modifiers?: string[],
    ): Promise<void> {
      await callPython('click', { x, y, button, count, modifiers })
    },

    async mouseDown(): Promise<void> {
      await callPython('mouse_down', {})
    },

    async mouseUp(): Promise<void> {
      await callPython('mouse_up', {})
    },

    async getCursorPosition(): Promise<{ x: number; y: number }> {
      return callPython<{ x: number; y: number }>('cursor_position')
    },

    async drag(
      from: { x: number; y: number } | undefined,
      to: { x: number; y: number },
    ): Promise<void> {
      await callPython('drag', { from: from ?? null, to })
    },

    async scroll(x: number, y: number, deltaX: number, deltaY: number): Promise<void> {
      await callPython('scroll', { x, y, deltaX, deltaY })
    },

    // ── App management ───────────────────────────────────────────────
    async getFrontmostApp(): Promise<FrontmostApp | null> {
      return callPython<FrontmostApp | null>('frontmost_app')
    },

    async appUnderPoint(x: number, y: number) {
      return callPython<{ bundleId: string; displayName: string } | null>('app_under_point', { x, y })
    },

    async listInstalledApps(): Promise<InstalledApp[]> {
      return callPython<InstalledApp[]>('list_installed_apps')
    },

    async getAppIcon(_path: string): Promise<string | undefined> {
      return undefined // Python bridge doesn't support app icons yet
    },

    async listRunningApps(): Promise<RunningApp[]> {
      return callPython<RunningApp[]>('list_running_apps')
    },

    async openApp(bundleId: string): Promise<void> {
      await callPython('open_app', { bundleId })
    },
  }
}

export async function unhideComputerUseApps(
  _bundleIds: readonly string[],
): Promise<void> {
  // Python bridge doesn't hide apps, so unhide is a no-op
}
