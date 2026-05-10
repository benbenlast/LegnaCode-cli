/**
 * Native NAPI addon loader — dynamically loads Rust addons with graceful fallback.
 *
 * Attempts to load platform-specific `.node` files from this directory.
 * If unavailable, exports `null` for each binding so callers can fallback to TS.
 */

import { join } from 'path'
import { platform, arch } from 'os'

const PLATFORM = platform()
const ARCH = arch() === 'x64' ? 'x64' : arch() === 'arm64' ? 'arm64' : arch()

function tryLoadAddon<T>(name: string): T | null {
  const filename = `${name}.${PLATFORM}-${ARCH}.node`
  const fullPath = join(__dirname, filename)
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    return require(fullPath) as T
  } catch {
    return null
  }
}

// ── Sandbox addon ──────────────────────────────────────────────

export interface NativeSandboxConfig {
  mode: string
  writable_paths: string[]
  readable_paths: string[]
  network_policy: string
  env_vars?: string[]
  protected_paths?: string[]
}

export interface NativeSandboxResult {
  exit_code: number
  stdout: string
  stderr: string
  sandbox_level: string
}

interface SandboxAddon {
  detectSandboxLevel(): number
  sandboxExec(command: string, config: NativeSandboxConfig): NativeSandboxResult
}

// Native sandbox disabled — Seatbelt (deny default) caused exit code 65 on all commands.
// Safety handled at TS permission layer (BashTool/bashPermissions.ts).
export const sandboxAddon = null

// ── File Search addon ──────────────────────────────────────────

export interface NativeSearchOptions {
  max_results?: number
  extensions?: string[]
  follow_symlinks?: boolean
  respect_gitignore?: boolean
}

export interface NativeSearchResult {
  path: string
  score: number
}

interface FileSearchAddon {
  fuzzySearch(query: string, rootDir: string, options?: NativeSearchOptions): NativeSearchResult[]
  globSearch(pattern: string, rootDir: string): string[]
}

export const fileSearchAddon = tryLoadAddon<FileSearchAddon>('file-search')

// ── Apply Patch addon ──────────────────────────────────────────

export interface NativePatchResult {
  content: string
  clean: boolean
  hunks_applied: number
  hunks_fuzzy: number
  hunks_failed: number
}

export interface NativeValidationResult {
  valid: boolean
  hunks: number
  error?: string
}

interface ApplyPatchAddon {
  applyPatch(fileContent: string, patchContent: string): NativePatchResult
  validatePatch(patchContent: string): NativeValidationResult
}

export const applyPatchAddon = tryLoadAddon<ApplyPatchAddon>('apply-patch')

// ── Availability checks ────────────────────────────────────────

export const hasNativeSandbox = sandboxAddon !== null
export const hasNativeFileSearch = fileSearchAddon !== null
export const hasNativeApplyPatch = applyPatchAddon !== null
export const hasAnyNativeAddon = hasNativeSandbox || hasNativeFileSearch || hasNativeApplyPatch
