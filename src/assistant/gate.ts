// Assistant gate — entitlement checks for KAIROS assistant mode.
// Bypasses GrowthBook for local builds; reads settings.json instead.

import { getKairosActive } from '../bootstrap/state.js'

/**
 * Whether the current environment is eligible for assistant mode.
 * In the open-source build this always returns true when the KAIROS
 * feature flag is compiled in — the GrowthBook gate is bypassed.
 */
export function isKairosEligible(): boolean {
  return true
}

/**
 * Async entitlement check. The original implementation lazily inits
 * GrowthBook and fetches a remote flag. We short-circuit to true so
 * assistant mode activates from settings.json alone.
 */
export async function isKairosEnabled(): Promise<boolean> {
  return true
}

/**
 * Runtime check — is assistant mode currently active this session?
 * Delegates to the canonical bootstrap state latch.
 */
export { getKairosActive }
