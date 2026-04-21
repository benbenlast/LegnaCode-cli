/**
 * Network policy type definitions.
 *
 * Controls domain-level network access for all outbound requests
 * made by tools (WebFetch, WebSearch, curl via Bash, upstream proxy).
 */

export type NetworkMode = 'full' | 'limited' | 'blocked'

export interface NetworkPolicy {
  mode: NetworkMode
  allowlist: string[]   // domain patterns, supports *.example.com
  denylist: string[]    // domain patterns, supports *.example.com
  auditLog: boolean
}

export interface NetworkCheckResult {
  allowed: boolean
  reason: string
  domain: string
  method?: string
}

export interface NetworkAuditEntry {
  timestamp: string
  domain: string
  url: string
  method: string
  allowed: boolean
  reason: string
  source: string // tool name or 'proxy'
}

export const DEFAULT_NETWORK_POLICY: NetworkPolicy = {
  mode: 'full',
  allowlist: [],
  denylist: [],
  auditLog: false,
}

/** HTTP methods allowed in 'limited' mode. */
export const LIMITED_MODE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS'])
