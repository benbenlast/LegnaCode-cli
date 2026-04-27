/**
 * Xiaomi MiMo model adapter.
 *
 * MiMo provides dual API endpoints:
 *   - Anthropic:         https://api.xiaomimimo.com/anthropic
 *   - OpenAI:            https://api.xiaomimimo.com/v1
 *   - Token Plan (Anthropic): https://token-plan-cn.xiaomimimo.com/anthropic
 *   - Token Plan (OpenAI):    https://token-plan-cn.xiaomimimo.com/v1
 *
 * apiFormat: 'auto' — detects from ANTHROPIC_BASE_URL:
 *   /anthropic suffix → Anthropic SDK, otherwise → OpenAI fetch bridge
 *
 * Auth: supports both `Authorization: Bearer` and `api-key` header.
 *
 * Anthropic API compatibility:
 *   - thinking: { type: "enabled" | "disabled" } — no budget_tokens/adaptive
 *   - tool_choice: only "auto" — other values silently ignored by server
 *   - tools.type: must be "custom"
 *   - cache_control: supported (server-side auto caching, response includes cache_read_input_tokens)
 *   - stop_reason: extra values content_filter, repetition_truncation
 *   - top_p: [0.01, 1.0], default 0.95
 *   - temperature: [0, 1.5]
 *   - betas/metadata/speed/output_config/context_management: not supported
 *
 * OpenAI API compatibility:
 *   - reasoning_content: returned in thinking mode, must be passed back in multi-turn
 *   - thinking.type: "enabled" | "disabled" (same as Anthropic)
 *   - tool_choice: only "auto"
 *   - finish_reason: stop, length, tool_calls, content_filter, repetition_truncation
 *   - max_completion_tokens: includes reasoning tokens
 *
 * Models: mimo-v2.5-pro, mimo-v2.5, mimo-v2-pro (1M ctx),
 *         mimo-v2-omni, mimo-v2-flash (262K ctx)
 */

import type { ModelAdapter } from './index.js'
import {
  simplifyThinking,
  forceAutoToolChoice,
  normalizeToolsKeepCache,
  stripBetas,
  injectTopP,
  stripUnsupportedFields,
  stripUnsupportedContentBlocks,
  reorderThinkingBlocks,
} from './shared.js'

const MIMO_MODELS = ['mimo-v2.5-pro', 'mimo-v2.5', 'mimo-v2-pro', 'mimo-v2-omni', 'mimo-v2-flash']
const MIMO_HOSTS = ['api.xiaomimimo.com', 'token-plan-cn.xiaomimimo.com']

export const MiMoAdapter: ModelAdapter = {
  name: 'MiMo (Xiaomi)',
  apiFormat: 'auto',

  match(model: string, baseUrl?: string): boolean {
    if (MIMO_MODELS.some(m => model.startsWith(m))) return true
    if (baseUrl) {
      try { return MIMO_HOSTS.includes(new URL(baseUrl).host) } catch {}
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
    stripUnsupportedContentBlocks(out)
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
