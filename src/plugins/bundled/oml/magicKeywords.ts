/**
 * OML (Oh-My-LegnaCode) Magic Keywords
 *
 * Detects magic keywords in user prompts and injects orchestration instructions.
 * Ported from oh-my-claudecode's magic-keywords.ts + keyword-detector.
 * Pure functions, zero external dependencies.
 */

/** Remove code blocks to prevent false keyword detection */
function stripCode(text: string): string {
  return text.replace(/```[\s\S]*?```/g, '').replace(/`[^`]+`/g, '')
}

/** Informational intent patterns — don't trigger on "what is ultrawork" */
const INFO_PATTERNS: RegExp[] = [
  /\b(?:what(?:'s|\s+is)|how\s+(?:to|do\s+i)\s+use|explain|tell\s+me\s+about|describe)\b/i,
  /(?:뭐야|무엇|어떻게|설명|사용법|알려\s?줘)/u,
  /(?:とは|って何|使い方|説明)/u,
  /(?:什么是|怎么用|如何使用|解释|说明)/u,
]

function isInfoContext(text: string, pos: number, len: number): boolean {
  const ctx = text.slice(Math.max(0, pos - 80), Math.min(text.length, pos + len + 80))
  return INFO_PATTERNS.some(p => p.test(ctx))
}

function hasActionable(text: string, pattern: RegExp): boolean {
  const g = new RegExp(pattern.source, pattern.flags.includes('g') ? pattern.flags : `${pattern.flags}g`)
  for (const m of text.matchAll(g)) {
    if (m.index !== undefined && !isInfoContext(text, m.index, m[0].length)) return true
  }
  return false
}

type KeywordDef = { pattern: RegExp; inject: (prompt: string) => string }

function removeTriggers(prompt: string, triggers: string[]): string {
  let r = prompt
  for (const t of triggers) r = r.replace(new RegExp(`\\b${t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'gi'), '')
  return r.trim()
}

const ULTRAWORK_MSG = `<ultrawork-mode>
[CODE RED] Maximum precision required. Ultrathink before acting.

YOU MUST LEVERAGE ALL AVAILABLE AGENTS TO THEIR FULLEST POTENTIAL.

## AGENT UTILIZATION
- **Codebase Exploration**: Spawn explore agents via BACKGROUND TASKS for file patterns, project structure
- **Documentation**: Use document-specialist agents for API references, external docs
- **Planning**: ALWAYS spawn a dedicated planning agent for work breakdown
- **High-IQ Reasoning**: Leverage architect/critic for architecture decisions

## EXECUTION RULES
- **TODO**: Track EVERY step. Mark complete IMMEDIATELY after each.
- **PARALLEL**: Fire independent agent calls simultaneously — NEVER wait sequentially.
- **BACKGROUND FIRST**: Use Task(run_in_background=true) for exploration agents (10+ concurrent if needed).
- **VERIFY**: Re-read request after completion. Check ALL requirements met.
- **NO Scope Reduction**: Deliver FULL implementation, not demos or skeletons.
- **NO Premature Stopping**: Never declare done until ALL TODOs completed and verified.
</ultrawork-mode>

`

const RALPH_MSG = `<ralph-mode>
[RALPH — PERSISTENCE LOOP ACTIVATED]

You are in Ralph mode. You MUST continue working until ALL tasks are complete.

## THE SACRED RULES
1. **NEVER ABANDON INCOMPLETE WORK** — Read your todo list before any stop attempt
2. **VERIFICATION IS MANDATORY** — "It should work" is NOT verification. TEST IT.
3. **BLOCKERS ARE OBSTACLES TO OVERCOME** — Find alternatives, never use as excuse to stop
4. **THE BOULDER NEVER STOPS** — Only stop when 100% complete or user says "stop"

## WORKFLOW
1. Break task into discrete steps with testable acceptance criteria
2. Execute with ultrawork-level parallelism
3. Verify each step before marking complete
4. Loop until all steps pass verification
</ralph-mode>

`

const AUTOPILOT_MSG = `<autopilot-mode>
[AUTOPILOT — FULL AUTONOMOUS PIPELINE]

Execute the complete pipeline autonomously:
1. **Plan**: Spawn planner agent to create detailed work breakdown
2. **Execute**: Use ultrawork parallelism for implementation
3. **Verify**: Run tests, check all acceptance criteria
4. **Fix**: If anything fails, loop back and fix
5. **Complete**: Only stop when everything passes

Do NOT ask for permission at any step. Execute autonomously.
</autopilot-mode>

`

const KEYWORDS: KeywordDef[] = [
  {
    pattern: /\b(ultrawork|ulw)\b|(울트라워크)/i,
    inject: (p) => ULTRAWORK_MSG + removeTriggers(p, ['ultrawork', 'ulw']),
  },
  {
    pattern: /\b(ralph)\b|(랄프)/i,
    inject: (p) => RALPH_MSG + removeTriggers(p, ['ralph']),
  },
  {
    pattern: /\b(autopilot|auto[\s-]?pilot|fullsend|full\s+auto)\b|(오토파일럿)/i,
    inject: (p) => AUTOPILOT_MSG + removeTriggers(p, ['autopilot', 'fullsend']),
  },
  {
    pattern: /\b(ultrathink)\b|(울트라씽크)/i,
    inject: (p) => `[ULTRATHINK MODE — EXTENDED REASONING]\n\n${removeTriggers(p, ['ultrathink'])}\n\nTake your time. Consider multiple approaches. Identify edge cases. Question assumptions. Evaluate trade-offs. Quality of reasoning > speed.`,
  },
]

/**
 * Detect if a prompt implies deep scope (architecture, migration, refactor).
 * Returns a lightweight hint to append, or empty string.
 */
function compoundScopeHint(prompt: string): string {
  const cleaned = stripCode(prompt).toLowerCase()
  const deepSignals = [
    'refactor', 'migrate', 'architecture', 'redesign', 'rewrite', 'overhaul',
    '重构', '迁移', '架构', '重写', '重新设计',
    'リファクタ', 'アーキテクチャ', '移行',
  ]
  const hits = deepSignals.filter(s => cleaned.includes(s)).length
  if (hits === 0) return ''
  return '\n\n[Compound hint: This looks like a significant change. Consider documenting key decisions and learnings for future reference.]'
}

/**
 * Process magic keywords in user prompt.
 * Returns the original prompt if no keywords detected, or the enhanced prompt.
 */
export function processMagicKeywords(prompt: string): string {
  const cleaned = stripCode(prompt)
  let result = prompt

  for (const kw of KEYWORDS) {
    if (hasActionable(cleaned, kw.pattern)) {
      result = kw.inject(result)
      break // only apply highest-priority match
    }
  }

  // Compound engineering: append scope hint for deep changes (lightweight, ~15 tokens)
  result += compoundScopeHint(result)

  return result
}
