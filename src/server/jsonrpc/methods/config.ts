/**
 * JSON-RPC config methods — configuration read/write for IDE integration.
 */

import type { JsonRpcRouter } from '../router.js'

interface ConfigReadParams {
  scope?: 'global' | 'project'
  key?: string
}

interface ConfigWriteParams {
  scope?: 'global' | 'project'
  key: string
  value: unknown
}

interface ConfigBatchWriteParams {
  scope?: 'global' | 'project'
  entries: Array<{ key: string; value: unknown }>
}

export function registerConfigMethods(router: JsonRpcRouter): void {
  // In-memory config store (placeholder — will integrate with real settings)
  const store = new Map<string, unknown>()

  router.register('config/read', async (params) => {
    const p = (params ?? {}) as ConfigReadParams
    if (p.key) {
      return { key: p.key, value: store.get(p.key) ?? null }
    }
    // Return all config
    const entries: Record<string, unknown> = {}
    for (const [k, v] of store) entries[k] = v
    return { scope: p.scope ?? 'global', entries }
  })

  router.register('config/value/write', async (params) => {
    const p = params as ConfigWriteParams
    if (!p?.key) throw new Error('Invalid params: key required.')
    store.set(p.key, p.value)
    return { key: p.key, written: true }
  })

  router.register('config/batchWrite', async (params) => {
    const p = params as ConfigBatchWriteParams
    if (!p?.entries || !Array.isArray(p.entries)) {
      throw new Error('Invalid params: entries array required.')
    }
    const results: Array<{ key: string; written: boolean }> = []
    for (const entry of p.entries) {
      store.set(entry.key, entry.value)
      results.push({ key: entry.key, written: true })
    }
    return { results }
  })
}
