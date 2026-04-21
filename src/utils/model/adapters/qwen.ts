/**
 * Qwen (Alibaba Cloud) model adapter.
 *
 * Qwen provides an Anthropic-compatible API via DashScope.
 * Key differences from standard Anthropic API:
 *
 * 1. thinking: only { type: "enabled" | "disabled" } — no budget_tokens/adaptive
 *    - Qwen3 models support thinking_budget as a top-level param
 *    - QwQ models: always-on reasoning, cannot be disabled
 * 2. tool_choice: force "auto" (named tool choice unreliable)
 * 3. tools.type: "custom"
 * 4. betas: not supported
 * 5. top_p: inject 0.95 for non-reasoning models
 * 6. qwq-* / qwen3-* reasoning: temperature/top_p are ignored — strip them
 * 7. reasoning_content: strip from assistant messages to avoid 400 errors
 * 8. metadata/speed/output_config/context_management/cache_control: not supported
 * 9. Response: thinking blocks may appear after text — reorder
 * 10. enable_search: DashScope server-side web search (opt-in via env)
 *
 * Models: qwen-max, qwen-plus, qwen-turbo, qwen-coder-plus,
 *         qwq-plus (reasoning), qwen3-235b-a22b (hybrid thinking)
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
  injectTopP,
  reorderThinkingBlocks,
} from './shared.js'

const QWEN_PREFIXES = ['qwen-', 'qwq-', 'qwen3-']
const DASHSCOPE_HOSTS = ['dashscope.aliyuncs.com', 'dashscope-intl.aliyuncs.com']

function isReasoningModel(model: string): boolean {
  return model.startsWith('qwq-') || model.includes('thinking')
}

function isQwen3(model: string): boolean {
  return model.startsWith('qwen3-')
}

export const QwenAdapter: ModelAdapter = {
  name: 'Qwen (Alibaba)',

  match(model: string, baseUrl?: string): boolean {
    if (QWEN_PREFIXES.some(p => model.startsWith(p))) return true
    if (baseUrl) {
      try { return DASHSCOPE_HOSTS.includes(new URL(baseUrl).host) } catch {}
    }
    return false
  },

  transformParams(params: Record<string, any>): Record<string, any> {
    const out = { ...params }

    // Qwen3: map budget_tokens → thinking_budget (top-level param)
    if (isQwen3(out.model) && out.thinking?.budget_tokens) {
      out.thinking_budget = out.thinking.budget_tokens
    }

    simplifyThinking(out)
    forceAutoToolChoice(out)
    normalizeTools(out)
    stripBetas(out)
    stripUnsupportedFields(out)
    stripCacheControl(out)
    stripReasoningContent(out)

    if (isReasoningModel(out.model)) {
      stripReasonerSamplingParams(out)
    } else {
      injectTopP(out, 0.95)
    }

    // DashScope server-side web search (opt-in)
    if (process.env.DASHSCOPE_ENABLE_SEARCH === 'true') {
      out.enable_search = true
    }

    return out
  },

  transformResponse(content: any[]): any[] | null {
    return reorderThinkingBlocks(content)
  },

  getStopReasonMessage(stopReason: string): string | undefined {
    if (stopReason === 'content_filter') {
      return 'Qwen 安全过滤触发，请调整输入内容。'
    }
    return undefined
  },
}
