/**
 * Xiaomi MiMo model adapter.
 *
 * MiMo provides an Anthropic-compatible API at api.xiaomimimo.com/anthropic
 * with several differences that need adaptation:
 *
 * 1. thinking: no budget_tokens — only { type: "enabled" | "disabled" }
 * 2. tool_choice: only supports "auto" — strip "any"/"tool" modes
 * 3. tools.type: must be "custom" (Anthropic doesn't require this field)
 * 4. betas: not supported — strip entirely
 * 5. top_p: supported (Anthropic doesn't) — inject default 0.95
 * 6. temperature range: [0, 1.5] vs Anthropic's [0, 1]
 * 7. metadata/speed/output_config/context_management: not supported — strip
 * 8. Response: thinking block may appear after text block — reorder
 * 9. stop_reason: extra values content_filter/repetition_truncation
 */

import type { ModelAdapter } from './index.js'

const MIMO_MODELS = ['mimo-v2-pro', 'mimo-v2-omni', 'mimo-v2-flash']
const MIMO_HOST = 'api.xiaomimimo.com'

export const MiMoAdapter: ModelAdapter = {
  name: 'MiMo (Xiaomi)',

  match(model: string, baseUrl?: string): boolean {
    // Match by model name prefix
    if (MIMO_MODELS.some(m => model.startsWith(m))) return true
    // Match by base URL
    if (baseUrl) {
      try { return new URL(baseUrl).host === MIMO_HOST } catch {}
    }
    return false
  },

  transformParams(params: Record<string, any>): Record<string, any> {
    const out = { ...params }

    // 1. Simplify thinking — MiMo doesn't support budget_tokens or adaptive
    if (out.thinking) {
      if (out.thinking.type === 'adaptive' || out.thinking.type === 'enabled') {
        out.thinking = { type: 'enabled' }
      } else {
        out.thinking = { type: 'disabled' }
      }
    }

    // 2. tool_choice — MiMo only supports "auto", strip forced modes
    if (out.tool_choice && out.tool_choice.type !== 'auto') {
      out.tool_choice = { type: 'auto' }
      // Preserve disable_parallel_tool_use if set
      if (params.tool_choice?.disable_parallel_tool_use) {
        out.tool_choice.disable_parallel_tool_use = true
      }
    }

    // 3. tools — add type: "custom" to each tool definition
    if (out.tools && Array.isArray(out.tools)) {
      out.tools = out.tools.map((tool: any) => ({
        ...tool,
        type: 'custom',
        // Strip Anthropic-specific extensions MiMo doesn't understand
        strict: undefined,
        defer_loading: undefined,
        eager_input_streaming: undefined,
        cache_control: undefined,
      }))
    }

    // 4. Strip betas — MiMo doesn't support beta headers
    delete out.betas

    // 5. Add top_p if not present
    if (out.top_p === undefined) {
      out.top_p = 0.95
    }

    // 6. Strip Anthropic-specific fields MiMo doesn't support
    delete out.metadata
    delete out.speed
    delete out.output_config
    delete out.context_management

    // 7. Strip cache_control from system blocks
    if (out.system && Array.isArray(out.system)) {
      out.system = out.system.map((block: any) => {
        if (block.cache_control) {
          const { cache_control, ...rest } = block
          return rest
        }
        return block
      })
    }

    // 8. Strip cache_control from message content blocks
    if (out.messages && Array.isArray(out.messages)) {
      out.messages = out.messages.map((msg: any) => {
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

    return out
  },

  transformResponse(content: any[]): any[] | null {
    // MiMo may return thinking blocks after text blocks.
    // Anthropic SDK expects thinking before text. Reorder if needed.
    if (!content || content.length < 2) return null

    const thinking: any[] = []
    const other: any[] = []

    for (const block of content) {
      if (block.type === 'thinking') {
        thinking.push(block)
      } else {
        other.push(block)
      }
    }

    // Only reorder if thinking blocks were out of order
    if (thinking.length === 0) return null
    const firstThinkingIdx = content.findIndex(b => b.type === 'thinking')
    const lastNonThinkingBeforeThinking = content.findIndex(
      (b, i) => b.type !== 'thinking' && i < firstThinkingIdx
    )
    // Already in correct order (thinking first)
    if (lastNonThinkingBeforeThinking === -1) return null

    return [...thinking, ...other]
  },
}
