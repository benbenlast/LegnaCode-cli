/**
 * ZhipuAI GLM model adapter.
 *
 * GLM provides an Anthropic-compatible API at open.bigmodel.cn/api/anthropic.
 * Differences from standard Anthropic API:
 *
 * 1. thinking: only { type: "enabled" | "disabled" } — no budget_tokens/adaptive
 *    - GLM-4.5+ supports interleaved thinking (thinking between tool calls)
 * 2. tool_choice: force "auto" (safe default)
 * 3. tools.type: must be "custom"
 * 4. betas: not supported — strip entirely
 * 5. top_p: supported — inject default 0.95
 * 6. do_sample: GLM-specific param (not sent via Anthropic SDK, no action needed)
 * 7. metadata/speed/output_config/context_management: not supported — strip
 * 8. cache_control: not supported — strip (GLM has server-side auto caching)
 * 9. Response: thinking blocks may appear after text — reorder
 *
 * Models: glm-5.1, glm-5, glm-5-turbo, glm-4.7, glm-4.7-flash,
 *         glm-4.6 (200K ctx, 128K output), glm-4.5, glm-4.5-air, glm-5v-turbo
 */

import type { ModelAdapter } from './index.js'
import {
  simplifyThinking,
  forceAutoToolChoice,
  normalizeTools,
  stripBetas,
  injectTopP,
  stripUnsupportedFields,
  stripCacheControl,
  reorderThinkingBlocks,
} from './shared.js'

const GLM_MODEL_PREFIX = 'glm-'
const GLM_HOST = 'open.bigmodel.cn'

export const GLMAdapter: ModelAdapter = {
  name: 'GLM (ZhipuAI)',
  apiFormat: 'auto',

  match(model: string, baseUrl?: string): boolean {
    if (model.startsWith(GLM_MODEL_PREFIX)) return true
    if (baseUrl) {
      try { return new URL(baseUrl).host === GLM_HOST } catch {}
    }
    return false
  },

  transformParams(params: Record<string, any>): Record<string, any> {
    const out = { ...params }
    simplifyThinking(out)
    forceAutoToolChoice(out)
    normalizeTools(out)
    stripBetas(out)
    injectTopP(out, 0.95)
    stripUnsupportedFields(out)
    stripCacheControl(out)
    return out
  },

  transformResponse(content: any[]): any[] | null {
    return reorderThinkingBlocks(content)
  },
}
