/**
 * OML (Oh-My-LegnaCode) Agent Definitions
 *
 * 19 specialized agents ported from oh-my-claudecode.
 * Each agent has a name, description, model tier, and role constraints.
 */

import type { BundledSkillDefinition } from '../../../skills/bundledSkills.js'

type AgentDef = {
  name: string
  description: string
  model?: string
  disallowedTools?: string[]
}

const AGENTS: AgentDef[] = [
  { name: 'explore', description: 'Codebase search specialist for finding files and code patterns', model: 'haiku', disallowedTools: ['Write', 'Edit'] },
  { name: 'analyst', description: 'Pre-planning consultant for requirements analysis', model: 'opus', disallowedTools: ['Write', 'Edit'] },
  { name: 'planner', description: 'Strategic planning consultant with interview workflow', model: 'opus' },
  { name: 'architect', description: 'Strategic Architecture & Debugging Advisor (READ-ONLY)', model: 'opus', disallowedTools: ['Write', 'Edit'] },
  { name: 'executor', description: 'Focused task executor for implementation work', model: 'sonnet' },
  { name: 'debugger', description: 'Root-cause analysis, regression isolation, stack trace analysis', model: 'sonnet' },
  { name: 'verifier', description: 'Verification strategy, evidence-based completion checks', model: 'sonnet' },
  { name: 'tracer', description: 'Evidence-driven causal tracing with competing hypotheses', model: 'sonnet' },
  { name: 'code-reviewer', description: 'Expert code review with severity-rated feedback and SOLID checks', model: 'opus', disallowedTools: ['Write', 'Edit'] },
  { name: 'security-reviewer', description: 'Security vulnerability detection (OWASP Top 10, secrets, unsafe patterns)', model: 'opus', disallowedTools: ['Write', 'Edit'] },
  { name: 'code-simplifier', description: 'Simplifies code for clarity and maintainability', model: 'opus' },
  { name: 'test-engineer', description: 'Test strategy, integration/e2e coverage, TDD workflows', model: 'sonnet' },
  { name: 'designer', description: 'Expert UI/UX designer producing high-fidelity frontend artifacts. Uses oklch color space for harmonious palettes, mobile-first responsive layouts, semantic HTML with ARIA accessibility, CSS transitions for micro-interactions, and component-first architecture. Produces 3+ design variations from conservative to experimental when exploring concepts. Every visual choice serves the content.', model: 'sonnet' },
  { name: 'writer', description: 'Technical documentation writer for README, API docs, comments', model: 'haiku' },
  { name: 'qa-tester', description: 'Interactive CLI testing specialist', model: 'sonnet' },
  { name: 'scientist', description: 'Data analysis and research execution specialist', model: 'sonnet', disallowedTools: ['Write', 'Edit'] },
  { name: 'git-master', description: 'Git expert for atomic commits, rebasing, history management', model: 'sonnet' },
  { name: 'document-specialist', description: 'External Documentation & Reference Specialist', model: 'sonnet', disallowedTools: ['Write', 'Edit'] },
  { name: 'critic', description: 'Work plan and code review expert — thorough, multi-perspective', model: 'opus', disallowedTools: ['Write', 'Edit'] },
]

/**
 * Convert agent definitions to BundledSkillDefinition[] for the plugin system.
 * Each agent becomes a slash command: /oml:explore, /oml:planner, etc.
 */
export function getAgentSkills(): BundledSkillDefinition[] {
  return AGENTS.map((agent): BundledSkillDefinition => ({
    name: `oml:${agent.name}`,
    description: `[OML] ${agent.description}`,
    argumentHint: '<task description>',
    userInvocable: true,
    model: agent.model,
    agent: agent.name,
    getPromptForCommand: (args: string) => {
      const disallowed = agent.disallowedTools?.length
        ? `\n\nTOOL RESTRICTIONS: You MUST NOT use these tools: ${agent.disallowedTools.join(', ')}.`
        : ''
      return Promise.resolve([{ type: 'text' as const, text: `You are the ${agent.name} agent. ${agent.description}.${disallowed}\n\nTask: ${args}` }])
    },
  }))
}
