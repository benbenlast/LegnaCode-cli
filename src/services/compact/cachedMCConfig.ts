/**
 * Cached microcompact config — standalone module for synchronous require()
 * from prompts.ts. Shares the same config shape as cachedMicrocompact.ts
 * but avoids the async import() dependency chain.
 */
import type { CachedMCConfig } from './cachedMicrocompact.js'

const DEFAULT_CONFIG: CachedMCConfig = {
  enabled: true,
  triggerThreshold: 6,
  keepRecent: 3,
  supportedModels: ['claude-opus-4', 'claude-sonnet-4'],
  systemPromptSuggestSummaries: true,
}

export function getCachedMCConfig(): CachedMCConfig {
  return DEFAULT_CONFIG
}
