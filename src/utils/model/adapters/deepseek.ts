/**
 * DeepSeek model adapter.
 *
 * DeepSeek provides an Anthropic-compatible API at api.deepseek.com/anthropic.
 * Key differences from standard Anthropic API:
 *
 * 1. thinking: only { type: "enabled" | "disabled" } — no budget_tokens/adaptive
 * 2. tool_choice: force "auto"
 * 3. tools.type: "custom"
 * 4. betas: not supported
 * 5. top_p: default 1.0 — do NOT inject a lower default
 * 6. deepseek-reasoner: temperature/top_p are ignored — strip them
 * 7. reasoning_content: strip from assistant messages to avoid 400 errors
 * 8. metadata/speed/output_config/context_management/cache_control: not supported
 * 9. Response: thinking blocks may appear after text — reorder
 */

import type { ModelAdapter } from './index.js'
import {
  simplifyThinking,
  forceAutoToolChoice,
  normalizeTools,
  stripBetas,
  stripUnsupportedFields,
  stripCacheControl,
  stripReasoningContent,
  stripReasonerSamplingParams,
  reorderThinkingBlocks,
} from './shared.js'

const DEEPSEEK_MODEL_PREFIX = 'deepseek-'
const DEEPSEEK_HOST = 'api.deepseek.com'

export const DeepSeekAdapter: ModelAdapter = {
  name: 'DeepSeek',
  apiFormat: 'auto',

  match(model: string, baseUrl?: string): boolean {
    if (model.startsWith(DEEPSEEK_MODEL_PREFIX)) return true
    if (baseUrl) {
      try { return new URL(baseUrl).host === DEEPSEEK_HOST } catch {}
    }
    return false
  },

  transformParams(params: Record<string, any>): Record<string, any> {
    const out = { ...params }
    simplifyThinking(out)
    forceAutoToolChoice(out)
    normalizeTools(out)
    stripBetas(out)
    stripUnsupportedFields(out)
    stripCacheControl(out)
    stripReasoningContent(out)
    // No injectTopP — DeepSeek defaults to 1.0, no need to override
    if (out.model && out.model.includes('reasoner')) {
      stripReasonerSamplingParams(out)
    }
    return out
  },

  transformResponse(content: any[]): any[] | null {
    return reorderThinkingBlocks(content)
  },
}
