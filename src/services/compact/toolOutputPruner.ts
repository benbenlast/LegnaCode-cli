/**
 * Tool Output Pruner — pre-prune large tool outputs before context compaction.
 *
 * Strategy: truncate oversized tool results (file contents, grep output)
 * to a summary + head/tail, preserving the most useful information.
 */

import { logForDebugging } from '../utils/debug.js'

const MAX_TOOL_OUTPUT_CHARS = 8_000
const HEAD_CHARS = 3_000
const TAIL_CHARS = 2_000

/**
 * Prune a tool result string if it exceeds the threshold.
 * Returns the original string if within limits.
 */
export function pruneToolOutput(
  toolName: string,
  output: string,
): string {
  if (output.length <= MAX_TOOL_OUTPUT_CHARS) return output

  const originalLen = output.length
  const head = output.slice(0, HEAD_CHARS)
  const tail = output.slice(-TAIL_CHARS)
  const omitted = originalLen - HEAD_CHARS - TAIL_CHARS

  logForDebugging(
    `[toolOutputPruner] Pruned ${toolName} output: ${originalLen} → ${HEAD_CHARS + TAIL_CHARS} chars (omitted ${omitted})`,
  )

  return `${head}\n\n[... ${omitted} characters omitted for context efficiency ...]\n\n${tail}`
}

/**
 * Prune tool outputs in a message content array.
 * Operates on tool_result content blocks.
 */
export function pruneMessageToolOutputs(
  content: Array<{ type: string; content?: string; [k: string]: unknown }>,
): Array<{ type: string; content?: string; [k: string]: unknown }> {
  return content.map(block => {
    if (block.type === 'tool_result' && typeof block.content === 'string') {
      return { ...block, content: pruneToolOutput('tool_result', block.content) }
    }
    return block
  })
}
