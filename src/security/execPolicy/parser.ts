/**
 * Execution policy parser — reads TOML-like policy files.
 *
 * Supports Codex-compatible syntax:
 *   prefix_rule("git commit", allow)
 *   host_executable("node", prompt)
 *   regex_rule("curl.*\\|.*sh", forbidden)
 *   glob_rule("rm -rf /*", forbidden)
 *
 * Also supports TOML table syntax:
 *   [[rules]]
 *   kind = "prefix"
 *   pattern = "git commit"
 *   decision = "allow"
 */

import type { PolicyConfig, PolicyDecision, PolicyRule, RuleKind } from './types.js'

const VALID_DECISIONS = new Set<PolicyDecision>(['allow', 'prompt', 'forbidden'])
const VALID_KINDS = new Set<RuleKind>(['prefix', 'glob', 'regex', 'host_executable'])

// Codex-style function call: prefix_rule("pattern", decision)
const FUNC_RULE_RE = /^(prefix_rule|host_executable|regex_rule|glob_rule)\s*\(\s*"([^"]+)"\s*,\s*(\w+)\s*\)/

const KIND_MAP: Record<string, RuleKind> = {
  prefix_rule: 'prefix',
  host_executable: 'host_executable',
  regex_rule: 'regex',
  glob_rule: 'glob',
}

export function parseExecPolicy(content: string): PolicyConfig {
  const rules: PolicyRule[] = []
  let defaultDecision: PolicyDecision = 'prompt'

  const lines = content.split('\n')

  // Track TOML table state
  let inRulesTable = false
  let currentRule: Partial<PolicyRule> = {}

  for (let i = 0; i < lines.length; i++) {
    const raw = lines[i]!
    const line = raw.trim()

    // Skip empty lines and comments
    if (!line || line.startsWith('#') || line.startsWith('//')) {
      // Flush any pending TOML rule on blank line
      if (inRulesTable && currentRule.kind && currentRule.pattern && currentRule.decision) {
        rules.push(currentRule as PolicyRule)
        currentRule = {}
      }
      continue
    }

    // TOML: default_decision = "prompt"
    if (line.startsWith('default_decision')) {
      const match = line.match(/default_decision\s*=\s*"?(\w+)"?/)
      if (match && VALID_DECISIONS.has(match[1] as PolicyDecision)) {
        defaultDecision = match[1] as PolicyDecision
      }
      continue
    }

    // TOML: [[rules]] table header
    if (line === '[[rules]]') {
      // Flush previous rule
      if (inRulesTable && currentRule.kind && currentRule.pattern && currentRule.decision) {
        rules.push(currentRule as PolicyRule)
      }
      inRulesTable = true
      currentRule = {}
      continue
    }

    // TOML table key-value pairs
    if (inRulesTable) {
      const kvMatch = line.match(/^(\w+)\s*=\s*"?([^"]*)"?$/)
      if (kvMatch) {
        const [, key, value] = kvMatch
        if (key === 'kind' && VALID_KINDS.has(value as RuleKind)) {
          currentRule.kind = value as RuleKind
        } else if (key === 'pattern') {
          currentRule.pattern = value!
        } else if (key === 'decision' && VALID_DECISIONS.has(value as PolicyDecision)) {
          currentRule.decision = value as PolicyDecision
        } else if (key === 'description') {
          currentRule.description = value
        }
        continue
      }
    }

    // Codex-style function call syntax
    const funcMatch = line.match(FUNC_RULE_RE)
    if (funcMatch) {
      const [, funcName, pattern, decision] = funcMatch
      const kind = KIND_MAP[funcName!]
      if (kind && VALID_DECISIONS.has(decision as PolicyDecision)) {
        rules.push({
          kind,
          pattern: pattern!,
          decision: decision as PolicyDecision,
        })
        inRulesTable = false
      }
      continue
    }
  }

  // Flush last TOML rule
  if (inRulesTable && currentRule.kind && currentRule.pattern && currentRule.decision) {
    rules.push(currentRule as PolicyRule)
  }

  return { rules, defaultDecision }
}
