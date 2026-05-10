import type { CoordinateMode, CuSubGates } from './mcp/types.js'

/**
 * Computer Use feature gates. Replaces the original GrowthBook-based
 * gating (`tengu_malort_pedway` + Max/Pro subscription check) with
 * local configuration. No remote feature flags, no subscription tier
 * requirements — Computer Use is available to all LegnaCode users.
 */

type ChicagoConfig = CuSubGates & {
  enabled: boolean
  coordinateMode: CoordinateMode
}

const DEFAULTS: ChicagoConfig = {
  enabled: true,
  pixelValidation: false,
  clipboardPasteMultiline: true,
  mouseAnimation: true,
  hideBeforeAction: true,
  autoTargetDisplay: true,
  clipboardGuard: true,
  coordinateMode: 'pixels',
}

function readConfig(): ChicagoConfig {
  // Read from settings.json if available, otherwise use defaults
  try {
    const { getInitialSettings } = require('../settings/settings.js')
    const settings = getInitialSettings?.() || {}
    const cuConfig = settings.computerUse || {}
    return { ...DEFAULTS, ...cuConfig }
  } catch {
    return DEFAULTS
  }
}

export function getChicagoEnabled(): boolean {
  return readConfig().enabled
}

export function getChicagoSubGates(): CuSubGates {
  const { enabled: _e, coordinateMode: _c, ...subGates } = readConfig()
  return subGates
}

// Frozen at first read — setup.ts builds tool descriptions and executor.ts
// scales coordinates off the same value. A live read here would let a
// mid-session config change tell the model "pixels" while transforming
// clicks as normalized.
let frozenCoordinateMode: CoordinateMode | undefined
export function getChicagoCoordinateMode(): CoordinateMode {
  frozenCoordinateMode ??= readConfig().coordinateMode
  return frozenCoordinateMode
}
