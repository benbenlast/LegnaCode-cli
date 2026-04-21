/**
 * Execution policy types.
 */

export type PolicyDecision = 'allow' | 'prompt' | 'forbidden'

export type RuleKind = 'prefix' | 'glob' | 'regex' | 'host_executable'

export interface PolicyRule {
  kind: RuleKind
  pattern: string
  decision: PolicyDecision
  description?: string
}

export interface PolicyConfig {
  rules: PolicyRule[]
  defaultDecision: PolicyDecision
}

export interface PolicyEvalResult {
  decision: PolicyDecision
  matchedRule?: PolicyRule
  source: 'static' | 'default'
}
