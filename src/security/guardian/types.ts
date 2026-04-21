/**
 * Guardian sub-agent type definitions.
 *
 * The Guardian is a dedicated approval agent that evaluates tool calls
 * for risk before execution. It uses structured risk taxonomy and
 * fail-closed design (deny on timeout/error).
 */

export type RiskLevel = 'none' | 'low' | 'medium' | 'high' | 'critical'

export type RiskCategory =
  | 'data_exfiltration'
  | 'credential_probing'
  | 'security_weakening'
  | 'destructive_action'
  | 'privilege_escalation'
  | 'supply_chain'
  | 'none'

export interface GuardianAssessment {
  risk_level: RiskLevel
  risk_category: RiskCategory
  user_authorization: 'explicit' | 'implicit' | 'none'
  outcome: 'allow' | 'deny'
  rationale: string
  tool_name: string
  tool_input_summary: string
}

export interface GuardianConfig {
  enabled: boolean
  timeout_ms: number
  model?: string
  fail_closed: boolean
  bypass_for_allow_rules: boolean
}

export const DEFAULT_GUARDIAN_CONFIG: GuardianConfig = {
  enabled: false,
  timeout_ms: 90_000,
  fail_closed: true,
  bypass_for_allow_rules: true,
}

/** Minimal tool-call representation passed to Guardian for assessment. */
export interface ToolCallContext {
  tool_name: string
  tool_input: Record<string, unknown>
  conversation_summary?: string
}
