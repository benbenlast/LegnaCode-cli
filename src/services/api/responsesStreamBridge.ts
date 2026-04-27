/**
 * OpenAI Responses API Streaming Bridge
 *
 * Translates between Anthropic Messages API format and OpenAI Responses API
 * (/v1/responses). Used for Codex-compatible providers.
 *
 * Wire format reference: vendor/codex/codex-rs/protocol/src/models.rs
 * SSE events reference: vendor/codex/codex-rs/codex-api/src/sse/responses.rs
 */

import { randomUUID } from 'crypto'
import { logForDebugging } from '../../utils/debug.js'

// Lazy import to avoid circular dependency
let _getApiKey: (() => string | null) | undefined
function resolveApiKey(): string {
  if (!_getApiKey) {
    try {
      const auth = require('../../utils/auth.js')
      _getApiKey = auth.getAnthropicApiKey
    } catch {
      _getApiKey = () => null
    }
  }
  return _getApiKey!() || process.env.ANTHROPIC_API_KEY || process.env.ANTHROPIC_AUTH_TOKEN || ''
}

// ── SSE Parser ──────────────────────────────────────────────────────────────

interface SSEFrame {
  event: string
  data: string
}

async function* parseResponsesSSE(body: ReadableStream<Uint8Array>): AsyncGenerator<SSEFrame> {
  const reader = body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''

  try {
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      buffer += decoder.decode(value, { stream: true })
      const lines = buffer.split('\n')
      buffer = lines.pop() ?? ''

      let currentEvent = ''
      let currentData = ''

      for (const line of lines) {
        const trimmed = line.trim()
        if (trimmed.startsWith('event: ')) {
          currentEvent = trimmed.slice(7)
        } else if (trimmed.startsWith('data: ')) {
          currentData = trimmed.slice(6)
        } else if (trimmed === '' && currentData) {
          yield { event: currentEvent, data: currentData }
          currentEvent = ''
          currentData = ''
        }
      }
    }
  } finally {
    reader.releaseLock()
  }
}

// ── Anthropic → Responses API Request Conversion ────────────────────────────

function convertSystem(system: any): string {
  if (!system) return ''
  if (typeof system === 'string') return system
  if (Array.isArray(system)) {
    return system.filter((b: any) => b.type === 'text').map((b: any) => b.text).join('\n\n')
  }
  return ''
}

function convertMessagesToInput(messages: any[]): any[] {
  const input: any[] = []
  for (const msg of messages) {
    const { role, content } = msg
    if (typeof content === 'string') {
      input.push({
        type: 'message',
        role,
        content: [{ type: role === 'assistant' ? 'output_text' : 'input_text', text: content }],
      })
      continue
    }
    if (!Array.isArray(content)) continue

    // tool_result blocks → function_call_output items
    const toolResults = content.filter((b: any) => b.type === 'tool_result')
    if (toolResults.length > 0) {
      for (const tr of toolResults) {
        const output = typeof tr.content === 'string'
          ? tr.content
          : Array.isArray(tr.content)
            ? tr.content.filter((c: any) => c.type === 'text').map((c: any) => c.text).join('\n')
            : JSON.stringify(tr.content ?? '')
        input.push({ type: 'function_call_output', call_id: tr.tool_use_id, output })
      }
      continue
    }

    // assistant with tool_use → function_call items
    const toolUses = content.filter((b: any) => b.type === 'tool_use')
    const textParts = content.filter((b: any) => b.type === 'text').map((b: any) => b.text).join('')

    if (toolUses.length > 0 && role === 'assistant') {
      // Emit text message first if present
      if (textParts) {
        input.push({
          type: 'message', role: 'assistant',
          content: [{ type: 'output_text', text: textParts }],
        })
      }
      for (const tu of toolUses) {
        input.push({
          type: 'function_call',
          call_id: tu.id,
          name: tu.name,
          arguments: typeof tu.input === 'string' ? tu.input : JSON.stringify(tu.input ?? {}),
        })
      }
      continue
    }

    // Regular message
    const contentItems = content
      .filter((b: any) => b.type === 'text')
      .map((b: any) => ({
        type: role === 'assistant' ? 'output_text' : 'input_text',
        text: b.text,
      }))
    if (contentItems.length > 0) {
      input.push({ type: 'message', role, content: contentItems })
    }
  }
  return input
}
function convertTools(tools: any[]): any[] {
  if (!tools || !Array.isArray(tools)) return []
  return tools.map((tool: any) => ({
    type: 'function',
    name: tool.name,
    description: tool.description ?? '',
    strict: false,
    parameters: tool.input_schema ?? tool.parameters ?? { type: 'object', properties: {} },
  }))
}

function buildResponsesRequest(params: Record<string, any>): {
  url: string
  headers: Record<string, string>
  body: Record<string, any>
} {
  let baseUrl = process.env.ANTHROPIC_BASE_URL || 'http://localhost:11434/v1'
  baseUrl = baseUrl.replace(/\/+$/, '')
  // Ensure /v1 prefix for responses endpoint
  if (!baseUrl.endsWith('/v1')) baseUrl += '/v1'

  const apiKey = resolveApiKey()
  const instructions = convertSystem(params.system)
  const input = convertMessagesToInput(params.messages || [])
  const tools = convertTools(params.tools)

  const body: Record<string, any> = {
    model: params.model,
    input,
    stream: true,
    tool_choice: tools.length > 0 ? 'auto' : undefined,
    parallel_tool_calls: true,
    store: false,
  }

  if (instructions) body.instructions = instructions
  if (tools.length > 0) body.tools = tools

  return {
    url: `${baseUrl}/responses`,
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
      'Accept': 'text/event-stream',
    },
    body,
  }
}

// ── Streaming: Responses API → Anthropic Events ─────────────────────────────

export async function* responsesStreamingRequest(
  params: Record<string, any>,
  signal: AbortSignal,
): AsyncGenerator<any> {
  const { url, headers, body } = buildResponsesRequest(params)

  const response = await fetch(url, {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
    signal,
  })

  if (!response.ok) {
    const errorBody = await response.text()
    throw new Error(`Responses API error ${response.status}: ${errorBody}`)
  }

  if (!response.body) {
    throw new Error('Responses API returned no response body')
  }

  const messageId = `msg_${randomUUID().replace(/-/g, '').slice(0, 24)}`
  let contentBlockIndex = 0
  let textBlockOpen = false
  const toolCallBlocks = new Map<string, { id: string; name: string; blockIndex: number }>()
  let inputTokens = 0
  let outputTokens = 0

  // Emit message_start
  yield {
    type: 'message_start',
    message: {
      id: messageId, type: 'message', role: 'assistant', model: params.model,
      content: [], stop_reason: null, stop_sequence: null,
      usage: { input_tokens: 0, output_tokens: 0 },
    },
  }
  for await (const frame of parseResponsesSSE(response.body)) {
    let parsed: any
    try {
      parsed = JSON.parse(frame.data)
    } catch {
      continue
    }

    const eventType = parsed.type || frame.event

    switch (eventType) {
      case 'response.output_text.delta': {
        if (!textBlockOpen) {
          yield {
            type: 'content_block_start',
            index: contentBlockIndex,
            content_block: { type: 'text', text: '' },
          }
          textBlockOpen = true
        }
        yield {
          type: 'content_block_delta',
          index: contentBlockIndex,
          delta: { type: 'text_delta', text: parsed.delta || '' },
        }
        break
      }

      case 'response.output_item.added': {
        const item = parsed.item
        if (item?.type === 'function_call') {
          // Close text block if open
          if (textBlockOpen) {
            yield { type: 'content_block_stop', index: contentBlockIndex }
            textBlockOpen = false
            contentBlockIndex++
          }
          const blockIdx = contentBlockIndex
          toolCallBlocks.set(item.call_id || item.id, {
            id: item.call_id || item.id || `toolu_${randomUUID().replace(/-/g, '').slice(0, 20)}`,
            name: item.name || '',
            blockIndex: blockIdx,
          })
          yield {
            type: 'content_block_start',
            index: blockIdx,
            content_block: {
              type: 'tool_use',
              id: item.call_id || item.id,
              name: item.name || '',
              input: {},
            },
          }
          contentBlockIndex++
        }
        break
      }
      case 'response.function_call_arguments.delta': {
        const callId = parsed.call_id || parsed.item_id
        const block = toolCallBlocks.get(callId)
        if (block) {
          yield {
            type: 'content_block_delta',
            index: block.blockIndex,
            delta: { type: 'input_json_delta', partial_json: parsed.delta || '' },
          }
        }
        break
      }

      case 'response.output_item.done': {
        const item = parsed.item
        if (!item) break

        if (item.type === 'function_call') {
          const callId = item.call_id || item.id
          const block = toolCallBlocks.get(callId)
          if (block) {
            yield { type: 'content_block_stop', index: block.blockIndex }
          }
        } else if (item.type === 'message' && item.role === 'assistant') {
          // Non-streamed text output (rare but possible)
          const texts = (item.content || [])
            .filter((c: any) => c.type === 'output_text')
            .map((c: any) => c.text)
            .join('')
          if (texts && !textBlockOpen) {
            yield {
              type: 'content_block_start',
              index: contentBlockIndex,
              content_block: { type: 'text', text: '' },
            }
            yield {
              type: 'content_block_delta',
              index: contentBlockIndex,
              delta: { type: 'text_delta', text: texts },
            }
            yield { type: 'content_block_stop', index: contentBlockIndex }
            contentBlockIndex++
          }
        }
        break
      }

      case 'response.completed': {
        // Close any open text block
        if (textBlockOpen) {
          yield { type: 'content_block_stop', index: contentBlockIndex }
          textBlockOpen = false
        }

        const usage = parsed.response?.usage
        if (usage) {
          inputTokens = usage.input_tokens ?? 0
          outputTokens = usage.output_tokens ?? 0
        }

        const hasToolUse = toolCallBlocks.size > 0
        yield {
          type: 'message_delta',
          delta: {
            stop_reason: hasToolUse ? 'tool_use' : 'end_turn',
            stop_sequence: null,
          },
          usage: { output_tokens: outputTokens },
        }
        yield { type: 'message_stop' }
        break
      }

      case 'response.failed': {
        const error = parsed.response?.error
        throw new Error(`Responses API failed: ${error?.message || JSON.stringify(error)}`)
      }

      case 'response.incomplete': {
        const reason = parsed.response?.incomplete_details?.reason
        // Close open blocks gracefully
        if (textBlockOpen) {
          yield { type: 'content_block_stop', index: contentBlockIndex }
        }
        yield {
          type: 'message_delta',
          delta: { stop_reason: 'max_tokens', stop_sequence: null },
          usage: { output_tokens: outputTokens },
        }
        yield { type: 'message_stop' }
        break
      }

      default:
        // Silently ignore unhandled events (response.created, reasoning deltas, etc.)
        break
    }
  }
}

// ── Non-Streaming Request ───────────────────────────────────────────────────

export async function responsesNonStreamingRequest(
  params: Record<string, any>,
  signal: AbortSignal,
): Promise<any> {
  const { url, headers, body } = buildResponsesRequest(params)
  body.stream = false

  const response = await fetch(url, {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
    signal,
  })

  if (!response.ok) {
    const errorBody = await response.text()
    throw new Error(`Responses API error ${response.status}: ${errorBody}`)
  }

  const data = await response.json() as any
  const content: any[] = []

  for (const item of (data.output || [])) {
    if (item.type === 'message' && item.role === 'assistant') {
      for (const c of (item.content || [])) {
        if (c.type === 'output_text') {
          content.push({ type: 'text', text: c.text })
        }
      }
    } else if (item.type === 'function_call') {
      let parsedInput: any = {}
      try { parsedInput = JSON.parse(item.arguments || '{}') } catch {}
      content.push({
        type: 'tool_use',
        id: item.call_id || item.id,
        name: item.name,
        input: parsedInput,
      })
    }
  }

  const hasToolUse = content.some(c => c.type === 'tool_use')
  return {
    id: `msg_${(data.id ?? randomUUID()).replace(/-/g, '').slice(0, 24)}`,
    type: 'message',
    role: 'assistant',
    model: params.model,
    content,
    stop_reason: hasToolUse ? 'tool_use' : 'end_turn',
    stop_sequence: null,
    usage: {
      input_tokens: data.usage?.input_tokens ?? 0,
      output_tokens: data.usage?.output_tokens ?? 0,
    },
  }
}
