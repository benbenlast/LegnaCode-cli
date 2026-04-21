/**
 * Execution policy module.
 */

export { ExecPolicyEngine, evaluateCommand, getExecPolicyEngine } from './engine.js'
export { matchCommand, hasPipeToShell } from './matcher.js'
export { parseExecPolicy } from './parser.js'
export { DEFAULT_RULES } from './defaults.js'
export type { PolicyConfig, PolicyDecision, PolicyEvalResult, PolicyRule, RuleKind } from './types.js'
