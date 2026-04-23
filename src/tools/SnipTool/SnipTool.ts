import { z } from 'zod/v4'
import { buildTool, type ToolDef } from '../../Tool.js'
import { lazySchema } from '../../utils/lazySchema.js'
import { SNIP_TOOL_NAME, SNIP_TOOL_PROMPT } from './prompt.js'
import { snipCompactIfNeeded } from '../../services/compact/snipCompact.js'

const inputSchema = lazySchema(() =>
  z.strictObject({
    message_ids: z
      .array(z.string())
      .optional()
      .describe('Specific message IDs to snip from context'),
    range: z
      .object({
        from: z.string().describe('Start message ID of the range to snip'),
        to: z.string().describe('End message ID of the range to snip'),
      })
      .optional()
      .describe('A range of messages to snip, specified by start and end IDs'),
  }),
)
type InputSchema = ReturnType<typeof inputSchema>

type Output = {
  snippedCount: number
  tokensFreed: number
  message: string
}

export const SnipTool = buildTool({
  name: SNIP_TOOL_NAME,
  searchHint: 'remove old messages free context window',
  maxResultSizeChars: 10_000,
  shouldDefer: true,
  isReadOnly() {
    return false
  },
  isEnabled() {
    return true
  },
  get inputSchema(): InputSchema {
    return inputSchema()
  },
  async description() {
    return SNIP_TOOL_PROMPT
  },
  async prompt() {
    return SNIP_TOOL_PROMPT
  },
  renderToolUseMessage(input) {
    const parts: string[] = ['Snipping messages']
    if (input.message_ids?.length) {
      parts.push(`(${input.message_ids.length} specific messages)`)
    } else if (input.range) {
      parts.push(`(range: ${input.range.from} to ${input.range.to})`)
    } else {
      parts.push('(auto-select old messages)')
    }
    return parts.join(' ')
  },
  mapToolResultToToolResultBlockParam(output: Output, toolUseID: string) {
    return {
      tool_use_id: toolUseID,
      type: 'tool_result' as const,
      content: output.message,
    }
  },
  async call(input, context) {
    const { messages } = context
    const result = snipCompactIfNeeded(messages, { force: true })

    if (!result.executed) {
      return {
        data: {
          snippedCount: 0,
          tokensFreed: 0,
          message: 'No messages available to snip.',
        },
      }
    }

    // Inject the boundary message into the context
    const newMessages = result.boundaryMessage
      ? [result.boundaryMessage]
      : undefined

    return {
      data: {
        snippedCount: result.boundaryMessage
          ? ((result.boundaryMessage as Record<string, unknown>)
              .snipMetadata as { removedCount: number })?.removedCount ?? 0
          : 0,
        tokensFreed: result.tokensFreed,
        message: `Snipped ${result.tokensFreed} estimated tokens from context.`,
      },
      ...(newMessages ? { newMessages } : {}),
    }
  },
} satisfies ToolDef<InputSchema, Output>)
