/**
 * Skill Auto-Create — detect repeated patterns and automatically create skills.
 *
 * Inspired by Hermes Agent's self-improving tool creation.
 * Tracks tool call sequences within a session. When similar multi-step
 * patterns repeat, automatically generates a SKILL.md via side-channel LLM
 * and writes it to disk. Notifies the user after the fact.
 */

import { logForDebugging } from '../utils/debug.js'
import { logError } from '../utils/log.js'
import { toError } from '../utils/errors.js'

interface ToolCallRecord {
  toolName: string
  timestamp: number
}

export interface PatternMatch {
  sequence: string[]
  count: number
  lastSeen: number
}

const MIN_SEQUENCE_LENGTH = 2
const MIN_REPEAT_COUNT = 3 // require 3 repeats before auto-creating (conservative)
const SEQUENCE_WINDOW_MS = 5 * 60 * 1000 // 5 minutes

// Track what we've already auto-created or dismissed
const createdSkillKeys = new Set<string>()
let autoCreateInProgress = false

/**
 * Tracks tool call sequences and detects repeated patterns.
 */
export class SkillPatternDetector {
  private history: ToolCallRecord[] = []
  private patterns = new Map<string, PatternMatch>()

  /**
   * Record a tool call.
   */
  record(toolName: string): void {
    this.history.push({ toolName, timestamp: Date.now() })
    // Keep only recent history
    const cutoff = Date.now() - SEQUENCE_WINDOW_MS
    this.history = this.history.filter(r => r.timestamp > cutoff)
    this.detectPatterns()
  }

  /**
   * Get patterns eligible for auto-creation.
   * Excludes already-created patterns.
   */
  getSuggestablePatterns(): PatternMatch[] {
    return [...this.patterns.values()].filter(
      p => p.count >= MIN_REPEAT_COUNT
        && p.sequence.length >= MIN_SEQUENCE_LENGTH
        && !createdSkillKeys.has(p.sequence.join(' → ')),
    )
  }

  private detectPatterns(): void {
    const names = this.history.map(r => r.toolName)
    // Sliding window: check subsequences of length 2-5
    for (let len = MIN_SEQUENCE_LENGTH; len <= Math.min(5, names.length); len++) {
      for (let i = 0; i <= names.length - len; i++) {
        const seq = names.slice(i, i + len)
        const key = seq.join(' → ')
        const existing = this.patterns.get(key)
        if (existing) {
          // Only count if not overlapping with last detection
          if (Date.now() - existing.lastSeen > 10_000) {
            existing.count++
            existing.lastSeen = Date.now()
          }
        } else {
          this.patterns.set(key, { sequence: seq, count: 1, lastSeen: Date.now() })
        }
      }
    }
  }

  /**
   * Generate a skill suggestion message for the user.
   */
  getSuggestionMessage(): string | null {
    const patterns = this.getSuggestablePatterns()
    if (patterns.length === 0) return null

    const top = patterns.sort((a, b) => b.count - a.count)[0]!
    logForDebugging(
      `[skillAutoCreate] Detected repeated pattern: ${top.sequence.join(' → ')} (${top.count}x)`,
    )
    return `Detected repeated tool pattern: ${top.sequence.join(' → ')} (used ${top.count} times). Consider saving this as a skill with /skill create.`
  }

  /**
   * Get the top suggestable pattern (highest repeat count).
   */
  getTopPattern(): PatternMatch | null {
    const patterns = this.getSuggestablePatterns()
    if (patterns.length === 0) return null
    return patterns.sort((a, b) => b.count - a.count)[0]!
  }
}

// Singleton instance
export const skillPatternDetector = new SkillPatternDetector()

/**
 * Check for repeated patterns and automatically create skills.
 * Called from stopHooks after each completed turn. Fire-and-forget.
 *
 * Flow: detect pattern → LLM generates SKILL.md → write to disk → notify user.
 */
export async function autoCreateSkillFromPatterns(
  appendSystemMessage: (text: string, style?: string) => void,
): Promise<void> {
  if (autoCreateInProgress) return

  const pattern = skillPatternDetector.getTopPattern()
  if (!pattern) return

  const key = pattern.sequence.join(' → ')
  if (createdSkillKeys.has(key)) return

  // Mark immediately to prevent duplicate creation
  createdSkillKeys.add(key)
  autoCreateInProgress = true

  try {
    const { join } = await import('path')
    const fs = await import('fs/promises')
    const { getCwd } = await import('../utils/cwd.js')
    const { queryModelWithoutStreaming } = await import('./api/claude.js')
    const { createUserMessage, extractTag, extractTextContent } = await import('../utils/messages.js')
    const { asSystemPrompt } = await import('../utils/systemPromptType.js')
    const { getSmallFastModel } = await import('../utils/model/model.js')
    const { createAbortController } = await import('../utils/abortController.js')
    const { getEmptyToolPermissionContext } = await import('../Tool.js')

    const sequenceDesc = pattern.sequence.join(' → ')

    const response = await queryModelWithoutStreaming({
      messages: [
        createUserMessage({
          content: `A user has been repeatedly executing this tool sequence: ${sequenceDesc} (${pattern.count} times).

Generate a reusable skill definition (SKILL.md) that captures this workflow.

Requirements:
- The skill name should be a short, descriptive kebab-case identifier (e.g., "read-edit-test")
- Include YAML frontmatter with: name, description, user-invocable: true
- The body should describe the steps clearly so an AI assistant can replay them
- Keep it concise — under 30 lines total

Output the skill name inside <skill_name> tags and the complete SKILL.md content inside <skill_content> tags.`,
        }),
      ],
      systemPrompt: asSystemPrompt([
        'You generate reusable skill definitions from observed tool usage patterns. Output only the requested tags.',
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
        querySource: 'skill_auto_create',
        mcpTools: [],
      },
    })

    const responseText = extractTextContent(response.message.content).trim()
    const skillName = extractTag(responseText, 'skill_name')?.trim()
    const skillContent = extractTag(responseText, 'skill_content')?.trim()

    if (!skillName || !skillContent) {
      logForDebugging('[skillAutoCreate] LLM did not return valid skill_name/skill_content tags')
      return
    }

    // Write SKILL.md
    const skillDir = join(getCwd(), '.legna', 'skills', skillName)
    await fs.mkdir(skillDir, { recursive: true })
    const skillPath = join(skillDir, 'SKILL.md')

    // Don't overwrite existing skills
    try {
      await fs.access(skillPath)
      logForDebugging(`[skillAutoCreate] Skill already exists at ${skillPath}, skipping`)
      return
    } catch { /* file doesn't exist — good */ }

    await fs.writeFile(skillPath, skillContent, 'utf-8')

    appendSystemMessage(
      `Auto-created skill "${skillName}" from repeated pattern: ${sequenceDesc} (${pattern.count}x). Saved to .legna/skills/${skillName}/SKILL.md`,
      'suggestion',
    )
    logForDebugging(`[skillAutoCreate] Auto-created skill: ${skillName}`)
  } catch (e) {
    logError(toError(e))
    // Allow retry on next turn
    createdSkillKeys.delete(key)
  } finally {
    autoCreateInProgress = false
  }
}
