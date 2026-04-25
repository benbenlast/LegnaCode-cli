/**
 * Kimi (Moonshot AI) model adapter.
 *
 * Moonshot provides an Anthropic-compatible API at api.moonshot.ai/anthropic.
 * Key differences from standard Anthropic API:
 *
 * 1. thinking: only { type: "enabled" | "disabled" } — no budget_tokens/adaptive
 *    - kimi-k2-thinking-turbo: always_thinking, cannot be disabled
 * 2. tool_choice: force "auto" (tool_search may cause 400 errors)
 * 3. tools.type: "custom"
 * 4. betas: not supported
 * 5. top_p: supported — do NOT inject a default (keep Kimi's own default)
 * 6. reasoning_content: strip from assistant messages (same as DeepSeek)
 * 7. metadata/speed/output_config/context_management: not supported
 * 8. cache_control: KEEP — Kimi supports prompt caching with discount pricing
 * 9. Response: thinking blocks may appear after text — reorder
 *
 * Models: kimi-k2, kimi-k2.5 (multimodal, 256K ctx), kimi-k2-turbo-preview,
 *         kimi-k2-thinking-turbo (always_thinking), kimi-for-coding / kimi-code
 */

import type { ModelAdapter } from './index.js'
import {
  simplifyThinking,
  forceAutoToolChoice,
  normalizeToolsKeepCache,
  stripBetas,
  stripUnsupportedFields,
  stripReasoningContent,
  reorderThinkingBlocks,
} from './shared.js'

const KIMI_MODEL_PREFIX = 'kimi-'
const KIMI_HOSTS = ['api.moonshot.ai', 'api.moonshot.cn']

export const KimiAdapter: ModelAdapter = {
  name: 'Kimi (Moonshot)',
  apiFormat: 'auto',

  match(model: string, baseUrl?: string): boolean {
    if (model.startsWith(KIMI_MODEL_PREFIX)) return true
    if (baseUrl) {
      try { return KIMI_HOSTS.includes(new URL(baseUrl).host) } catch {}
    }
    return false
  },

  transformParams(params: Record<string, any>): Record<string, any> {
    const out = { ...params }
    simplifyThinking(out)
    forceAutoToolChoice(out)
    normalizeToolsKeepCache(out)
    stripBetas(out)
    stripUnsupportedFields(out)
    stripReasoningContent(out)
    // No injectTopP — keep Kimi's own default
    // No stripCacheControl — Kimi supports prompt caching
    return out
  },

  transformResponse(content: any[]): any[] | null {
    return reorderThinkingBlocks(content)
  },
}
