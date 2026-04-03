/**
 * ZhipuAI GLM model adapter.
 *
 * GLM provides an Anthropic-compatible API at open.bigmodel.cn/api/anthropic.
 * Differences from standard Anthropic API:
 *
 * 1. thinking: only { type: "enabled" | "disabled" } — no budget_tokens/adaptive
 * 2. tool_choice: likely only "auto" (safe default)
 * 3. tools.type: "custom"
 * 4. betas: not supported
 * 5. top_p: default 0.95
 * 6. do_sample: GLM-specific (not sent via Anthropic SDK, no action needed)
 * 7. metadata/speed/output_config/context_management: not supported
 * 8. cache_control: not supported
 * 9. Response: thinking blocks may appear after text — reorder
 */

import type { ModelAdapter } from './index.js'
import { applyStandardTransforms, reorderThinkingBlocks } from './shared.js'

const GLM_MODEL_PREFIXES = ['glm-']
const GLM_HOST = 'open.bigmodel.cn'

export const GLMAdapter: ModelAdapter = {
  name: 'GLM (ZhipuAI)',

  match(model: string, baseUrl?: string): boolean {
    if (GLM_MODEL_PREFIXES.some(p => model.startsWith(p))) return true
    if (baseUrl) {
      try { return new URL(baseUrl).host === GLM_HOST } catch {}
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
