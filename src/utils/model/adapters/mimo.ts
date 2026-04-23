/**
 * Xiaomi MiMo model adapter.
 *
 * MiMo provides an Anthropic-compatible API at api.xiaomimimo.com/anthropic.
 * Differences from standard Anthropic API:
 *
 * 1. thinking: only { type: "enabled" | "disabled" } — no budget_tokens/adaptive
 * 2. tool_choice: only supports "auto" — strip "any"/"tool" modes
 * 3. tools.type: must be "custom" (Anthropic doesn't require this field)
 * 4. betas: not supported — strip entirely
 * 5. top_p: supported — inject default 0.95
 * 6. temperature: range [0, 1.5] vs Anthropic's [0, 1] (no clamping needed)
 * 7. metadata/speed/output_config/context_management: not supported — strip
 * 8. cache_control: server-side auto caching (response includes cache_read_input_tokens) — keep
 * 9. Response: thinking block may appear after text block — reorder
 * 10. stop_reason: extra values content_filter/repetition_truncation
 *     - content_filter: content safety filter triggered, output truncated
 *     - repetition_truncation: repetition detected, output truncated
 *
 * Models: mimo-v2-pro (1M ctx), mimo-v2-omni, mimo-v2-flash (262K ctx)
 */

import type { ModelAdapter } from './index.js'
import {
  simplifyThinking,
  forceAutoToolChoice,
  normalizeToolsKeepCache,
  stripBetas,
  injectTopP,
  stripUnsupportedFields,
  reorderThinkingBlocks,
} from './shared.js'

const MIMO_MODELS = ['mimo-v2-pro', 'mimo-v2-omni', 'mimo-v2-flash']
const MIMO_HOST = 'api.xiaomimimo.com'

export const MiMoAdapter: ModelAdapter = {
  name: 'MiMo (Xiaomi)',

  match(model: string, baseUrl?: string): boolean {
    if (MIMO_MODELS.some(m => model.startsWith(m))) return true
    if (baseUrl) {
      try { return new URL(baseUrl).host === MIMO_HOST } catch {}
    }
    return false
  },

  transformParams(params: Record<string, any>): Record<string, any> {
    const out = { ...params }
    simplifyThinking(out)
    forceAutoToolChoice(out)
    normalizeToolsKeepCache(out)
    stripBetas(out)
    injectTopP(out, 0.95)
    stripUnsupportedFields(out)
    return out
  },

  transformResponse(content: any[]): any[] | null {
    return reorderThinkingBlocks(content)
  },

  getStopReasonMessage(stopReason: string): string | undefined {
    if (stopReason === 'content_filter') {
      return 'The response was truncated by MiMo\'s content safety filter. Try rephrasing your request.'
    }
    if (stopReason === 'repetition_truncation') {
      return 'The response was truncated because MiMo detected repetitive output.'
    }
    return undefined
  },
}
