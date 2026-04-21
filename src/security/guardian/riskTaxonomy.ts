/**
 * Risk taxonomy — rule-based fast pre-classification.
 *
 * Runs before the LLM-based Guardian assessment to provide a prior
 * risk signal. If the pre-classification returns 'none', the Guardian
 * can skip the expensive model call entirely.
 */

import type { RiskCategory, RiskLevel } from './types.js'

export interface RiskPreClassification {
  level: RiskLevel
  category: RiskCategory
  signals: string[]
}

// ── Signal patterns ──────────────────────────────────────────────────────

interface SignalRule {
  pattern: RegExp
  level: RiskLevel
  category: RiskCategory
  signal: string
}

const SIGNAL_RULES: SignalRule[] = [
  // ── Critical ───────────────────────────────────────────────────────
  { pattern: /rm\s+-rf\s+\/(?!\w)/, level: 'critical', category: 'destructive_action', signal: 'rm -rf /' },
  { pattern: /mkfs\b/, level: 'critical', category: 'destructive_action', signal: 'mkfs (format disk)' },
  { pattern: /dd\s+if=/, level: 'critical', category: 'destructive_action', signal: 'dd raw disk write' },
  { pattern: /:(){ :\|:& };:/, level: 'critical', category: 'destructive_action', signal: 'fork bomb' },

  // ── High ───────────────────────────────────────────────────────────
  { pattern: /curl\s.*-X\s*POST.*-d\s+@/, level: 'high', category: 'data_exfiltration', signal: 'curl POST with file upload' },
  { pattern: /curl\s.*--data.*@/, level: 'high', category: 'data_exfiltration', signal: 'curl data from file' },
  { pattern: /nc\s+-[lp]/, level: 'high', category: 'data_exfiltration', signal: 'netcat listener' },
  { pattern: /\/etc\/shadow/, level: 'high', category: 'credential_probing', signal: 'access /etc/shadow' },
  { pattern: /~\/\.ssh\//, level: 'high', category: 'credential_probing', signal: 'access ~/.ssh/' },
  { pattern: /~\/\.aws\//, level: 'high', category: 'credential_probing', signal: 'access ~/.aws/' },
  { pattern: /~\/\.gnupg\//, level: 'high', category: 'credential_probing', signal: 'access ~/.gnupg/' },
  { pattern: /chmod\s+777/, level: 'high', category: 'security_weakening', signal: 'chmod 777' },
  { pattern: /chmod\s+[0-7]*[2367][0-7]*\s/, level: 'high', category: 'security_weakening', signal: 'world-writable chmod' },
  { pattern: /iptables\s.*-F/, level: 'high', category: 'security_weakening', signal: 'flush iptables' },
  { pattern: /ufw\s+disable/, level: 'high', category: 'security_weakening', signal: 'disable firewall' },
  { pattern: /sudo\s+su\b/, level: 'high', category: 'privilege_escalation', signal: 'sudo su' },
  { pattern: /sudo\s+-i\b/, level: 'high', category: 'privilege_escalation', signal: 'sudo -i (root shell)' },

  // ── Medium ─────────────────────────────────────────────────────────
  { pattern: /sudo\s+/, level: 'medium', category: 'privilege_escalation', signal: 'sudo command' },
  { pattern: /npm\s+install\b/, level: 'medium', category: 'supply_chain', signal: 'npm install' },
  { pattern: /pip\s+install\b/, level: 'medium', category: 'supply_chain', signal: 'pip install' },
  { pattern: /cargo\s+install\b/, level: 'medium', category: 'supply_chain', signal: 'cargo install' },
  { pattern: /brew\s+install\b/, level: 'medium', category: 'supply_chain', signal: 'brew install' },
  { pattern: /apt(-get)?\s+install\b/, level: 'medium', category: 'supply_chain', signal: 'apt install' },
  { pattern: /curl\s+/, level: 'medium', category: 'data_exfiltration', signal: 'curl request' },
  { pattern: /wget\s+/, level: 'medium', category: 'data_exfiltration', signal: 'wget request' },
  { pattern: /\.env\b/, level: 'medium', category: 'credential_probing', signal: 'access .env file' },
  { pattern: /chown\s+/, level: 'medium', category: 'security_weakening', signal: 'chown' },

  // ── Low ────────────────────────────────────────────────────────────
  { pattern: /git\s+push\b/, level: 'low', category: 'none', signal: 'git push' },
  { pattern: /git\s+commit\b/, level: 'low', category: 'none', signal: 'git commit' },
]

// ── Read-only patterns (always 'none') ───────────────────────────────

const READ_ONLY_PATTERNS = [
  /^git\s+(status|diff|log|branch|show|remote|tag)\b/,
  /^ls\b/,
  /^cat\b/,
  /^head\b/,
  /^tail\b/,
  /^wc\b/,
  /^find\b/,
  /^grep\b/,
  /^rg\b/,
  /^fd\b/,
  /^file\b/,
  /^stat\b/,
  /^which\b/,
  /^echo\b/,
  /^pwd\b/,
  /^whoami\b/,
  /^(node|python|rustc|go|java|ruby)\s+--version\b/,
]

// ── Public API ───────────────────────────────────────────────────────

/**
 * Fast rule-based risk pre-classification for a command string.
 */
export function classifyCommandRisk(command: string): RiskPreClassification {
  const trimmed = command.trim()

  // Check read-only first
  for (const ro of READ_ONLY_PATTERNS) {
    if (ro.test(trimmed)) {
      return { level: 'none', category: 'none', signals: [] }
    }
  }

  // Collect all matching signals, return the highest severity
  const matched: { rule: SignalRule; signal: string }[] = []
  for (const rule of SIGNAL_RULES) {
    if (rule.pattern.test(trimmed)) {
      matched.push({ rule, signal: rule.signal })
    }
  }

  if (matched.length === 0) {
    return { level: 'low', category: 'none', signals: [] }
  }

  // Sort by severity (critical > high > medium > low)
  const LEVEL_ORDER: Record<RiskLevel, number> = {
    none: 0, low: 1, medium: 2, high: 3, critical: 4,
  }
  matched.sort((a, b) => LEVEL_ORDER[b.rule.level] - LEVEL_ORDER[a.rule.level])

  const highest = matched[0]!
  return {
    level: highest.rule.level,
    category: highest.rule.category,
    signals: matched.map(m => m.signal),
  }
}

/**
 * Pre-classify a tool call (not just Bash — also FileEdit, FileWrite, etc.).
 */
export function classifyToolRisk(
  toolName: string,
  toolInput: Record<string, unknown>,
): RiskPreClassification {
  // Bash commands get full signal analysis
  if (toolName === 'Bash' || toolName === 'bash') {
    const cmd = typeof toolInput.command === 'string' ? toolInput.command : ''
    return classifyCommandRisk(cmd)
  }

  // File writes to sensitive paths
  if (toolName === 'Write' || toolName === 'Edit') {
    const filePath = typeof toolInput.file_path === 'string' ? toolInput.file_path : ''
    if (/\/etc\/|~\/\.ssh\/|~\/\.aws\/|\.env$/.test(filePath)) {
      return { level: 'high', category: 'credential_probing', signals: [`write to ${filePath}`] }
    }
    return { level: 'low', category: 'none', signals: [] }
  }

  // Read-only tools
  if (['Read', 'Glob', 'Grep', 'LSP'].includes(toolName)) {
    return { level: 'none', category: 'none', signals: [] }
  }

  // Web tools
  if (toolName === 'WebFetch' || toolName === 'WebSearch') {
    return { level: 'low', category: 'none', signals: ['network request'] }
  }

  return { level: 'low', category: 'none', signals: [] }
}
