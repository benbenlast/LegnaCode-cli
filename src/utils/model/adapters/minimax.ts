/**
 * MiniMax model adapter.
 *
 * MiniMax provides dual API endpoints:
 *   - Anthropic (China):  https://api.minimaxi.com/anthropic
 *   - Anthropic (Global): https://api.minimax.io/anthropic
 *   - OpenAI (China):     https://api.minimaxi.com/v1
 *   - OpenAI (Global):    https://api.minimax.io/v1
 *
 * apiFormat: 'auto' — detects from ANTHROPIC_BASE_URL:
 *   /anthropic suffix → Anthropic SDK, otherwise → OpenAI fetch bridge
 *
 * Anthropic API compatibility (from MiniMax docs):
 *   - model: MiniMax-M2.7, M2.7-highspeed, M2.5, M2.5-highspeed, M2.1, M2.1-highspeed, M2
 *   - thinking: fully supported
 *   - metadata: fully supported
 *   - tool_choice: fully supported
 *   - tools: fully supported
 *   - cache_control: fully supported (Anthropic prompt caching format)
 *   - temperature: (0.0, 1.0], recommended 1.0
 *   - top_k/stop_sequences/service_tier/mcp_servers/context_management/container: ignored
 *   - image/document: not supported
 *   - Response: thinking blocks may appear after text — reorder
 *
 * OpenAI API compatibility:
 *   - reasoning_split=True in extra_body to separate thinking into reasoning_details
 *   - reasoning_details field in streaming delta for thinking content
 *   - temperature: (0.0, 1.0], recommended 1.0
 *   - n: only supports 1
 *   - presence_penalty/frequency_penalty/logit_bias: ignored
 *
 * All models: 204,800 context window
 */

import type { ModelAdapter } from './index.js'
import {
  simplifyThinking,
  normalizeToolsKeepCache,
  stripBetas,
  stripUnsupportedFieldsKeepMetadata,
  stripUnsupportedContentBlocks,
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
    stripUnsupportedContentBlocks(out)
    return out
  },

  transformResponse(content: any[]): any[] | null {
    return reorderThinkingBlocks(content)
  },
}
