/**
 * Apply-Patch TypeScript binding — wraps native Rust addon with TS fallback.
 *
 * Uses the Rust patch engine when available (10x+ faster than pure JS diff),
 * falls back to existing FileEditTool diff logic otherwise.
 */

import {
  applyPatchAddon,
  hasNativeApplyPatch,
  type NativePatchResult,
  type NativeValidationResult,
} from './index.js'

export interface PatchResult {
  content: string
  clean: boolean
  hunksApplied: number
  hunksFuzzy: number
  hunksFailed: number
}

export interface PatchValidation {
  valid: boolean
  hunks: number
  error?: string
}

/**
 * Apply a unified diff patch to file content.
 * Returns null if native addon is unavailable (caller should fallback).
 */
export function nativeApplyPatch(
  fileContent: string,
  patchContent: string,
): PatchResult | null {
  if (!hasNativeApplyPatch || !applyPatchAddon) {
    return null
  }

  const result: NativePatchResult = applyPatchAddon.applyPatch(fileContent, patchContent)
  return {
    content: result.content,
    clean: result.clean,
    hunksApplied: result.hunks_applied,
    hunksFuzzy: result.hunks_fuzzy,
    hunksFailed: result.hunks_failed,
  }
}

/**
 * Validate a patch without applying it.
 * Returns null if native addon is unavailable.
 */
export function nativeValidatePatch(
  patchContent: string,
): PatchValidation | null {
  if (!hasNativeApplyPatch || !applyPatchAddon) {
    return null
  }

  const result: NativeValidationResult = applyPatchAddon.validatePatch(patchContent)
  return {
    valid: result.valid,
    hunks: result.hunks,
    error: result.error ?? undefined,
  }
}

/** Whether the native apply-patch addon is loaded. */
export { hasNativeApplyPatch }
