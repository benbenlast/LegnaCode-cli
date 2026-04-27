/**
 * ZhipuAI GLM model adapter.
 *
 * GLM provides dual API endpoints:
 *   - OpenAI:    https://open.bigmodel.cn/api/paas/v4/chat/completions
 *   - Anthropic: https://open.bigmodel.cn/api/anthropic
 *   - Coding Plan (OpenAI):    https://open.bigmodel.cn/api/coding/paas/v4
 *   - Coding Plan (Anthropic): https://open.bigmodel.cn/api/coding/anthropic (inferred)
 *
 * apiFormat: 'auto' — detects from ANTHROPIC_BASE_URL:
 *   /anthropic suffix → Anthropic SDK, otherwise → OpenAI fetch bridge
 *
 * Auth: ANTHROPIC_AUTH_TOKEN or ANTHROPIC_API_KEY (Bearer token).
 *
 * Anthropic API compatibility:
 *   - thinking: { type: "enabled" | "disabled" } — GLM-4.5+ supports
 *     clear_thinking param (server-side, controls reasoning_content passback)
 *   - tool_choice: only "auto"
 *   - tools.type: must be "custom"
 *   - cache_control: server-side auto caching (response includes cached_tokens)
 *   - betas/metadata/speed/output_config/context_management: not supported
 *
 * OpenAI API compatibility:
 *   - reasoning_content: GLM-4.5 series returns in delta (thinking mode)
 *   - thinking: { type: "enabled" | "disabled" }, clear_thinking: bool
 *   - tool_choice: only "auto"
 *   - tool_stream: GLM-5.1/5/4.7/4.6 support streaming function calls
 *   - finish_reason: stop, tool_calls, length, sensitive (content safety),
 *     network_error, model_context_window_exceeded
 *   - cached_tokens in usage.prompt_tokens_details
 *   - do_sample: GLM-specific (not sent via our bridge)
 *
 * Text models: glm-5.1, glm-5-turbo, glm-5, glm-4.7, glm-4.7-flash,
 *   glm-4.7-flashx, glm-4.6, glm-4.5-air, glm-4.5-airx, glm-4.5-flash
 * Vision: glm-5v-turbo, glm-4.6v, glm-4.6v-flash, glm-4.6v-flashx
 * Max output: GLM-5.1/5/4.7/4.6 → 128K, GLM-4.5 → 96K
 */

import type { ModelAdapter } from './index.js'
import {
  simplifyThinking,
  forceAutoToolChoice,
  normalizeTools,
  stripBetas,
  injectTopP,
  stripUnsupportedFields,
  stripUnsupportedContentBlocks,
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
    // GLM has server-side auto caching (cached_tokens in response),
    // but cache_control in requests is ignored — keep it for now as
    // it doesn't cause errors and may be supported in the future
    stripUnsupportedContentBlocks(out)
    return out
  },

  transformResponse(content: any[]): any[] | null {
    return reorderThinkingBlocks(content)
  },

  getStopReasonMessage(stopReason: string): string | undefined {
    if (stopReason === 'sensitive') {
      return 'GLM 内容安全审核拦截，请调整输入内容。'
    }
    if (stopReason === 'network_error') {
      return 'GLM 模型推理异常，请稍后重试。'
    }
    if (stopReason === 'model_context_window_exceeded') {
      return 'GLM 上下文窗口超限，请缩短对话历史或使用 /compact。'
    }
    return undefined
  },
}
