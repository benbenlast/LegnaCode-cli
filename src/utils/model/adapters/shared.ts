/**
 * Shared transformation utilities for third-party model adapters.
 *
 * Most Anthropic-compatible providers (MiMo, GLM, etc.) share the same
 * set of incompatibilities. These functions handle the common cases so
 * each adapter only needs to declare its match logic and any provider-
 * specific overrides.
 */

/** Simplify thinking to { type: "enabled" | "disabled" } — no budget_tokens/adaptive */
export function simplifyThinking(params: Record<string, any>): void {
  if (!params.thinking) return
  if (params.thinking.type === 'adaptive' || params.thinking.type === 'enabled') {
    params.thinking = { type: 'enabled' }
  } else {
    params.thinking = { type: 'disabled' }
  }
}

/** Force tool_choice to "auto", stripping disable_parallel_tool_use (most providers ignore it) */
export function forceAutoToolChoice(params: Record<string, any>): void {
  if (!params.tool_choice || params.tool_choice.type === 'auto') {
    if (params.tool_choice?.disable_parallel_tool_use) {
      params.tool_choice = { type: 'auto' }
    }
    return
  }
  params.tool_choice = { type: 'auto' }
}

/** Add type:"custom" to tools and strip Anthropic-only extensions */
export function normalizeTools(params: Record<string, any>): void {
  if (!params.tools || !Array.isArray(params.tools)) return
  params.tools = params.tools.map((tool: any) => ({
    ...tool,
    type: 'custom',
    strict: undefined,
    defer_loading: undefined,
    eager_input_streaming: undefined,
    cache_control: undefined,
  }))
}

/** Like normalizeTools but preserves cache_control for providers that support it */
export function normalizeToolsKeepCache(params: Record<string, any>): void {
  if (!params.tools || !Array.isArray(params.tools)) return
  params.tools = params.tools.map((tool: any) => ({
    ...tool,
    type: 'custom',
    strict: undefined,
    defer_loading: undefined,
    eager_input_streaming: undefined,
  }))
}

/** Strip beta headers */
export function stripBetas(params: Record<string, any>): void {
  delete params.betas
}

/** Strip Anthropic-only body fields */
export function stripUnsupportedFields(params: Record<string, any>): void {
  delete params.metadata
  delete params.speed
  // Preserve output_config.effort if present (some providers support it)
  if (params.output_config) {
    const effort = params.output_config.effort
    if (effort) {
      params.output_config = { effort }
    } else {
      delete params.output_config
    }
  }
  delete params.context_management
}

/** Strip Anthropic-only body fields, but keep metadata (for providers that support it) */
export function stripUnsupportedFieldsKeepMetadata(params: Record<string, any>): void {
  delete params.speed
  delete params.output_config
  delete params.context_management
}

/** Inject top_p default if not already set */
export function injectTopP(params: Record<string, any>, defaultValue = 0.95): void {
  if (params.top_p === undefined) params.top_p = defaultValue
}

/** Strip reasoning_content from assistant messages (DeepSeek Anthropic compat) */
export function stripReasoningContent(params: Record<string, any>): void {
  if (!params.messages || !Array.isArray(params.messages)) return
  params.messages = params.messages.map((msg: any) => {
    if (msg.role === 'assistant' && msg.reasoning_content !== undefined) {
      const { reasoning_content, ...rest } = msg
      return rest
    }
    return msg
  })
}

/** Strip sampling params that reasoner models ignore */
export function stripReasonerSamplingParams(params: Record<string, any>): void {
  delete params.temperature
  delete params.top_p
}

/** Content block types supported by most Anthropic-compatible providers */
const SUPPORTED_CONTENT_TYPES = new Set([
  'text', 'thinking', 'tool_use', 'tool_result',
])

/** Strip unsupported content block types from messages (image, document, server_tool_use, etc.) */
export function stripUnsupportedContentBlocks(params: Record<string, any>): void {
  if (!params.messages || !Array.isArray(params.messages)) return
  params.messages = params.messages.map((msg: any) => {
    if (!Array.isArray(msg.content)) return msg
    const filtered = msg.content.filter((block: any) => {
      if (!block.type) return true
      if (block.type === 'redacted_thinking') return false
      return SUPPORTED_CONTENT_TYPES.has(block.type)
    })
    if (filtered.length === 0) return { ...msg, content: '' }
    return { ...msg, content: filtered }
  })
}

/** Strip cache_control from system and message content blocks */
export function stripCacheControl(params: Record<string, any>): void {
  if (params.system && Array.isArray(params.system)) {
    params.system = params.system.map((block: any) => {
      if (block.cache_control) {
        const { cache_control, ...rest } = block
        return rest
      }
      return block
    })
  }
  if (params.messages && Array.isArray(params.messages)) {
    params.messages = params.messages.map((msg: any) => {
      if (!Array.isArray(msg.content)) return msg
      return {
        ...msg,
        content: msg.content.map((block: any) => {
          if (block.cache_control) {
            const { cache_control, ...rest } = block
            return rest
          }
          return block
        }),
      }
    })
  }
}

/** Reorder thinking blocks before text blocks in response content */
export function reorderThinkingBlocks(content: any[]): any[] | null {
  if (!content || content.length < 2) return null
  const thinking: any[] = []
  const other: any[] = []
  for (const block of content) {
    if (block.type === 'thinking') thinking.push(block)
    else other.push(block)
  }
  if (thinking.length === 0) return null
  // Check if already in correct order
  const firstThinkingIdx = content.findIndex(b => b.type === 'thinking')
  if (!content.some((b, i) => b.type !== 'thinking' && i < firstThinkingIdx)) return null
  return [...thinking, ...other]
}

/**
 * Apply all standard transformations for a typical Anthropic-compatible provider.
 * Call this from your adapter's transformParams, then apply any provider-specific tweaks.
 */
export function applyStandardTransforms(params: Record<string, any>, topP = 0.95): Record<string, any> {
  const out = { ...params }
  simplifyThinking(out)
  forceAutoToolChoice(out)
  normalizeTools(out)
  stripBetas(out)
  injectTopP(out, topP)
  stripUnsupportedFields(out)
  stripCacheControl(out)
  stripUnsupportedContentBlocks(out)
  return out
}
