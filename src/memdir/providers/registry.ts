/**
 * Memory Provider Registry — discover, load, and manage memory providers.
 *
 * Adapted from Hermes Agent's plugins/memory/ system.
 * One external provider active at a time, alongside the always-on built-in.
 */

import { logForDebugging } from '../../utils/debug.js'
import { MemoryProvider } from './MemoryProvider.js'
import { FileMemoryProvider } from './FileMemoryProvider.js'

const builtinProvider = new FileMemoryProvider()
let activeExternalProvider: MemoryProvider | null = null

/**
 * Get the built-in memory provider (always active).
 */
export function getBuiltinProvider(): MemoryProvider {
  return builtinProvider
}

/**
 * Get the active external provider, if any.
 */
export function getExternalProvider(): MemoryProvider | null {
  return activeExternalProvider
}

/**
 * Get all active providers (builtin + optional external).
 */
export function getActiveProviders(): MemoryProvider[] {
  const providers: MemoryProvider[] = [builtinProvider]
  if (activeExternalProvider) providers.push(activeExternalProvider)
  return providers
}

/**
 * Register an external memory provider.
 * Only one external provider can be active at a time.
 * Replaces any previously registered external provider.
 */
export async function registerExternalProvider(
  provider: MemoryProvider,
  sessionId: string,
): Promise<void> {
  if (!provider.isAvailable()) {
    logForDebugging(`[memoryRegistry] Provider "${provider.name}" not available, skipping`)
    return
  }

  // Shutdown previous external provider
  if (activeExternalProvider) {
    logForDebugging(`[memoryRegistry] Shutting down previous provider "${activeExternalProvider.name}"`)
    await activeExternalProvider.shutdown()
  }

  activeExternalProvider = provider
  await provider.initialize(sessionId)
  logForDebugging(`[memoryRegistry] Registered external provider "${provider.name}"`)
}

/**
 * Unregister the active external provider.
 */
export async function unregisterExternalProvider(): Promise<void> {
  if (activeExternalProvider) {
    await activeExternalProvider.shutdown()
    logForDebugging(`[memoryRegistry] Unregistered provider "${activeExternalProvider.name}"`)
    activeExternalProvider = null
  }
}

/**
 * Initialize all providers for a session.
 */
export async function initializeProviders(sessionId: string): Promise<void> {
  await builtinProvider.initialize(sessionId)
  if (activeExternalProvider) {
    await activeExternalProvider.initialize(sessionId)
  }
}

/**
 * Shutdown all providers.
 */
export async function shutdownProviders(): Promise<void> {
  await builtinProvider.shutdown()
  if (activeExternalProvider) {
    await activeExternalProvider.shutdown()
    activeExternalProvider = null
  }
}

/**
 * Prefetch from all active providers.
 */
export async function prefetchAll(query: string): Promise<string> {
  const results = await Promise.all(
    getActiveProviders().map(p => p.prefetch(query).catch(() => '')),
  )
  return results.filter(Boolean).join('\n\n')
}

/**
 * Sync a turn to all active providers.
 */
export async function syncTurnAll(userContent: string, assistantContent: string): Promise<void> {
  await Promise.all(
    getActiveProviders().map(p => p.syncTurn(userContent, assistantContent).catch(() => {})),
  )
}

/**
 * Notify all providers of session end.
 */
export function notifySessionEnd(messages: unknown[]): void {
  for (const p of getActiveProviders()) {
    try { p.onSessionEnd(messages) } catch {}
  }
}

/**
 * Collect system prompt blocks from all providers.
 */
export function collectSystemPromptBlocks(): string {
  return getActiveProviders()
    .map(p => p.systemPromptBlock())
    .filter(Boolean)
    .join('\n\n')
}
