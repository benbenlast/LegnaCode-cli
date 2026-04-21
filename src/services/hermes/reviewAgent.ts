/**
 * Background Review Agent — post-session experience extraction.
 *
 * Fires at the end of each turn (via stopHooks) when the session has
 * accumulated enough activity. Reviews the conversation for:
 *   1. Reusable patterns that could become skills
 *   2. Behavior corrections worth remembering
 *   3. Failure lessons to avoid next time
 *
 * Uses the same forked-agent pattern as autoDream — shares the parent's
 * prompt cache, runs in the background, writes to .legna/memory/.
 */

import type { REPLHookContext } from '../../utils/hooks/postSamplingHooks.js'
import type { ToolUseContext } from '../../Tool.js'
import {
  createCacheSafeParams,
  runForkedAgent,
} from '../../utils/forkedAgent.js'
import { createUserMessage } from '../../utils/messages.js'
import { logForDebugging } from '../../utils/debug.js'
import { isAutoMemoryEnabled, getAutoMemPath } from '../../memdir/paths.js'
import { createAutoMemCanUseTool } from '../extractMemories/extractMemories.js'
import { count } from '../../utils/array.js'
import { getIsRemoteMode } from '../../bootstrap/state.js'

// Gate thresholds
const MIN_USER_MESSAGES = 5
const MIN_TOOL_CALLS = 3
const MIN_MINUTES_BETWEEN_REVIEWS = 30

let lastReviewAt = 0
let inProgress = false

type AppendSystemMessageFn = NonNullable<ToolUseContext['appendSystemMessage']>

function isGateOpen(): boolean {
  if (getIsRemoteMode()) return false
  if (!isAutoMemoryEnabled()) return false
  return true
}

const REVIEW_PROMPT = `You are the experience review agent. Analyze the conversation above and answer three specific questions.

**1. Reusable Patterns**
Did the user repeat a multi-step operation that could be saved as a reusable skill?
If yes, describe the pattern: what tools were used, in what order, and what the goal was.

**2. Behavior Corrections**
Did the user correct the assistant's behavior? ("don't do that", "always use X", "stop doing Y")
If yes, extract each correction as a concise rule that should be remembered for future sessions.

**3. Failure Lessons**
Did the assistant fail at a task or take a wrong approach before succeeding?
If yes, describe what went wrong and what the correct approach turned out to be.

**Output format:**
For each finding, write it as a memory file using the Edit or Write tool.
- Corrections → write to feedback_*.md with type: feedback
- Patterns → write to project_*.md with type: project
- Lessons → write to project_*.md with type: project

Each file must have YAML frontmatter:
\`\`\`
---
name: <descriptive name>
description: <one-line summary>
type: <feedback|project>
---
<content>
\`\`\`

If this conversation has nothing worth extracting, say "No actionable insights" and stop.
Do NOT duplicate information that already exists in the memory directory.
Keep each file under 200 words. Be specific, not generic.

**Tool constraints:** Bash is read-only. You can only write to the memory directory.`

/**
 * Execute the review agent. Fire-and-forget from stopHooks.
 */
export async function executeReviewAgent(
  context: REPLHookContext,
  appendSystemMessage?: AppendSystemMessageFn,
): Promise<void> {
  if (!isGateOpen()) return
  if (inProgress) return

  // Gate: enough activity in this session
  const userMsgCount = count(context.messages, m => m.type === 'user')
  if (userMsgCount < MIN_USER_MESSAGES) return

  const toolCallCount = count(context.messages, m =>
    m.type === 'assistant' && Array.isArray(m.message?.content) &&
    m.message.content.some((b: any) => b.type === 'tool_use'),
  )
  if (toolCallCount < MIN_TOOL_CALLS) return

  // Gate: time throttle
  const minutesSince = (Date.now() - lastReviewAt) / 60_000
  if (minutesSince < MIN_MINUTES_BETWEEN_REVIEWS) return

  inProgress = true
  lastReviewAt = Date.now()

  try {
    const memoryRoot = getAutoMemPath()

    const result = await runForkedAgent({
      promptMessages: [createUserMessage({ content: REVIEW_PROMPT })],
      cacheSafeParams: createCacheSafeParams(context),
      canUseTool: createAutoMemCanUseTool(memoryRoot),
      querySource: 'hermes_review',
      forkLabel: 'hermes_review',
      skipTranscript: true,
      maxTurns: 5,
    })

    logForDebugging(
      `[reviewAgent] completed — output=${result.totalUsage.output_tokens} tokens`,
    )

    // Count files written by checking for Write/Edit tool uses in output
    const filesWritten = result.messages.filter(m =>
      m.type === 'assistant' && Array.isArray(m.message?.content) &&
      m.message.content.some((b: any) =>
        b.type === 'tool_use' && (b.name === 'Write' || b.name === 'Edit'),
      ),
    ).length

    if (appendSystemMessage && filesWritten > 0) {
      appendSystemMessage(
        `Review agent extracted ${filesWritten} experience insights to memory.`,
        'suggestion',
      )
    }
  } catch (e: unknown) {
    logForDebugging(`[reviewAgent] failed: ${(e as Error).message}`)
  } finally {
    inProgress = false
  }
}
