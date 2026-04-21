/**
 * Domain matcher — wildcard-aware domain pattern matching.
 *
 * Supports patterns like:
 *   "example.com"       — exact match
 *   "*.example.com"     — any subdomain of example.com
 *   "*.github.com"      — matches api.github.com, raw.github.com, etc.
 */

import { LIMITED_MODE_METHODS, type NetworkMode, type NetworkPolicy } from './types.js'

/**
 * Match a domain against a pattern.
 * Pattern "*.example.com" matches "sub.example.com" and "a.b.example.com"
 * but NOT "example.com" itself.
 * Pattern "example.com" matches only "example.com" exactly.
 */
export function matchDomain(domain: string, pattern: string): boolean {
  const d = domain.toLowerCase()
  const p = pattern.toLowerCase()

  if (p.startsWith('*.')) {
    const suffix = p.slice(1) // ".example.com"
    return d.endsWith(suffix) && d.length > suffix.length
  }

  return d === p
}

/**
 * Extract domain from a URL string.
 */
export function extractDomain(url: string): string | null {
  try {
    const parsed = new URL(url)
    return parsed.hostname.toLowerCase()
  } catch {
    return null
  }
}

/**
 * Check if a domain matches any pattern in a list.
 */
export function matchesAnyPattern(domain: string, patterns: string[]): boolean {
  return patterns.some(p => matchDomain(domain, p))
}

/**
 * Check if a URL is allowed by the network policy.
 */
export function isUrlAllowed(
  url: string,
  method: string,
  policy: NetworkPolicy,
): { allowed: boolean; reason: string } {
  const domain = extractDomain(url)
  if (!domain) {
    return { allowed: false, reason: 'Invalid URL: cannot extract domain.' }
  }

  return isDomainAllowed(domain, method, policy)
}

/**
 * Check if a domain + method combination is allowed by the policy.
 */
export function isDomainAllowed(
  domain: string,
  method: string,
  policy: NetworkPolicy,
): { allowed: boolean; reason: string } {
  // Blocked mode → deny everything
  if (policy.mode === 'blocked') {
    return { allowed: false, reason: 'Network access is blocked.' }
  }

  // Check denylist first (takes precedence over allowlist)
  if (policy.denylist.length > 0 && matchesAnyPattern(domain, policy.denylist)) {
    return { allowed: false, reason: `Domain "${domain}" is on the deny list.` }
  }

  // Check allowlist (if non-empty, only listed domains are allowed)
  if (policy.allowlist.length > 0 && !matchesAnyPattern(domain, policy.allowlist)) {
    return { allowed: false, reason: `Domain "${domain}" is not on the allow list.` }
  }

  // Limited mode → only safe HTTP methods
  if (policy.mode === 'limited') {
    const upper = method.toUpperCase()
    if (!LIMITED_MODE_METHODS.has(upper)) {
      return {
        allowed: false,
        reason: `Method "${upper}" is not allowed in limited mode (only ${[...LIMITED_MODE_METHODS].join(', ')}).`,
      }
    }
  }

  return { allowed: true, reason: 'Allowed by network policy.' }
}
