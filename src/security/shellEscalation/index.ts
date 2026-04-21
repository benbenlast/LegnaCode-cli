/**
 * Shell escalation protocol — barrel export.
 */

export {
  ShellEscalationProtocol,
  getShellEscalation,
  resetShellEscalationForTesting,
} from './escalation.js'

export {
  wrapCommand,
  detectSandboxCapabilities,
  resetCapabilitiesForTesting,
} from './sandboxWrapper.js'

export type {
  EscalationDecision,
  EscalationRequest,
  EscalationResult,
  SandboxCapabilities,
} from './types.js'
