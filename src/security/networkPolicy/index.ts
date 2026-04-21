/**
 * Network policy — barrel export.
 */

export {
  NetworkPolicyEnforcer,
  getNetworkPolicyEnforcer,
  initNetworkPolicy,
  resetNetworkPolicyForTesting,
} from './policyEnforcer.js'

export {
  matchDomain,
  extractDomain,
  matchesAnyPattern,
  isUrlAllowed,
  isDomainAllowed,
} from './domainMatcher.js'

export {
  DEFAULT_NETWORK_POLICY,
  LIMITED_MODE_METHODS,
  type NetworkAuditEntry,
  type NetworkCheckResult,
  type NetworkMode,
  type NetworkPolicy,
} from './types.js'
