/**
 * MiniMax model adapter.
 *
 * MiniMax provides Anthropic-compatible endpoints:
 *   - China:  https://api.minimaxi.com/anthropic
 *   - Global: https://api.minimax.io/anthropic
 *
 * Differences from standard Anthropic API:
 *
 * 1. thinking: supports enabled/disabled — no budget_tokens/adaptive
 * 2. tool_choice: fully supported — no need to force auto
 * 3. tools.type: must be "custom"
 * 4. betas: not supported — strip
 * 5. metadata: fully supported — keep
 * 6. cache_control: fully supported (Anthropic prompt caching format) — keep
 * 7. top_p: fully supported — keep user/system value, don't inject
 * 8. temperature: (0.0, 1.0] — doesn't accept 0, but thinking mode skips it
 *    and non-thinking defaults to 1, so no special handling needed
 * 9. speed/output_config/context_management: not supported — strip
 * 10. top_k/stop_sequences/service_tier: silently ignored by server
 * 11. Response: thinking blocks may appear after text — reorder
 *
 * Models: MiniMax-M2.7, MiniMax-M2.7-highspeed, MiniMax-M2.5,
 *         MiniMax-M2.5-highspeed, MiniMax-M2.1, MiniMax-M2.1-highspeed,
 *         MiniMax-M2 (all 204,800 ctx)
 */

import type { ModelAdapter } from './index.js'
import {
  simplifyThinking,
  normalizeToolsKeepCache,
  stripBetas,
  stripUnsupportedFieldsKeepMetadata,
  reorderThinkingBlocks,
} from './shared.js'

const MINIMAX_MODEL_RE = /^minimax-/i
const MINIMAX_HOSTS = ['api.minimaxi.com', 'api.minimax.io']

export const MiniMaxAdapter: ModelAdapter = {
  name: 'MiniMax',
  apiFormat: 'auto',

  match(model: string, baseUrl?: string): boolean {
    if (MINIMAX_MODEL_RE.test(model)) return true
    if (baseUrl) {
      try { return MINIMAX_HOSTS.includes(new URL(baseUrl).host) } catch {}
    }
    return false
  },

  transformParams(params: Record<string, any>): Record<string, any> {
    const out = { ...params }
    simplifyThinking(out)
    normalizeToolsKeepCache(out)
    stripBetas(out)
    stripUnsupportedFieldsKeepMetadata(out)
    return out
  },

  transformResponse(content: any[]): any[] | null {
    return reorderThinkingBlocks(content)
  },
}
