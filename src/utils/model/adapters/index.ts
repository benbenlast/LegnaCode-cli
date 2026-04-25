/**
 * Model adapter interface and registry.
 *
 * Each third-party model provider can register an adapter that transforms
 * API request params before they're sent. Adapters are matched by model name
 * prefix — only the first matching adapter is applied.
 *
 * API format routing: each adapter declares `apiFormat` ('anthropic' | 'openai')
 * to indicate the wire format. When 'openai', the request is routed through
 * the OpenAI bridge (fetch-based) instead of the Anthropic SDK. Auto-detection
 * from ANTHROPIC_BASE_URL is supported: URLs ending in /anthropic → 'anthropic',
 * otherwise → 'openai'.
 */

export interface ModelAdapter {
  /** Human-readable provider name */
  name: string

  /**
   * Default API format for this adapter.
   * - 'anthropic': use Anthropic Messages API (default for all adapters)
   * - 'openai': use OpenAI Chat Completions API
   * - 'auto': infer from base URL — /anthropic suffix → anthropic, else openai
   * Omit or undefined = 'anthropic'.
   */
  apiFormat?: 'anthropic' | 'openai' | 'auto'

  /** Return true if this adapter should handle the given model */
  match(model: string, baseUrl?: string): boolean

  /**
   * Transform request params before sending to the API.
   * Return a new object — do not mutate the input.
   */
  transformParams(params: Record<string, any>): Record<string, any>

  /**
   * Transform response content blocks if needed (e.g. reorder thinking/text).
   * Return null to skip transformation.
   */
  transformResponse?(content: any[]): any[] | null

  /**
   * Return a user-facing message for provider-specific stop_reasons,
   * or undefined if the stop_reason is not handled by this adapter.
   */
  getStopReasonMessage?(stopReason: string): string | undefined
}

// Lazy-loaded adapter registry — adapters are imported on first use
let _adapters: ModelAdapter[] | null = null

function getAdapters(): ModelAdapter[] {
  if (!_adapters) {
    // Import adapters synchronously — they're lightweight
    const { MiMoAdapter } = require('./mimo.js')
    const { GLMAdapter } = require('./glm.js')
    const { DeepSeekAdapter } = require('./deepseek.js')
    const { KimiAdapter } = require('./kimi.js')
    const { MiniMaxAdapter } = require('./minimax.js')
    const { QwenAdapter } = require('./qwen.js')
    const { OpenAICompatAdapter } = require('./openaiCompat.js')
    _adapters = [
      OpenAICompatAdapter, // Must be first — catches all when OPENAI_COMPAT_BASE_URL is set
      MiMoAdapter,
      GLMAdapter,
      DeepSeekAdapter,
      KimiAdapter,
      MiniMaxAdapter,
      QwenAdapter,
    ]
  }
  return _adapters
}

/**
 * Find the matching adapter for a model, or null if none matches.
 */
export function getModelAdapter(model: string): ModelAdapter | null {
  const baseUrl = process.env.ANTHROPIC_BASE_URL
  for (const adapter of getAdapters()) {
    if (adapter.match(model, baseUrl)) return adapter
  }
  return null
}

/**
 * Resolve the effective API format for a matched adapter.
 *
 * Priority:
 *   1. settings.json `apiFormat` (explicit user override)
 *   2. adapter.apiFormat declaration
 *   3. auto-detect from ANTHROPIC_BASE_URL (/anthropic suffix → anthropic, else openai)
 *   4. default: 'anthropic'
 */
function resolveApiFormat(adapter: ModelAdapter | null): 'anthropic' | 'openai' {
  // 1. User override from settings
  try {
    const { getGlobalSettings } = require('../../envUtils.js')
    const settings = getGlobalSettings?.() ?? {}
    if (settings.apiFormat === 'openai' || settings.apiFormat === 'anthropic') {
      return settings.apiFormat
    }
  } catch {}

  if (!adapter) return 'anthropic'

  const declared = adapter.apiFormat ?? 'anthropic'

  // 2. Explicit adapter declaration
  if (declared === 'anthropic' || declared === 'openai') return declared

  // 3. Auto-detect from base URL
  if (declared === 'auto') {
    const baseUrl = process.env.ANTHROPIC_BASE_URL ?? ''
    return /\/anthropic\/?$/.test(baseUrl) ? 'anthropic' : 'openai'
  }

  return 'anthropic'
}

/**
 * Apply model-specific transformations to API request params.
 * Called at the end of paramsFromContext() in claude.ts.
 * Returns the original params if no adapter matches.
 *
 * Resolves API format from adapter declaration, settings, or URL auto-detection.
 * When format is 'openai', appends `__openaiCompat: true` so the API layer
 * routes through the OpenAI bridge instead of Anthropic SDK.
 */
export function applyModelAdapter(params: Record<string, any>): Record<string, any> {
  const adapter = getModelAdapter(params.model)
  let result = adapter ? adapter.transformParams(params) : params

  // If adapter already set __openaiCompat (e.g. OpenAICompatAdapter), skip
  if (!result.__openaiCompat && resolveApiFormat(adapter) === 'openai') {
    result = { ...result, __openaiCompat: true }
  }

  return result
}

/**
 * Apply model-specific response transformations.
 * Called when processing response content blocks.
 */
export function applyResponseAdapter(model: string, content: any[]): any[] {
  const adapter = getModelAdapter(model)
  if (!adapter?.transformResponse) return content
  return adapter.transformResponse(content) ?? content
}

/**
 * Get a user-facing message for provider-specific stop_reasons.
 * Returns undefined if no adapter matches or the stop_reason is not handled.
 */
export function getAdapterStopReasonMessage(model: string, stopReason: string): string | undefined {
  const adapter = getModelAdapter(model)
  if (!adapter?.getStopReasonMessage) return undefined
  return adapter.getStopReasonMessage(stopReason)
}
