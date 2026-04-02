// Leaf config module — intentionally minimal imports so UI components
// can read the auto-dream enabled state without dragging in the forked
// agent / task registry / message builder chain that autoDream.ts pulls in.

import { getInitialSettings } from '../../utils/settings/settings.js'

/**
 * Whether background memory consolidation should run. User setting
 * (autoDreamEnabled in settings.json) overrides the default when
 * explicitly set; otherwise enabled by default.
 *
 * Original upstream gated this on GrowthBook's tengu_onyx_plover flag.
 * Without a GrowthBook connection, we default to true — auto-dream is
 * a high-value feature that should work out of the box.
 */
export function isAutoDreamEnabled(): boolean {
  const setting = getInitialSettings().autoDreamEnabled
  if (setting !== undefined) return setting
  return true
}
