/**
 * Tests for the network policy module.
 */

import { describe, expect, it, beforeEach } from 'vitest'
import { matchDomain, extractDomain, isUrlAllowed, isDomainAllowed } from '../domainMatcher.js'
import { NetworkPolicyEnforcer, resetNetworkPolicyForTesting } from '../policyEnforcer.js'
import type { NetworkPolicy } from '../types.js'

// ── Domain Matcher ───────────────────────────────────────────────────────

describe('matchDomain', () => {
  it('matches exact domain', () => {
    expect(matchDomain('example.com', 'example.com')).toBe(true)
    expect(matchDomain('example.com', 'other.com')).toBe(false)
  })

  it('matches wildcard subdomains', () => {
    expect(matchDomain('api.github.com', '*.github.com')).toBe(true)
    expect(matchDomain('raw.github.com', '*.github.com')).toBe(true)
    expect(matchDomain('a.b.github.com', '*.github.com')).toBe(true)
  })

  it('wildcard does not match the root domain itself', () => {
    expect(matchDomain('github.com', '*.github.com')).toBe(false)
  })

  it('is case-insensitive', () => {
    expect(matchDomain('API.GitHub.COM', '*.github.com')).toBe(true)
    expect(matchDomain('Example.Com', 'example.com')).toBe(true)
  })
})

describe('extractDomain', () => {
  it('extracts domain from URL', () => {
    expect(extractDomain('https://api.github.com/repos')).toBe('api.github.com')
    expect(extractDomain('http://example.com:8080/path')).toBe('example.com')
  })

  it('returns null for invalid URLs', () => {
    expect(extractDomain('not-a-url')).toBeNull()
    expect(extractDomain('')).toBeNull()
  })
})

describe('isUrlAllowed', () => {
  const fullPolicy: NetworkPolicy = {
    mode: 'full',
    allowlist: [],
    denylist: [],
    auditLog: false,
  }

  const blockedPolicy: NetworkPolicy = {
    mode: 'blocked',
    allowlist: [],
    denylist: [],
    auditLog: false,
  }

  const limitedPolicy: NetworkPolicy = {
    mode: 'limited',
    allowlist: [],
    denylist: [],
    auditLog: false,
  }

  it('allows everything in full mode', () => {
    expect(isUrlAllowed('https://evil.com', 'POST', fullPolicy).allowed).toBe(true)
  })

  it('blocks everything in blocked mode', () => {
    expect(isUrlAllowed('https://example.com', 'GET', blockedPolicy).allowed).toBe(false)
  })

  it('allows GET in limited mode', () => {
    expect(isUrlAllowed('https://example.com', 'GET', limitedPolicy).allowed).toBe(true)
    expect(isUrlAllowed('https://example.com', 'HEAD', limitedPolicy).allowed).toBe(true)
    expect(isUrlAllowed('https://example.com', 'OPTIONS', limitedPolicy).allowed).toBe(true)
  })

  it('blocks POST in limited mode', () => {
    expect(isUrlAllowed('https://example.com', 'POST', limitedPolicy).allowed).toBe(false)
    expect(isUrlAllowed('https://example.com', 'PUT', limitedPolicy).allowed).toBe(false)
    expect(isUrlAllowed('https://example.com', 'DELETE', limitedPolicy).allowed).toBe(false)
  })

  it('rejects invalid URLs', () => {
    expect(isUrlAllowed('not-a-url', 'GET', fullPolicy).allowed).toBe(false)
  })
})

describe('isDomainAllowed with allowlist/denylist', () => {
  it('denylist takes precedence', () => {
    const policy: NetworkPolicy = {
      mode: 'full',
      allowlist: ['*.example.com'],
      denylist: ['evil.example.com'],
      auditLog: false,
    }
    expect(isDomainAllowed('evil.example.com', 'GET', policy).allowed).toBe(false)
    expect(isDomainAllowed('good.example.com', 'GET', policy).allowed).toBe(true)
  })

  it('allowlist restricts to listed domains only', () => {
    const policy: NetworkPolicy = {
      mode: 'full',
      allowlist: ['*.github.com', 'npmjs.org'],
      denylist: [],
      auditLog: false,
    }
    expect(isDomainAllowed('api.github.com', 'GET', policy).allowed).toBe(true)
    expect(isDomainAllowed('npmjs.org', 'GET', policy).allowed).toBe(true)
    expect(isDomainAllowed('evil.com', 'GET', policy).allowed).toBe(false)
  })
})

// ── Policy Enforcer ──────────────────────────────────────────────────────

describe('NetworkPolicyEnforcer', () => {
  beforeEach(() => {
    resetNetworkPolicyForTesting()
  })

  it('defaults to full mode (allow all)', () => {
    const enforcer = new NetworkPolicyEnforcer()
    const result = enforcer.checkRequest('https://example.com', 'POST')
    expect(result.allowed).toBe(true)
  })

  it('respects blocked mode', () => {
    const enforcer = new NetworkPolicyEnforcer({ mode: 'blocked' })
    const result = enforcer.checkRequest('https://example.com', 'GET')
    expect(result.allowed).toBe(false)
  })

  it('respects limited mode', () => {
    const enforcer = new NetworkPolicyEnforcer({ mode: 'limited' })
    expect(enforcer.checkRequest('https://example.com', 'GET').allowed).toBe(true)
    expect(enforcer.checkRequest('https://example.com', 'POST').allowed).toBe(false)
  })

  it('enforces denylist', () => {
    const enforcer = new NetworkPolicyEnforcer({
      denylist: ['evil.com', '*.malware.org'],
    })
    expect(enforcer.checkRequest('https://evil.com/steal', 'GET').allowed).toBe(false)
    expect(enforcer.checkRequest('https://sub.malware.org/payload', 'GET').allowed).toBe(false)
    expect(enforcer.checkRequest('https://safe.com', 'GET').allowed).toBe(true)
  })

  it('checkDomain works without full URL', () => {
    const enforcer = new NetworkPolicyEnforcer({ denylist: ['evil.com'] })
    expect(enforcer.checkDomain('evil.com').allowed).toBe(false)
    expect(enforcer.checkDomain('safe.com').allowed).toBe(true)
  })
})
