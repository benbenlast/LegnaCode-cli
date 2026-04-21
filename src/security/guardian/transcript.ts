/**
 * Compact transcript builder for Guardian context.
 *
 * Compresses the full conversation history into a concise summary
 * suitable for the Guardian model (<2000 tokens target).
 */

import type { Message } from '../../types/message.js'

/** Maximum character budget for the compact transcript. */
const MAX_CHARS = 6000 // ~2000 tokens at ~3 chars/token

/**
 * Build a compact transcript from conversation messages.
 *
 * Keeps: user instruction summaries, tool call names + key params,
 * tool result summaries. Drops: full file contents, verbose output,
 * repeated system messages.
 */
export function buildCompactTranscript(
  messages: readonly Message[],
  maxChars: number = MAX_CHARS,
): string {
  const lines: string[] = []
  let budget = maxChars

  for (const msg of messages) {
    if (budget <= 0) break

    const line = summarizeMessage(msg)
    if (!line) continue

    if (line.length <= budget) {
      lines.push(line)
      budget -= line.length + 1 // +1 for newline
    } else {
      // Truncate last entry to fit
      lines.push(line.slice(0, budget) + '...')
      break
    }
  }

  return lines.join('\n')
}

function summarizeMessage(msg: Message): string | null {
  switch (msg.type) {
    case 'user': {
      const text = extractTextContent(msg)
      if (!text) return null
      const truncated = text.length > 200 ? text.slice(0, 200) + '...' : text
      return `[USER] ${truncated}`
    }

    case 'assistant': {
      const parts: string[] = []
      if (!Array.isArray(msg.content)) return null

      for (const block of msg.content) {
        if (typeof block === 'string') {
          const t = block.length > 150 ? block.slice(0, 150) + '...' : block
          parts.push(t)
        } else if (block.type === 'text') {
          const t = block.text.length > 150 ? block.text.slice(0, 150) + '...' : block.text
          parts.push(t)
        } else if (block.type === 'tool_use') {
          const inputSummary = summarizeToolInput(block.name, block.input as Record<string, unknown>)
          parts.push(`[TOOL_CALL] ${block.name}(${inputSummary})`)
        }
      }

      return parts.length > 0 ? `[ASSISTANT] ${parts.join(' | ')}` : null
    }

    case 'tool_result': {
      // Summarize tool results very briefly
      const text = extractTextContent(msg)
      if (!text) return null
      const truncated = text.length > 100 ? text.slice(0, 100) + '...' : text
      return `[TOOL_RESULT] ${truncated}`
    }

    default:
      return null
  }
}

function extractTextContent(msg: Message): string | null {
  if (typeof msg.content === 'string') return msg.content
  if (!Array.isArray(msg.content)) return null

  const texts: string[] = []
  for (const block of msg.content) {
    if (typeof block === 'string') texts.push(block)
    else if ('text' in block && typeof block.text === 'string') texts.push(block.text)
  }
  return texts.length > 0 ? texts.join(' ') : null
}

function summarizeToolInput(toolName: string, input: Record<string, unknown>): string {
  switch (toolName) {
    case 'Bash':
    case 'bash': {
      const cmd = typeof input.command === 'string' ? input.command : ''
      return cmd.length > 80 ? cmd.slice(0, 80) + '...' : cmd
    }
    case 'Write':
    case 'Edit': {
      const fp = typeof input.file_path === 'string' ? input.file_path : '?'
      return fp
    }
    case 'Read': {
      const fp = typeof input.file_path === 'string' ? input.file_path : '?'
      return fp
    }
    case 'Glob':
      return typeof input.pattern === 'string' ? input.pattern : '?'
    case 'Grep':
      return typeof input.pattern === 'string' ? input.pattern : '?'
    default: {
      const keys = Object.keys(input).slice(0, 3).join(', ')
      return keys || '(empty)'
    }
  }
}
