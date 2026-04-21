/**
 * Execution policy engine — evaluates commands against static rules.
 *
 * Rule evaluation order:
 * 1. User project rules ($CWD/.legnacode/exec-policy.toml)
 * 2. User global rules (~/.legnacode/exec-policy.toml)
 * 3. Built-in default rules
 *
 * First matching rule wins. If no rule matches, defaultDecision applies.
 */

import * as fs from 'fs'
import * as os from 'os'
import * as path from 'path'
import { DEFAULT_RULES } from './defaults.js'
import { hasPipeToShell, matchCommand } from './matcher.js'
import { parseExecPolicy } from './parser.js'
import type { PolicyConfig, PolicyEvalResult, PolicyRule } from './types.js'

export class ExecPolicyEngine {
  private rules: PolicyRule[] = []
  private defaultDecision: PolicyConfig['defaultDecision'] = 'prompt'
  private loaded = false

  /**
   * Load policy rules from config files + built-in defaults.
   * Call once at startup; results are cached.
   */
  load(cwd?: string): void {
    const allRules: PolicyRule[] = []
    const workDir = cwd ?? process.cwd()

    // 1. Project-level policy (highest priority)
    const projectPolicy = this.tryLoadFile(path.join(workDir, '.legnacode', 'exec-policy.toml'))
    if (projectPolicy) {
      allRules.push(...projectPolicy.rules)
      this.defaultDecision = projectPolicy.defaultDecision
    }

    // 2. User-level policy
    const userPolicy = this.tryLoadFile(path.join(os.homedir(), '.legnacode', 'exec-policy.toml'))
    if (userPolicy) {
      allRules.push(...userPolicy.rules)
      if (!projectPolicy) {
        this.defaultDecision = userPolicy.defaultDecision
      }
    }

    // 3. Built-in defaults (lowest priority)
    allRules.push(...DEFAULT_RULES)

    this.rules = allRules
    this.loaded = true
  }

  /**
   * Evaluate a command against the policy.
   */
  evaluate(command: string): PolicyEvalResult {
    if (!this.loaded) {
      this.load()
    }

    // Special case: pipe-to-shell is always forbidden regardless of rules
    if (hasPipeToShell(command)) {
      return {
        decision: 'forbidden',
        matchedRule: {
          kind: 'regex',
          pattern: '(pipe-to-shell)',
          decision: 'forbidden',
          description: 'Pipe to shell interpreter detected',
        },
        source: 'static',
      }
    }

    // Evaluate rules in order — first match wins
    for (const rule of this.rules) {
      if (matchCommand(command, rule)) {
        return {
          decision: rule.decision,
          matchedRule: rule,
          source: 'static',
        }
      }
    }

    // No rule matched — use default
    return {
      decision: this.defaultDecision,
      source: 'default',
    }
  }

  /**
   * Get all loaded rules (for debugging / /sandbox-info).
   */
  getRules(): readonly PolicyRule[] {
    if (!this.loaded) this.load()
    return this.rules
  }

  private tryLoadFile(filePath: string): PolicyConfig | null {
    try {
      const content = fs.readFileSync(filePath, 'utf-8')
      return parseExecPolicy(content)
    } catch {
      return null
    }
  }
}

// Singleton instance
let _engine: ExecPolicyEngine | undefined

export function getExecPolicyEngine(): ExecPolicyEngine {
  if (!_engine) {
    _engine = new ExecPolicyEngine()
  }
  return _engine
}

/**
 * Quick evaluate — convenience function.
 */
export function evaluateCommand(command: string): PolicyEvalResult {
  return getExecPolicyEngine().evaluate(command)
}
