/**
 * Codex Marketplace Adapter
 *
 * Bridges Codex-style plugin registries into LegnaCode's marketplace system.
 * Codex registries use a flat JSON index (`codex-registry.json`) with a
 * different schema than our PluginMarketplace. This module fetches, caches,
 * and converts those entries so they appear as native marketplace plugins.
 */

import axios from "axios"
import * as fs from "fs/promises"
import * as path from "path"
import { logError } from "../../utils/log.js"
import type {
  PluginMarketplace,
  PluginMarketplaceEntry,
} from "../../utils/plugins/schemas.js"
import { getPluginsDirectory } from "../../utils/plugins/pluginDirectories.js"

// ---------------------------------------------------------------------------
// Codex registry types
// ---------------------------------------------------------------------------

export interface CodexRegistryIndex {
  version?: number
  plugins: CodexRegistryEntry[]
  updated_at?: string
}

export interface CodexRegistryEntry {
  name: string
  version?: string
  description?: string
  author?: string
  repository?: string
  homepage?: string
  license?: string
  tags?: string[]
  install?: CodexInstallInfo
}

export interface CodexInstallInfo {
  type: "npm" | "git" | "url" | "local"
  source: string
  command?: string
  args?: string[]
}

// ---------------------------------------------------------------------------
// Known Codex registries
// ---------------------------------------------------------------------------

const CODEX_REGISTRY_URLS = [
  "https://registry.codex.dev/v1/plugins.json",
  "https://raw.githubusercontent.com/openai/codex-plugins/main/registry.json",
]

// ---------------------------------------------------------------------------
// Fetch & cache
// ---------------------------------------------------------------------------

/**
 * Fetch a Codex registry index from a remote URL.
 * Returns `null` on network / parse errors so callers can fall back.
 */
export async function fetchCodexRegistry(
  url: string,
  timeoutMs = 8_000,
): Promise<CodexRegistryIndex | null> {
  try {
    const resp = await axios.get<CodexRegistryIndex>(url, {
      timeout: timeoutMs,
      headers: { Accept: "application/json" },
    })
    if (!resp.data?.plugins || !Array.isArray(resp.data.plugins)) {
      return null
    }
    return resp.data
  } catch {
    return null
  }
}

/**
 * Try every known Codex registry URL and return the first successful result.
 */
export async function fetchAnyCodexRegistry(): Promise<CodexRegistryIndex | null> {
  for (const url of CODEX_REGISTRY_URLS) {
    const result = await fetchCodexRegistry(url)
    if (result) return result
  }
  return null
}

/**
 * Persist a fetched registry to the local cache directory so it can be
 * used offline.
 */
export async function cacheCodexRegistry(
  registry: CodexRegistryIndex,
): Promise<string> {
  const dir = path.join(await getPluginsDirectory(), "codex-compat")
  await fs.mkdir(dir, { recursive: true })
  const cachePath = path.join(dir, "codex-registry-cache.json")
  await fs.writeFile(cachePath, JSON.stringify(registry, null, 2), "utf-8")
  return cachePath
}

/**
 * Load the cached Codex registry (if any).
 */
export async function loadCachedCodexRegistry(): Promise<CodexRegistryIndex | null> {
  try {
    const dir = path.join(await getPluginsDirectory(), "codex-compat")
    const raw = await fs.readFile(
      path.join(dir, "codex-registry-cache.json"),
      "utf-8",
    )
    return JSON.parse(raw) as CodexRegistryIndex
  } catch {
    return null
  }
}

// ---------------------------------------------------------------------------
// Conversion helpers
// ---------------------------------------------------------------------------

/**
 * Convert a single Codex registry entry into a LegnaCode marketplace entry.
 */
export function codexEntryToMarketplaceEntry(
  entry: CodexRegistryEntry,
): PluginMarketplaceEntry {
  const mcpConfig = buildMcpConfig(entry)
  return {
    name: `codex-${entry.name}`,
    description: entry.description ?? `Codex plugin: ${entry.name}`,
    version: entry.version ?? "0.0.0",
    ...(mcpConfig ? { mcp_config: mcpConfig } : {}),
  } as PluginMarketplaceEntry
}

function buildMcpConfig(
  entry: CodexRegistryEntry,
): Record<string, unknown> | undefined {
  if (!entry.install) return undefined
  const { type, source, command, args } = entry.install

  switch (type) {
    case "npm":
      return {
        type: "stdio" as const,
        command: "npx",
        args: ["-y", source, ...(args ?? [])],
      }
    case "git":
      return {
        type: "stdio" as const,
        command: command ?? "node",
        args: [source, ...(args ?? [])],
      }
    case "url":
      return { type: "sse" as const, url: source }
    case "local":
      return {
        type: "stdio" as const,
        command: command ?? "node",
        args: [source, ...(args ?? [])],
      }
    default:
      return undefined
  }
}

/**
 * Convert an entire Codex registry into a LegnaCode PluginMarketplace.
 */
export function codexRegistryToMarketplace(
  registry: CodexRegistryIndex,
): PluginMarketplace {
  return {
    name: "codex-compat-marketplace",
    description: "Codex plugins imported via compatibility layer",
    plugins: registry.plugins.map(codexEntryToMarketplaceEntry),
  } as PluginMarketplace
}

/**
 * High-level helper: fetch (or load cached) Codex registry and return it
 * as a native LegnaCode marketplace.
 */
export async function getCodexCompatMarketplace(): Promise<PluginMarketplace | null> {
  try {
    let registry = await fetchAnyCodexRegistry()
    if (registry) {
      await cacheCodexRegistry(registry).catch(() => {})
    } else {
      registry = await loadCachedCodexRegistry()
    }
    if (!registry) return null
    return codexRegistryToMarketplace(registry)
  } catch (err) {
    logError("Failed to load Codex compat marketplace", err)
    return null
  }
}
