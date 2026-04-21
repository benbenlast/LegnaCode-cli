/**
 * Network policy enforcer — singleton that loads policy config
 * and provides a unified check interface for all network-accessing tools.
 *
 * Policy file: ~/.legnacode/network-policy.toml
 * Audit log:   ~/.legnacode/logs/network-audit.jsonl
 */

import { appendFileSync, mkdirSync } from 'fs'
import { readFile } from 'fs/promises'
import { dirname, join } from 'path'
import { getClaudeConfigHomeDir } from '../../utils/envUtils.js'
import { logForDebugging } from '../../utils/debug.js'
import { isDomainAllowed, isUrlAllowed } from './domainMatcher.js'
import {
  DEFAULT_NETWORK_POLICY,
  type NetworkAuditEntry,
  type NetworkCheckResult,
  type NetworkPolicy,
} from './types.js'

// ── Policy parser (minimal TOML subset) ──────────────────────────────────

function parseNetworkPolicy(content: string): Partial<NetworkPolicy> {
  const result: Partial<NetworkPolicy> = {}

  for (const raw of content.split('\n')) {
    const line = raw.trim()
    if (!line || line.startsWith('#') || line.startsWith('//')) continue

    const eq = line.indexOf('=')
    if (eq === -1) continue

    const key = line.slice(0, eq).trim()
    const val = line.slice(eq + 1).trim()

    switch (key) {
      case 'mode':
        if (val === '"full"' || val === '"limited"' || val === '"blocked"') {
          result.mode = val.slice(1, -1) as NetworkPolicy['mode']
        }
        break
      case 'audit_log':
        result.auditLog = val === 'true'
        break
      case 'allowlist':
        result.allowlist = parseStringArray(val)
        break
      case 'denylist':
        result.denylist = parseStringArray(val)
        break
    }
  }

  return result
}

function parseStringArray(val: string): string[] {
  // Parse ["a", "b", "c"] or ["a","b"]
  const match = val.match(/\[([^\]]*)\]/)
  if (!match) return []
  return match[1]!
    .split(',')
    .map(s => s.trim().replace(/^["']|["']$/g, ''))
    .filter(Boolean)
}

// ── Enforcer ─────────────────────────────────────────────────────────────

export class NetworkPolicyEnforcer {
  private policy: NetworkPolicy
  private auditLogPath: string | null = null

  constructor(policy?: Partial<NetworkPolicy>) {
    this.policy = { ...DEFAULT_NETWORK_POLICY, ...policy }
    if (this.policy.auditLog) {
      this.initAuditLog()
    }
  }

  get currentPolicy(): Readonly<NetworkPolicy> {
    return this.policy
  }

  /**
   * Check if a URL request is allowed.
   */
  checkRequest(
    url: string,
    method: string = 'GET',
    source: string = 'unknown',
  ): NetworkCheckResult {
    const result = isUrlAllowed(url, method, this.policy)

    let domain = 'unknown'
    try { domain = new URL(url).hostname } catch { /* ignore */ }

    const checkResult: NetworkCheckResult = {
      allowed: result.allowed,
      reason: result.reason,
      domain,
      method,
    }

    // Audit log
    if (this.policy.auditLog) {
      this.writeAuditEntry({
        timestamp: new Date().toISOString(),
        domain,
        url,
        method,
        allowed: result.allowed,
        reason: result.reason,
        source,
      })
    }

    if (!result.allowed) {
      logForDebugging(`[NetworkPolicy] DENIED: ${method} ${url} — ${result.reason}`)
    }

    return checkResult
  }

  /**
   * Check if a domain is allowed (without a full URL).
   */
  checkDomain(
    domain: string,
    method: string = 'GET',
  ): NetworkCheckResult {
    const result = isDomainAllowed(domain, method, this.policy)
    return {
      allowed: result.allowed,
      reason: result.reason,
      domain,
      method,
    }
  }

  /**
   * Load policy from config file.
   */
  async loadFromFile(): Promise<void> {
    const configDir = getClaudeConfigHomeDir()
    const policyPath = join(configDir, 'network-policy.toml')

    try {
      const content = await readFile(policyPath, 'utf-8')
      const parsed = parseNetworkPolicy(content)
      this.policy = { ...DEFAULT_NETWORK_POLICY, ...parsed }
      logForDebugging(`[NetworkPolicy] Loaded policy from ${policyPath}`)

      if (this.policy.auditLog) {
        this.initAuditLog()
      }
    } catch {
      // No policy file → use defaults
      logForDebugging('[NetworkPolicy] No policy file found, using defaults.')
    }
  }

  // ── Audit log ──────────────────────────────────────────────────────

  private initAuditLog(): void {
    const configDir = getClaudeConfigHomeDir()
    this.auditLogPath = join(configDir, 'logs', 'network-audit.jsonl')
    try {
      mkdirSync(dirname(this.auditLogPath), { recursive: true })
    } catch { /* ignore */ }
  }

  private writeAuditEntry(entry: NetworkAuditEntry): void {
    if (!this.auditLogPath) return
    try {
      appendFileSync(this.auditLogPath, JSON.stringify(entry) + '\n')
    } catch {
      // Silently fail — audit logging should never break the main flow
    }
  }
}

// ── Singleton ────────────────────────────────────────────────────────────

let _instance: NetworkPolicyEnforcer | null = null

export function getNetworkPolicyEnforcer(): NetworkPolicyEnforcer {
  if (!_instance) {
    _instance = new NetworkPolicyEnforcer()
  }
  return _instance
}

export async function initNetworkPolicy(): Promise<NetworkPolicyEnforcer> {
  const enforcer = getNetworkPolicyEnforcer()
  await enforcer.loadFromFile()
  return enforcer
}

export function resetNetworkPolicyForTesting(): void {
  _instance = null
}
