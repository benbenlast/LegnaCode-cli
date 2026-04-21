/**
 * Command matcher for execution policy rules.
 */

import type { PolicyRule } from './types.js'

/**
 * Test whether a command matches a policy rule.
 */
export function matchCommand(command: string, rule: PolicyRule): boolean {
  switch (rule.kind) {
    case 'prefix':
      return matchPrefix(command, rule.pattern)
    case 'glob':
      return matchGlob(command, rule.pattern)
    case 'regex':
      return matchRegex(command, rule.pattern)
    case 'host_executable':
      return matchHostExecutable(command, rule.pattern)
    default:
      return false
  }
}

/**
 * Prefix match: command starts with pattern (word-boundary aware).
 */
function matchPrefix(command: string, pattern: string): boolean {
  const trimmed = command.trimStart()
  if (!trimmed.startsWith(pattern)) return false
  // Ensure we match at a word boundary
  const nextChar = trimmed[pattern.length]
  return nextChar === undefined || nextChar === ' ' || nextChar === '\t' || nextChar === ';' || nextChar === '|' || nextChar === '&' || nextChar === '\n'
}

/**
 * Glob match: simple wildcard matching (* and ?).
 */
function matchGlob(command: string, pattern: string): boolean {
  const regex = globToRegex(pattern)
  return regex.test(command.trimStart())
}

/**
 * Regex match: pattern is a regular expression.
 */
function matchRegex(command: string, pattern: string): boolean {
  try {
    const regex = new RegExp(pattern)
    return regex.test(command)
  } catch {
    // Invalid regex — treat as no match
    return false
  }
}

/**
 * Host executable match: the first token of the command matches the executable name.
 * Handles both bare names ("node") and full paths ("/usr/bin/node").
 */
function matchHostExecutable(command: string, execName: string): boolean {
  const trimmed = command.trimStart()
  // Extract first token (the executable)
  const spaceIdx = trimmed.indexOf(' ')
  const firstToken = spaceIdx === -1 ? trimmed : trimmed.slice(0, spaceIdx)

  // Direct match
  if (firstToken === execName) return true

  // Match against basename of a full path
  const slashIdx = firstToken.lastIndexOf('/')
  if (slashIdx !== -1) {
    const basename = firstToken.slice(slashIdx + 1)
    if (basename === execName) return true
  }

  // Match against common wrappers: env, sudo, npx, bunx
  const wrappers = ['env', 'sudo', 'npx', 'bunx', 'pnpx']
  for (const wrapper of wrappers) {
    if (firstToken === wrapper || firstToken.endsWith(`/${wrapper}`)) {
      // Check the next token
      const rest = trimmed.slice(spaceIdx === -1 ? trimmed.length : spaceIdx + 1).trimStart()
      // Skip flags (e.g., sudo -u root)
      const tokens = rest.split(/\s+/)
      for (const token of tokens) {
        if (token.startsWith('-')) continue
        const tokenBase = token.includes('/') ? token.slice(token.lastIndexOf('/') + 1) : token
        return tokenBase === execName
      }
    }
  }

  return false
}

/**
 * Convert a simple glob pattern to a RegExp.
 * Supports * (any chars) and ? (single char).
 */
function globToRegex(pattern: string): RegExp {
  const escaped = pattern
    .replace(/[.+^${}()|[\]\\]/g, '\\$&')
    .replace(/\*/g, '.*')
    .replace(/\?/g, '.')
  return new RegExp(`^${escaped}$`)
}

/**
 * Check if a command contains pipe-to-shell patterns (supply chain risk).
 * e.g., "curl ... | sh", "wget ... | bash"
 */
export function hasPipeToShell(command: string): boolean {
  return /\|\s*(sh|bash|zsh|fish|dash|ksh|csh|tcsh|python|python3|perl|ruby|node)\b/.test(command)
}
