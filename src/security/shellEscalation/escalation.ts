/**
 * Shell escalation protocol — per-command decision engine.
 *
 * Integrates execPolicy + Guardian pre-classification to decide:
 * - sandbox: run in restricted environment (read-only root, no network)
 * - escalate: require user confirmation, then run in full environment
 * - deny: refuse execution
 */

import { evaluateCommand } from '../execPolicy/index.js'
import { classifyCommandRisk } from '../guardian/riskTaxonomy.js'
import type { EscalationRequest, EscalationResult } from './types.js'
import { wrapCommand } from './sandboxWrapper.js'

// ── Patterns that need write access outside workdir ──────────────────────

const NEEDS_EXTERNAL_WRITE = [
  /\bsudo\b/,
  /\bapt(-get)?\s+install\b/,
  /\bbrew\s+install\b/,
  /\bnpm\s+install\s+-g\b/,
  /\bpip\s+install\b/,
  /\bcargo\s+install\b/,
  /\bsystemctl\b/,
  /\bservice\s+/,
  /\bmkdir\s+\/(usr|etc|var|opt)\b/,
]

// ── Patterns that need network ───────────────────────────────────────────

const NEEDS_NETWORK = [
  /\bcurl\b/,
  /\bwget\b/,
  /\bfetch\b/,
  /\bnpm\s+(install|publish|pack)\b/,
  /\bpip\s+install\b/,
  /\bcargo\s+(install|publish)\b/,
  /\bgit\s+(clone|fetch|pull|push)\b/,
  /\bssh\b/,
  /\bscp\b/,
  /\brsync\b/,
  /\bnc\b/,
  /\btelnet\b/,
]

// ── Shell Escalation Protocol ────────────────────────────────────────────

export class ShellEscalationProtocol {
  /**
   * Evaluate a command and decide how to execute it.
   */
  evaluate(request: EscalationRequest): EscalationResult {
    const { command, workingDir } = request

    // Step 1: Check static exec policy
    const policyResult = evaluateCommand(command)

    if (policyResult.decision === 'forbidden') {
      return {
        decision: 'deny',
        reason: policyResult.matchedRule?.description ?? 'Forbidden by execution policy.',
        originalCommand: command,
      }
    }

    // Step 2: Risk pre-classification
    const risk = classifyCommandRisk(command)

    // Critical/high risk → deny
    if (risk.level === 'critical' || risk.level === 'high') {
      return {
        decision: 'deny',
        reason: `${risk.level} risk: ${risk.signals.join(', ')}`,
        originalCommand: command,
      }
    }

    // Step 3: Check if command needs external write or network
    const needsExternalWrite = NEEDS_EXTERNAL_WRITE.some(p => p.test(command))
    const needsNetwork = NEEDS_NETWORK.some(p => p.test(command))

    // Medium risk or needs external write → escalate to user
    if (risk.level === 'medium' || needsExternalWrite) {
      return {
        decision: 'escalate',
        reason: needsExternalWrite
          ? 'Command requires write access outside workspace.'
          : `Medium risk: ${risk.signals.join(', ')}`,
        originalCommand: command,
      }
    }

    // Step 4: Policy says allow + low/no risk → sandbox
    if (policyResult.decision === 'allow' || risk.level === 'none' || risk.level === 'low') {
      const { wrapped, method } = wrapCommand(command, {
        networkIsolation: !needsNetwork,
        readOnlyRoot: true,
        workingDir,
      })

      // If no sandbox available, still allow but note it
      if (method === 'none') {
        return {
          decision: 'sandbox',
          reason: 'No sandbox runtime available; executing without isolation.',
          originalCommand: command,
          modifiedCommand: command,
        }
      }

      return {
        decision: 'sandbox',
        reason: `Sandboxed via ${method}.`,
        originalCommand: command,
        modifiedCommand: wrapped,
      }
    }

    // Step 5: Policy says prompt → escalate
    return {
      decision: 'escalate',
      reason: 'Execution policy requires user confirmation.',
      originalCommand: command,
    }
  }
}

// ── Singleton ────────────────────────────────────────────────────────────

let _instance: ShellEscalationProtocol | null = null

export function getShellEscalation(): ShellEscalationProtocol {
  if (!_instance) {
    _instance = new ShellEscalationProtocol()
  }
  return _instance
}

export function resetShellEscalationForTesting(): void {
  _instance = null
}
