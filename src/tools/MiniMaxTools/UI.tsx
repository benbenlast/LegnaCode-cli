// Shared UI rendering for all MiniMax tools.
import React from 'react'
import { MessageResponse } from 'src/components/MessageResponse.js'
import { FallbackToolUseErrorMessage } from '../../components/FallbackToolUseErrorMessage.js'
import type { ToolResultBlockParam } from '@anthropic-ai/sdk/resources/index.mjs'
import { Text } from '../../ink.js'

/**
 * Generic render for MiniMax tool use messages.
 * Shows the tool action and key parameter.
 */
export function renderMiniMaxToolUse(
  action: string,
  detail: string | undefined,
): React.ReactNode {
  if (!detail) return action
  return `${action}: "${detail}"`
}

/**
 * Generic render for MiniMax tool result messages.
 */
export function renderMiniMaxToolResult(
  output: { result: string },
  { verbose }: { verbose: boolean },
): React.ReactNode {
  const text = output.result
  if (!text) return null
  const display = verbose ? text : text.length > 200 ? text.slice(0, 200) + '...' : text
  return <MessageResponse><Text>{display}</Text></MessageResponse>
}

/**
 * Generic error render for MiniMax tools.
 */
export function renderMiniMaxToolError(
  result: ToolResultBlockParam['content'],
  { verbose }: { verbose: boolean },
): React.ReactNode {
  return <FallbackToolUseErrorMessage result={result} verbose={verbose} />
}
