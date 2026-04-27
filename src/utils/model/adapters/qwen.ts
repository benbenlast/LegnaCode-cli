/**
 * Qwen (Alibaba Cloud DashScope) model adapter.
 *
 * DashScope provides dual API endpoints:
 *   - Anthropic (Beijing):    https://dashscope.aliyuncs.com/apps/anthropic
 *   - Anthropic (Singapore):  https://dashscope-intl.aliyuncs.com/apps/anthropic
 *   - Anthropic (Coding Plan): https://coding.dashscope.aliyuncs.com/apps/anthropic
 *   - OpenAI (Coding Plan):   https://coding.dashscope.aliyuncs.com/v1
 *
 * apiFormat: 'auto' — detects from ANTHROPIC_BASE_URL:
 *   /anthropic suffix → Anthropic SDK, otherwise → OpenAI fetch bridge
 *
 * Auth: supports both ANTHROPIC_API_KEY and ANTHROPIC_AUTH_TOKEN env vars.
 *
 * Anthropic API compatibility:
 *   - thinking: supported (budget_tokens ignored by server, Qwen3 maps to thinking_budget)
 *   - output_config: only effort supported
 *   - tool_choice: auto/none/any/tool supported
 *   - cache_control: ignored
 *   - image/document/server_tool_use/redacted_thinking: not supported
 *   - reasoning_content: strip from assistant messages
 *   - enable_search: DashScope server-side web search (opt-in via env)
 *
 * Models:
 *   Max:    qwen3.6-max-preview, qwen3-max, qwen3-max-2026-01-23, qwen3-max-preview
 *   Plus:   qwen3.6-plus, qwen3.5-plus, qwen3.5-plus-2026-02-15, qwen-plus, qwen-plus-latest
 *   Flash:  qwen3.6-flash, qwen3.5-flash, qwen-flash
 *   Turbo:  qwen-turbo, qwen-turbo-latest
 *   Coder:  qwen3-coder-next, qwen3-coder-plus, qwen3-coder-flash
 *   VL:     qwen3-vl-plus, qwen3-vl-flash, qwen-vl-max, qwen-vl-plus
 *   Open:   qwen3.5-397b-a17b, qwen3.5-120b-a10b, qwen3.5-27b, qwen3.5-35b-a3b
 *   3rd-party (Beijing only): deepseek-v4-*, kimi-k2.5, glm-5/4.7, MiniMax-M2.5
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
  stripUnsupportedContentBlocks,
  injectTopP,
  reorderThinkingBlocks,
} from './shared.js'

const QWEN_PREFIXES = ['qwen-', 'qwq-', 'qwen3-', 'qwen3.']
const DASHSCOPE_HOSTS = [
  'dashscope.aliyuncs.com',
  'dashscope-intl.aliyuncs.com',
  'coding.dashscope.aliyuncs.com',
]

function isReasoningModel(model: string): boolean {
  return model.startsWith('qwq-') || model.includes('thinking')
}

function isQwen3(model: string): boolean {
  return model.startsWith('qwen3-')
}

export const QwenAdapter: ModelAdapter = {
  name: 'Qwen (Alibaba)',
  apiFormat: 'auto',

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
    stripUnsupportedContentBlocks(out)

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
