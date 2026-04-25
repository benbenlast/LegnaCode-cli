/**
 * Kimi (Moonshot AI) model adapter.
 *
 * Kimi provides dual API endpoints:
 *   - OpenAI:    https://api.moonshot.cn/v1/chat/completions
 *   - Anthropic: https://api.moonshot.cn/anthropic (via proxy, or via DashScope/百炼)
 *
 * apiFormat: 'auto' — detects from ANTHROPIC_BASE_URL:
 *   /anthropic suffix → Anthropic SDK, otherwise → OpenAI fetch bridge
 *
 * OpenAI API details:
 *   - kimi-k2.6: temperature/top_p NOT modifiable (server ignores), thinking supported
 *   - kimi-k2 series: temperature default 0.6, top_p default 1.0
 *   - kimi-k2-thinking series: temperature default 1.0, always-on reasoning
 *   - thinking: { type: "enabled" | "disabled" } via extra_body (OpenAI SDK)
 *   - reasoning_content: returned in delta for thinking models
 *   - tool_choice: only "auto"
 *   - finish_reason: stop, tool_calls, length
 *   - No reasoning_content passback requirement documented
 *
 * Anthropic API compatibility:
 *   - thinking: { type: "enabled" | "disabled" } — no budget_tokens/adaptive
 *   - tool_choice: force "auto"
 *   - tools.type: "custom"
 *   - cache_control: supported (prompt caching with discount pricing)
 *   - reasoning_content: strip from assistant messages
 *   - betas/metadata/speed/output_config/context_management: not supported
 *
 * Models: kimi-k2.6 (latest, thinking), kimi-k2.5 (multimodal, 256K ctx),
 *   kimi-k2, kimi-k2-turbo-preview, kimi-k2-thinking-turbo (always_thinking),
 *   kimi-for-coding / kimi-code, moonshot-v1-* (legacy)
 */

import type { ModelAdapter } from './index.js'
import {
  simplifyThinking,
  forceAutoToolChoice,
  normalizeToolsKeepCache,
  stripBetas,
  stripUnsupportedFields,
  stripReasoningContent,
  stripUnsupportedContentBlocks,
  reorderThinkingBlocks,
} from './shared.js'

const KIMI_MODEL_PREFIX = 'kimi-'
const MOONSHOT_MODEL_PREFIX = 'moonshot-'
const KIMI_HOSTS = ['api.moonshot.ai', 'api.moonshot.cn']

export const KimiAdapter: ModelAdapter = {
  name: 'Kimi (Moonshot)',
  apiFormat: 'auto',

  match(model: string, baseUrl?: string): boolean {
    if (model.startsWith(KIMI_MODEL_PREFIX) || model.startsWith(MOONSHOT_MODEL_PREFIX)) return true
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
    stripUnsupportedContentBlocks(out)
    // No injectTopP — kimi-k2.6 ignores it, others have their own defaults
    // No stripCacheControl — Kimi supports prompt caching
    return out
  },

  transformResponse(content: any[]): any[] | null {
    return reorderThinkingBlocks(content)
  },
}
