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
import { applyStandardTransforms, reorderThinkingBlocks } from './shared.js'

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
    return applyStandardTransforms(params, 0.95)
  },

  transformResponse(content: any[]): any[] | null {
    return reorderThinkingBlocks(content)
  },
}
