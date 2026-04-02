/**
 * Cached microcompact — cache-aware tool result compaction.
 *
 * Instead of mutating message content (which busts the prompt cache),
 * this module tracks tool_result blocks and generates cache_edits
 * instructions for the API to delete them server-side.
 *
 * Gated by feature('CACHED_MICROCOMPACT').
 */

// --- Types ---

export type CachedMCState = {
  registeredTools: Set<string>
  toolOrder: string[]
  deletedRefs: Set<string>
  pinnedEdits: PinnedCacheEdits[]
  toolsSentToAPI: boolean
}

export type CacheEditsBlock = {
  type: 'cache_edits'
  edits: { type: 'delete'; cache_reference: string }[]
}

export type PinnedCacheEdits = {
  userMessageIndex: number
  block: CacheEditsBlock
}

export type CachedMCConfig = {
  enabled: boolean
  triggerThreshold: number
  keepRecent: number
  supportedModels: string[]
  systemPromptSuggestSummaries: boolean
}

// --- Config ---

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

export function isCachedMicrocompactEnabled(): boolean {
  return DEFAULT_CONFIG.enabled
}

export function isModelSupportedForCacheEditing(model: string): boolean {
  return DEFAULT_CONFIG.supportedModels.some(pattern => model.includes(pattern))
}

// --- State management ---

export function createCachedMCState(): CachedMCState {
  return {
    registeredTools: new Set(),
    toolOrder: [],
    deletedRefs: new Set(),
    pinnedEdits: [],
    toolsSentToAPI: false,
  }
}

export function resetCachedMCState(state: CachedMCState): void {
  state.registeredTools.clear()
  state.toolOrder.length = 0
  state.deletedRefs.clear()
  state.pinnedEdits.length = 0
  state.toolsSentToAPI = false
}

export function registerToolResult(
  state: CachedMCState,
  toolUseId: string,
): void {
  if (!state.registeredTools.has(toolUseId)) {
    state.registeredTools.add(toolUseId)
    state.toolOrder.push(toolUseId)
  }
}

export function registerToolMessage(
  state: CachedMCState,
  _groupIds: string[],
): void {
  // Group tracking is a no-op in the minimal implementation.
  // The per-tool registration in registerToolResult is sufficient
  // for the count-based trigger/keep logic.
}

/**
 * Determine which tool_use_ids should be deleted.
 * Only deletes tools that have been sent to the API (marked via
 * markToolsSentToAPI), keeping the most recent `keepRecent` tools.
 */
export function getToolResultsToDelete(state: CachedMCState): string[] {
  const config = getCachedMCConfig()
  // Count active (non-deleted) tools
  const activeTools = state.toolOrder.filter(id => !state.deletedRefs.has(id))
  if (activeTools.length <= config.triggerThreshold) return []

  // Keep the most recent N, delete the rest — but only if already sent to API
  const toKeep = new Set(activeTools.slice(-config.keepRecent))
  const toDelete: string[] = []
  for (const id of activeTools) {
    if (!toKeep.has(id) && state.toolsSentToAPI) {
      toDelete.push(id)
    }
  }
  return toDelete
}

/**
 * Create a cache_edits block for the given tool IDs.
 * Marks them as deleted in state so they won't be re-deleted.
 */
export function createCacheEditsBlock(
  state: CachedMCState,
  toolsToDelete: string[],
): CacheEditsBlock | null {
  if (toolsToDelete.length === 0) return null

  for (const id of toolsToDelete) {
    state.deletedRefs.add(id)
  }

  return {
    type: 'cache_edits',
    edits: toolsToDelete.map(id => ({
      type: 'delete' as const,
      cache_reference: id,
    })),
  }
}

/**
 * Mark all currently registered tools as sent to the API.
 * Called after a successful API response. Only tools marked as sent
 * are eligible for deletion (prevents deleting unsent tools).
 */
export function markToolsSentToAPI(state: CachedMCState): void {
  state.toolsSentToAPI = true
}
