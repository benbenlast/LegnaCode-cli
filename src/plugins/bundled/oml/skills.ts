/**
 * OML (Oh-My-LegnaCode) Skill Definitions
 *
 * Core orchestration skills: ultrawork, ralph, autopilot, ralplan, plan.
 * Registered as slash commands: /ultrawork, /ralph, /autopilot, /ralplan, /plan-oml.
 */

import type { BundledSkillDefinition } from '../../../skills/bundledSkills.js'

export function getOrchestratorSkills(): BundledSkillDefinition[] {
  return [
    {
      name: 'ultrawork',
      description: '[OML] 并行执行引擎 — 最大化 agent 利用，同时启动多个 agent 并行工作',
      argumentHint: '<task description>',
      userInvocable: true,
      getPromptForCommand: (args: string) => ULTRAWORK_SKILL(args),
    },
    {
      name: 'ralph',
      description: '[OML] 持久循环 — 不完成不停止，自动验证+重试直到所有任务完成',
      argumentHint: '<task description>',
      userInvocable: true,
      getPromptForCommand: (args: string) => RALPH_SKILL(args),
    },
    {
      name: 'autopilot',
      description: '[OML] 全自主执行 — 规划→执行→验证→修复的完整流水线',
      argumentHint: '<task description>',
      userInvocable: true,
      getPromptForCommand: (args: string) => AUTOPILOT_SKILL(args),
    },
    {
      name: 'ralplan',
      description: '[OML] 先规划再执行 — 模糊请求自动重定向到结构化规划',
      argumentHint: '<task description>',
      userInvocable: true,
      getPromptForCommand: (args: string) => RALPLAN_SKILL(args),
    },
    {
      name: 'plan-oml',
      description: '[OML] 结构化规划 — 通过 planner agent 创建详细工作计划',
      argumentHint: '<task description>',
      userInvocable: true,
      model: 'opus',
      getPromptForCommand: (args: string) => PLAN_SKILL(args),
    },
  ]
}

function ULTRAWORK_SKILL(args: string): string {
  return `<ultrawork-mode>
[CODE RED] Maximum precision required. Ultrathink before acting.

YOU MUST LEVERAGE ALL AVAILABLE AGENTS TO THEIR FULLEST POTENTIAL.

## AGENT UTILIZATION
- **Codebase Exploration**: Spawn explore agents via BACKGROUND TASKS
- **Documentation**: Use document-specialist agents for API references
- **Planning**: ALWAYS spawn a dedicated planning agent for work breakdown
- **High-IQ Reasoning**: Leverage architect/critic for architecture decisions

## EXECUTION RULES
- **TODO**: Track EVERY step. Mark complete IMMEDIATELY after each.
- **PARALLEL**: Fire independent agent calls simultaneously — NEVER wait sequentially.
- **BACKGROUND FIRST**: Use Task(run_in_background=true) for exploration (10+ concurrent).
- **VERIFY**: Re-read request after completion. Check ALL requirements met.
- **NO Scope Reduction**: Deliver FULL implementation.
- **NO Premature Stopping**: Never declare done until ALL TODOs completed and verified.
</ultrawork-mode>

Task: ${args}`
}

function RALPH_SKILL(args: string): string {
  return `<ralph-mode>
[RALPH — PERSISTENCE LOOP ACTIVATED]

You MUST continue working until ALL tasks are complete. The boulder never stops.

## RULES
1. NEVER ABANDON INCOMPLETE WORK — Read todo list before any stop attempt
2. VERIFICATION IS MANDATORY — "It should work" is NOT verification. TEST IT.
3. BLOCKERS ARE OBSTACLES TO OVERCOME — Find alternatives
4. Only stop when 100% complete or user says "stop"

## WORKFLOW
1. Break task into discrete steps with testable acceptance criteria
2. Execute with ultrawork-level parallelism
3. Verify each step before marking complete
4. Loop until all steps pass verification
</ralph-mode>

Task: ${args}`
}

function AUTOPILOT_SKILL(args: string): string {
  return `<autopilot-mode>
[AUTOPILOT — FULL AUTONOMOUS PIPELINE]

Execute autonomously without asking for permission:
1. **Plan**: Spawn planner agent for detailed work breakdown
2. **Execute**: Use ultrawork parallelism for implementation
3. **Verify**: Run tests, check all acceptance criteria
4. **Fix**: If anything fails, loop back and fix
5. **Complete**: Only stop when everything passes
</autopilot-mode>

Task: ${args}`
}

function RALPLAN_SKILL(args: string): string {
  return `<ralplan-mode>
[RALPLAN — PLAN FIRST, THEN EXECUTE]

This task needs structured planning before execution.

## PHASE 1: PLANNING
1. Spawn explore agents to gather codebase context (parallel, background)
2. Spawn planner agent to create detailed work breakdown
3. Review plan with critic agent for gap analysis
4. Get user confirmation on the plan

## PHASE 2: EXECUTION (after plan approval)
1. Execute plan using ralph mode (persistence loop)
2. Verify each step against acceptance criteria
3. Loop until complete
</ralplan-mode>

Task: ${args}`
}

function PLAN_SKILL(args: string): string {
  return `You are the Planner agent. Your mission: create clear, actionable work plans.

## RULES
- You plan. You do NOT implement.
- Ask ONE question at a time. Never batch questions.
- Never ask about codebase facts — use explore agent to look them up.
- Default to 3-6 step plans. Avoid over-specification.

## WORKFLOW
1. Spawn explore agents (background) for codebase context
2. Classify intent: Trivial | Refactoring | Build from Scratch | Mid-sized
3. Ask user about priorities/preferences (not codebase facts)
4. Generate plan with: Context, Objectives, Guardrails, Task Flow, Success Criteria
5. Wait for user approval before any handoff

Task: ${args}`
}
