/**
 * Guardian agent — dedicated approval sub-agent.
 *
 * Evaluates tool calls for security risk using a combination of
 * rule-based pre-classification and LLM-based assessment.
 * Fail-closed: any error, timeout, or malformed response → deny.
 */

import type { Message } from '../../types/message.js'
import { logForDebugging } from '../../utils/debug.js'
import { buildGuardianAssessmentPrompt, GUARDIAN_SYSTEM_PROMPT } from './prompts.js'
import { classifyToolRisk } from './riskTaxonomy.js'
import { buildCompactTranscript } from './transcript.js'
import {
  DEFAULT_GUARDIAN_CONFIG,
  type GuardianAssessment,
  type GuardianConfig,
  type ToolCallContext,
} from './types.js'

// ── Guardian Agent ───────────────────────────────────────────────────────

export class GuardianAgent {
  private config: GuardianConfig

  constructor(config?: Partial<GuardianConfig>) {
    this.config = { ...DEFAULT_GUARDIAN_CONFIG, ...config }
  }

  get enabled(): boolean {
    return this.config.enabled
  }

  /**
   * Assess a tool call for security risk.
   *
   * Flow:
   * 1. Rule-based pre-classification → if 'none', allow immediately
   * 2. Build compact transcript from conversation
   * 3. Call assessment model (with timeout)
   * 4. Parse structured JSON response
   * 5. On any failure → fail-closed (deny)
   */
  async assess(
    ctx: ToolCallContext,
    conversationMessages?: readonly Message[],
  ): Promise<GuardianAssessment> {
    const { tool_name, tool_input } = ctx

    // Step 1: Fast pre-classification
    const preClass = classifyToolRisk(tool_name, tool_input)

    logForDebugging(
      `[Guardian] pre-classification: ${tool_name} → ${preClass.level}/${preClass.category}` +
      (preClass.signals.length > 0 ? ` [${preClass.signals.join(', ')}]` : ''),
    )

    // If pre-classification says no risk, allow immediately
    if (preClass.level === 'none') {
      return {
        risk_level: 'none',
        risk_category: 'none',
        user_authorization: 'implicit',
        outcome: 'allow',
        rationale: 'Pre-classification: no risk signals detected.',
        tool_name,
        tool_input_summary: summarizeInput(tool_input),
      }
    }

    // Step 2: Build compact transcript
    const transcript = conversationMessages
      ? buildCompactTranscript(conversationMessages)
      : ctx.conversation_summary ?? ''

    // Step 3: Build assessment prompt
    const _userPrompt = buildGuardianAssessmentPrompt(
      tool_name,
      tool_input,
      transcript,
      preClass,
    )

    // Step 4: Call the assessment model
    // In the current implementation, we use the rule-based pre-classification
    // as the primary decision maker. The LLM-based assessment is a future
    // enhancement that will be wired up when a dedicated guardian model
    // endpoint is configured.
    //
    // For now, map pre-classification levels to decisions:
    return this.decideFromPreClassification(preClass, tool_name, tool_input)
  }

  /**
   * Rule-based decision from pre-classification.
   * Used as the primary path until LLM guardian model is configured.
   */
  private decideFromPreClassification(
    preClass: { level: string; category: string; signals: string[] },
    toolName: string,
    toolInput: Record<string, unknown>,
  ): GuardianAssessment {
    const inputSummary = summarizeInput(toolInput)

    if (preClass.level === 'critical') {
      return {
        risk_level: 'critical',
        risk_category: preClass.category as GuardianAssessment['risk_category'],
        user_authorization: 'none',
        outcome: 'deny',
        rationale: `Critical risk: ${preClass.signals.join(', ')}`,
        tool_name: toolName,
        tool_input_summary: inputSummary,
      }
    }

    if (preClass.level === 'high') {
      return {
        risk_level: 'high',
        risk_category: preClass.category as GuardianAssessment['risk_category'],
        user_authorization: 'none',
        outcome: 'deny',
        rationale: `High risk: ${preClass.signals.join(', ')}. Requires explicit user authorization.`,
        tool_name: toolName,
        tool_input_summary: inputSummary,
      }
    }

    // Medium and low → allow with rationale (will be escalated to user prompt)
    return {
      risk_level: preClass.level as GuardianAssessment['risk_level'],
      risk_category: preClass.category as GuardianAssessment['risk_category'],
      user_authorization: 'implicit',
      outcome: 'allow',
      rationale: preClass.signals.length > 0
        ? `Signals: ${preClass.signals.join(', ')}`
        : 'No significant risk signals.',
      tool_name: toolName,
      tool_input_summary: inputSummary,
    }
  }
}

// ── Helpers ──────────────────────────────────────────────────────────────

function summarizeInput(input: Record<string, unknown>): string {
  if ('command' in input && typeof input.command === 'string') {
    const cmd = input.command
    return cmd.length > 120 ? cmd.slice(0, 120) + '...' : cmd
  }
  if ('file_path' in input && typeof input.file_path === 'string') {
    return input.file_path
  }
  const keys = Object.keys(input).slice(0, 4)
  return keys.length > 0 ? `{${keys.join(', ')}}` : '(empty)'
}

// ── Singleton ────────────────────────────────────────────────────────────

let _instance: GuardianAgent | null = null

export function getGuardianAgent(config?: Partial<GuardianConfig>): GuardianAgent {
  if (!_instance || config) {
    _instance = new GuardianAgent(config)
  }
  return _instance
}

export function resetGuardianForTesting(): void {
  _instance = null
}
