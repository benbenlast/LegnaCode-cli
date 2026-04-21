/**
 * Codex Plugin Installation Policy
 *
 * Governs whether a Codex-originated plugin is allowed to be installed
 * in the current LegnaCode environment. Checks enterprise policy,
 * blocklists, capability restrictions, and sandbox requirements.
 */

import { logForDebugging } from "../../utils/debug.js"
import { getInitialSettings } from "../../utils/settings/settings.js"

// ---------------------------------------------------------------------------
// Policy result
// ---------------------------------------------------------------------------

export interface InstallPolicyResult {
  allowed: boolean
  reason?: string
  requiresSandbox?: boolean
  warnings: string[]
}

// ---------------------------------------------------------------------------
// Capability flags that Codex plugins may request
// ---------------------------------------------------------------------------

export type CodexCapability =
  | "filesystem"
  | "network"
  | "shell"
  | "env"
  | "clipboard"
  | "browser"

const HIGH_RISK_CAPABILITIES: ReadonlySet<CodexCapability> = new Set([
  "shell",
  "env",
  "browser",
])

// ---------------------------------------------------------------------------
// Policy evaluation
// ---------------------------------------------------------------------------

/**
 * Evaluate whether a Codex plugin may be installed given the current
 * settings and the capabilities it declares.
 */
export function evaluateInstallPolicy(
  pluginName: string,
  requestedCapabilities: CodexCapability[] = [],
  opts: { forceAllow?: boolean } = {},
): InstallPolicyResult {
  const warnings: string[] = []

  // 1. Enterprise blocklist --------------------------------------------------
  if (isBlockedByEnterprise(pluginName)) {
    return {
      allowed: false,
      reason: `Plugin "${pluginName}" is blocked by enterprise policy`,
      warnings,
    }
  }

  // 2. Force-allow escape hatch (e.g. --force flag) -------------------------
  if (opts.forceAllow) {
    warnings.push("Installation forced — policy checks bypassed")
    return { allowed: true, warnings }
  }

  // 3. Capability checks -----------------------------------------------------
  const riskyRequested = requestedCapabilities.filter((c) =>
    HIGH_RISK_CAPABILITIES.has(c),
  )
  const requiresSandbox = riskyRequested.length > 0

  if (requiresSandbox) {
    warnings.push(
      `Plugin requests high-risk capabilities: ${riskyRequested.join(", ")}. ` +
        "It will run inside a sandbox.",
    )
  }

  // 4. Max-plugins-per-project guard -----------------------------------------
  const maxPlugins = getMaxPluginsPerProject()
  if (maxPlugins !== undefined) {
    warnings.push(
      `Project plugin limit is ${maxPlugins}. Verify count before installing.`,
    )
  }

  logForDebugging(
    `[installationPolicy] ${pluginName}: allowed=true, sandbox=${requiresSandbox}`,
  )

  return { allowed: true, requiresSandbox, warnings }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function isBlockedByEnterprise(pluginName: string): boolean {
  try {
    const settings = getInitialSettings()
    const blocklist: string[] =
      (settings as Record<string, unknown>)["blockedPlugins"] as string[] ?? []
    return blocklist.some(
      (pattern) =>
        pattern === pluginName ||
        (pattern.endsWith("*") &&
          pluginName.startsWith(pattern.slice(0, -1))),
    )
  } catch {
    return false
  }
}

function getMaxPluginsPerProject(): number | undefined {
  try {
    const settings = getInitialSettings()
    const max = (settings as Record<string, unknown>)["maxPluginsPerProject"]
    return typeof max === "number" ? max : undefined
  } catch {
    return undefined
  }
}
