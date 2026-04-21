import { feature } from 'bun:bundle'
import { getInvokedSkillsForAgent } from '../../bootstrap/state.js'
import { getFeatureValue_CACHED_MAY_BE_STALE } from '../../services/analytics/growthbook.js'
import {
  type AnalyticsMetadata_I_VERIFIED_THIS_IS_NOT_CODE_OR_FILEPATHS,
  type AnalyticsMetadata_I_VERIFIED_THIS_IS_PII_TAGGED,
  logEvent,
} from '../../services/analytics/index.js'
import { queryModelWithoutStreaming } from '../../services/api/claude.js'
import { getEmptyToolPermissionContext } from '../../Tool.js'
import type { Message } from '../../types/message.js'
import { createAbortController } from '../abortController.js'
import { count } from '../array.js'
import { getCwd } from '../cwd.js'
import { toError } from '../errors.js'
import { logError } from '../log.js'
import {
  createUserMessage,
  extractTag,
  extractTextContent,
} from '../messages.js'
import { getSmallFastModel } from '../model/model.js'
import { jsonParse } from '../slowOperations.js'
import { asSystemPrompt } from '../systemPromptType.js'
import {
  type ApiQueryHookConfig,
  createApiQueryHook,
} from './apiQueryHookHelper.js'
import { registerPostSamplingHook } from './postSamplingHooks.js'

const TURN_BATCH_SIZE = 5
const GENERAL_TURN_BATCH_SIZE = 10 // less frequent for general conversation learning

export type SkillUpdate = {
  section: string
  change: string
  reason: string
}

function formatRecentMessages(messages: Message[]): string {
  return messages
    .filter(m => m.type === 'user' || m.type === 'assistant')
    .map(m => {
      const role = m.type === 'user' ? 'User' : 'Assistant'
      const content = m.message.content
      if (typeof content === 'string')
        return `${role}: ${content.slice(0, 500)}`
      const text = content
        .filter(
          (b): b is Extract<typeof b, { type: 'text' }> => b.type === 'text',
        )
        .map(b => b.text)
        .join('\n')
      return `${role}: ${text.slice(0, 500)}`
    })
    .join('\n\n')
}

function findProjectSkill() {
  const skills = getInvokedSkillsForAgent(null)
  for (const [, info] of skills) {
    if (info.skillPath.startsWith('projectSettings:')) {
      return info
    }
  }
  return undefined
}

function createSkillImprovementHook() {
  let lastAnalyzedCount = 0
  let lastAnalyzedIndex = 0

  const config: ApiQueryHookConfig<SkillUpdate[]> = {
    name: 'skill_improvement',

    async shouldRun(context) {
      if (context.querySource !== 'repl_main_thread') {
        return false
      }

      const userCount = count(context.messages, m => m.type === 'user')

      // Path A: active skill execution — check every 5 user messages
      // Path B: general conversation — check every 10 user messages
      const batchSize = findProjectSkill() ? TURN_BATCH_SIZE : GENERAL_TURN_BATCH_SIZE
      if (userCount - lastAnalyzedCount < batchSize) {
        return false
      }

      lastAnalyzedCount = userCount
      return true
    },

    buildMessages(context) {
      const projectSkill = findProjectSkill()
      const newMessages = context.messages.slice(lastAnalyzedIndex)
      lastAnalyzedIndex = context.messages.length

      // Path A: skill execution — analyze corrections to the active skill
      if (projectSkill) {
        return [
          createUserMessage({
            content: `You are analyzing a conversation where a user is executing a skill (a repeatable process).
Your job: identify if the user's recent messages contain preferences, requests, or corrections that should be permanently added to the skill definition for future runs.

<skill_definition>
${projectSkill.content}
</skill_definition>

<recent_messages>
${formatRecentMessages(newMessages)}
</recent_messages>

Look for:
- Requests to add, change, or remove steps: "can you also ask me X", "please do Y too", "don't do Z"
- Preferences about how steps should work: "ask me about energy levels", "note the time", "use a casual tone"
- Corrections: "no, do X instead", "always use Y", "make sure to..."

Ignore:
- Routine conversation that doesn't generalize (one-time answers, chitchat)
- Things the skill already does

Output a JSON array inside <updates> tags. Each item: {"section": "which step/section to modify or 'new step'", "change": "what to add/modify", "reason": "which user message prompted this"}.
Output <updates>[]</updates> if no updates are needed.`,
          }),
        ]
      }

      // Path B: general conversation — extract reusable learnings
      return [
        createUserMessage({
          content: `Analyze the recent conversation below. Identify if the user expressed anything that should be permanently remembered for future sessions.

<recent_messages>
${formatRecentMessages(newMessages)}
</recent_messages>

Look for:
- Workflow preferences: "I always run tests before committing", "use pnpm not npm"
- Behavior corrections: "don't do that", "stop doing X", "always use Y"
- Coding style preferences: "use const not let", "prefer early returns"
- Repeated multi-step patterns that could become a reusable skill

Ignore:
- One-time task-specific instructions
- Routine conversation, chitchat
- Things that are obvious from the code itself

Output a JSON array inside <updates> tags. Each item: {"section": "memory" or "skill", "change": "what to remember or what skill to create", "reason": "which user message prompted this"}.
Output <updates>[]</updates> if nothing worth remembering.`,
        }),
      ]
    },

    systemPrompt:
      'You detect user preferences and process improvements during skill execution. Flag anything the user asks for that should be remembered for next time.',

    useTools: false,

    parseResponse(content) {
      const updatesStr = extractTag(content, 'updates')
      if (!updatesStr) {
        return []
      }
      try {
        return jsonParse(updatesStr) as SkillUpdate[]
      } catch {
        return []
      }
    },

    logResult(result, context) {
      if (result.type === 'success' && result.result.length > 0) {
        const projectSkill = findProjectSkill()

        if (projectSkill) {
          // Path A: active skill — show survey UI for user to approve changes
          const skillName = projectSkill.skillName ?? 'unknown'
          logEvent('tengu_skill_improvement_detected', {
            updateCount: result.result
              .length as AnalyticsMetadata_I_VERIFIED_THIS_IS_NOT_CODE_OR_FILEPATHS,
            uuid: result.uuid as AnalyticsMetadata_I_VERIFIED_THIS_IS_NOT_CODE_OR_FILEPATHS,
            _PROTO_skill_name:
              skillName as AnalyticsMetadata_I_VERIFIED_THIS_IS_PII_TAGGED,
          })

          context.toolUseContext.setAppState(prev => ({
            ...prev,
            skillImprovement: {
              suggestion: { skillName, updates: result.result },
            },
          }))
        } else {
          // Path B: general conversation — auto-write learnings to memory
          void autoWriteLearnings(result.result, context.toolUseContext.appendSystemMessage)
        }
      }
    },

    getModel: getSmallFastModel,
  }

  return createApiQueryHook(config)
}

export function initSkillImprovement(): void {
  if (
    feature('SKILL_IMPROVEMENT') &&
    getFeatureValue_CACHED_MAY_BE_STALE('tengu_copper_panda', false)
  ) {
    registerPostSamplingHook(createSkillImprovementHook())
  }
}

/**
 * Apply skill improvements by calling a side-channel LLM to rewrite the skill file.
 * Fire-and-forget — does not block the main conversation.
 */
export async function applySkillImprovement(
  skillName: string,
  updates: SkillUpdate[],
): Promise<void> {
  if (!skillName) return

  const { join } = await import('path')
  const fs = await import('fs/promises')

  // Skills live at .claude/skills/<name>/SKILL.md relative to CWD
  const filePath = join(getCwd(), '.legna', 'skills', skillName, 'SKILL.md')

  let currentContent: string
  try {
    currentContent = await fs.readFile(filePath, 'utf-8')
  } catch {
    logError(
      new Error(`Failed to read skill file for improvement: ${filePath}`),
    )
    return
  }

  const updateList = updates.map(u => `- ${u.section}: ${u.change}`).join('\n')

  const response = await queryModelWithoutStreaming({
    messages: [
      createUserMessage({
        content: `You are editing a skill definition file. Apply the following improvements to the skill.

<current_skill_file>
${currentContent}
</current_skill_file>

<improvements>
${updateList}
</improvements>

Rules:
- Integrate the improvements naturally into the existing structure
- Preserve frontmatter (--- block) exactly as-is
- Preserve the overall format and style
- Do not remove existing content unless an improvement explicitly replaces it
- Output the complete updated file inside <updated_file> tags`,
      }),
    ],
    systemPrompt: asSystemPrompt([
      'You edit skill definition files to incorporate user preferences. Output only the updated file content.',
    ]),
    thinkingConfig: { type: 'disabled' as const },
    tools: [],
    signal: createAbortController().signal,
    options: {
      getToolPermissionContext: async () => getEmptyToolPermissionContext(),
      model: getSmallFastModel(),
      toolChoice: undefined,
      isNonInteractiveSession: false,
      hasAppendSystemPrompt: false,
      temperatureOverride: 0,
      agents: [],
      querySource: 'skill_improvement_apply',
      mcpTools: [],
    },
  })

  const responseText = extractTextContent(response.message.content).trim()

  const updatedContent = extractTag(responseText, 'updated_file')
  if (!updatedContent) {
    logError(
      new Error('Skill improvement apply: no updated_file tag in response'),
    )
    return
  }

  try {
    // Version backup: save current content before overwriting
    const { dirname } = await import('path')
    const versionsDir = join(dirname(filePath), '.versions')
    await fs.mkdir(versionsDir, { recursive: true })
    const version = Date.now()
    await fs.writeFile(join(versionsDir, `${version}.md`), currentContent, 'utf-8')

    // Append to changelog
    const changelogPath = join(versionsDir, 'changelog.json')
    let changelog: Array<{ version: number; timestamp: string; updates: SkillUpdate[] }> = []
    try {
      changelog = JSON.parse(await fs.readFile(changelogPath, 'utf-8'))
    } catch { /* first version */ }
    changelog.push({ version, timestamp: new Date().toISOString(), updates })
    // Keep last 20 versions
    if (changelog.length > 20) changelog = changelog.slice(-20)
    await fs.writeFile(changelogPath, JSON.stringify(changelog, null, 2), 'utf-8')

    await fs.writeFile(filePath, updatedContent, 'utf-8')
  } catch (e) {
    logError(toError(e))
  }
}

/**
 * Path B: auto-write learnings from general conversation to memory files.
 * No user confirmation needed — these are lightweight observations.
 */
async function autoWriteLearnings(
  updates: SkillUpdate[],
  appendSystemMessage?: (text: string, style?: string) => void,
): Promise<void> {
  if (updates.length === 0) return

  try {
    const { join } = await import('path')
    const fs = await import('fs/promises')
    const { getAutoMemPath } = await import('../../memdir/paths.js')
    const { tickCorrection } = await import('../../services/hermes/nudgeSystem.js')

    const memoryDir = getAutoMemPath()
    await fs.mkdir(memoryDir, { recursive: true })

    let writtenCount = 0
    for (const update of updates) {
      const section = (update as any).section as string
      const change = update.change
      const reason = update.reason

      if (!change || change.length < 10) continue

      const slug = change.slice(0, 40).replace(/[^a-zA-Z0-9]+/g, '-').replace(/-+$/, '').toLowerCase()
      const timestamp = new Date().toISOString().slice(0, 10)
      const type = section === 'skill' ? 'project' : 'feedback'
      const fileName = `${type}_${slug}_${timestamp}.md`
      const filePath = join(memoryDir, fileName)

      // Don't overwrite existing memories
      try {
        await fs.access(filePath)
        continue
      } catch { /* doesn't exist — good */ }

      const content = `---
name: ${change.slice(0, 60)}
description: Auto-learned from conversation
type: ${type}
---

${change}

**Why:** ${reason || 'Detected from user conversation pattern'}
**How to apply:** Apply this in future sessions when relevant context matches.
`
      await fs.writeFile(filePath, content, 'utf-8')
      writtenCount++

      // Track corrections for nudge system
      if (type === 'feedback') {
        tickCorrection()
      }

      logForDebugging(`[skillImprovement] Auto-wrote learning: ${fileName}`)
    }

    if (writtenCount > 0 && appendSystemMessage) {
      appendSystemMessage(
        `Auto-learned ${writtenCount} insight${writtenCount > 1 ? 's' : ''} from this conversation.`,
        'suggestion',
      )
    }
  } catch (e) {
    logError(toError(e))
  }
}
