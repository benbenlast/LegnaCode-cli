/**
 * Security module — barrel export.
 */

export { hardenProcess, isBeingTraced } from './processHardening.js'
export type { HardeningReport } from './processHardening.js'

export {
  ExecPolicyEngine,
  evaluateCommand,
  getExecPolicyEngine,
  matchCommand,
  hasPipeToShell,
  parseExecPolicy,
  DEFAULT_RULES,
} from './execPolicy/index.js'
export type {
  PolicyConfig,
  PolicyDecision,
  PolicyEvalResult,
  PolicyRule,
  RuleKind,
} from './execPolicy/index.js'

export {
  detectSecrets,
  redactSecrets,
  containsSecrets,
  getSecretPatternTypes,
} from './secretDetector.js'
export type { SecretMatch, SecretPattern } from './secretDetector.js'

// Phase 2: Guardian sub-agent
export {
  GuardianAgent,
  getGuardianAgent,
  classifyCommandRisk,
  classifyToolRisk,
  buildCompactTranscript,
} from './guardian/index.js'
export type {
  GuardianAssessment,
  GuardianConfig,
  RiskCategory,
  RiskLevel,
  ToolCallContext,
} from './guardian/index.js'

// Phase 2: Shell escalation protocol
export {
  ShellEscalationProtocol,
  getShellEscalation,
  wrapCommand,
  detectSandboxCapabilities,
} from './shellEscalation/index.js'
export type {
  EscalationDecision,
  EscalationRequest,
  EscalationResult,
  SandboxCapabilities,
} from './shellEscalation/index.js'

// Phase 2: Network policy
export {
  NetworkPolicyEnforcer,
  getNetworkPolicyEnforcer,
  initNetworkPolicy,
  matchDomain,
  isUrlAllowed,
  isDomainAllowed,
} from './networkPolicy/index.js'
export type {
  NetworkCheckResult,
  NetworkMode,
  NetworkPolicy,
} from './networkPolicy/index.js'
