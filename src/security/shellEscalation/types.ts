/**
 * Shell escalation protocol type definitions.
 *
 * Provides a three-tier decision model for command execution:
 * - sandbox: execute in a restricted environment
 * - escalate: require explicit user confirmation
 * - deny: refuse execution entirely
 */

export type EscalationDecision = 'sandbox' | 'escalate' | 'deny'

export interface EscalationRequest {
  command: string
  workingDir: string
  env: Record<string, string>
  requestedBy: string // tool name
}

export interface EscalationResult {
  decision: EscalationDecision
  reason: string
  modifiedCommand?: string // sandbox-wrapped command
  originalCommand: string
}

export interface SandboxCapabilities {
  hasNativeAddon: boolean // Rust NAPI addon (Level 3)
  hasBwrap: boolean    // bubblewrap (Linux)
  hasSeatbelt: boolean // sandbox-exec (macOS)
  hasUnshare: boolean  // unshare (Linux fallback)
  platform: NodeJS.Platform
}
