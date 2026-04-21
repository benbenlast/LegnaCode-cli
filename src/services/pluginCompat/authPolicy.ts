/**
 * Codex Plugin Auth Policy
 *
 * Handles authentication and authorization concerns when running
 * Codex-originated plugins inside LegnaCode. Codex plugins may carry
 * their own OAuth / API-key credentials; this module decides how those
 * credentials are mapped, stored, and validated.
 */

import { logForDebugging } from "../../utils/debug.js"
import { logError } from "../../utils/log.js"

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface CodexAuthDescriptor {
  /** Auth mechanism the plugin expects */
  type: "oauth2" | "api_key" | "bearer" | "none"
  /** OAuth issuer or API base URL */
  issuer?: string
  /** Scopes requested (OAuth) */
  scopes?: string[]
  /** Environment variable the plugin reads for the credential */
  envVar?: string
}

export interface AuthPolicyResult {
  allowed: boolean
  reason?: string
  /** Sanitised env vars to inject when launching the plugin process */
  envOverrides: Record<string, string>
  warnings: string[]
}

// ---------------------------------------------------------------------------
// Blocked issuers / domains
// ---------------------------------------------------------------------------

const BLOCKED_ISSUERS: ReadonlySet<string> = new Set([
  "localhost",
  "127.0.0.1",
  "0.0.0.0",
])

// ---------------------------------------------------------------------------
// Policy evaluation
// ---------------------------------------------------------------------------

/**
 * Evaluate whether the auth descriptor carried by a Codex plugin is
 * acceptable under LegnaCode's security model.
 */
export function evaluateAuthPolicy(
  pluginName: string,
  auth: CodexAuthDescriptor | undefined,
): AuthPolicyResult {
  const warnings: string[] = []
  const envOverrides: Record<string, string> = {}

  // No auth required — always fine
  if (!auth || auth.type === "none") {
    return { allowed: true, envOverrides, warnings }
  }

  // Block suspicious issuers
  if (auth.issuer) {
    try {
      const host = new URL(auth.issuer).hostname
      if (BLOCKED_ISSUERS.has(host)) {
        return {
          allowed: false,
          reason: `Plugin "${pluginName}" declares a blocked auth issuer: ${host}`,
          envOverrides,
          warnings,
        }
      }
    } catch {
      return {
        allowed: false,
        reason: `Plugin "${pluginName}" has an invalid auth issuer URL`,
        envOverrides,
        warnings,
      }
    }
  }

  // OAuth scope review
  if (auth.type === "oauth2" && auth.scopes?.length) {
    const dangerousScopes = auth.scopes.filter(
      (s) => s.includes("admin") || s.includes("write") || s.includes("delete"),
    )
    if (dangerousScopes.length > 0) {
      warnings.push(
        `Plugin requests elevated OAuth scopes: ${dangerousScopes.join(", ")}`,
      )
    }
  }

  // API key / bearer — ensure the env var name is reasonable
  if ((auth.type === "api_key" || auth.type === "bearer") && auth.envVar) {
    if (!isValidEnvVarName(auth.envVar)) {
      return {
        allowed: false,
        reason: `Plugin "${pluginName}" declares an invalid env var name: ${auth.envVar}`,
        envOverrides,
        warnings,
      }
    }
    // We do NOT auto-populate the value; the user must set it themselves.
    warnings.push(
      `Plugin expects credential in env var "${auth.envVar}". Set it before use.`,
    )
  }

  logForDebugging(
    `[authPolicy] ${pluginName}: type=${auth.type}, allowed=true`,
  )

  return { allowed: true, envOverrides, warnings }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const ENV_VAR_RE = /^[A-Za-z_][A-Za-z0-9_]{0,127}$/

function isValidEnvVarName(name: string): boolean {
  return ENV_VAR_RE.test(name)
}
