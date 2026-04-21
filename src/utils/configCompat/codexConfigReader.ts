/**
 * Codex Config Reader
 *
 * Reads `~/.codex/config.toml` and maps Codex configuration keys
 * to their LegnaCode equivalents. Used at startup to auto-import
 * Codex settings when LegnaCode's own config is missing a value.
 */

import { homedir } from "os"
import { join } from "path"
import { readFileSync } from "fs"
import { readFile } from "fs/promises"
import { logForDebugging } from "../debug.js"

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface CodexConfig {
  model?: string
  sandbox_mode?: string
  approval_mode?: string
  model_providers?: Record<string, CodexProviderConfig>
  mcp_servers?: Record<string, CodexMcpServerConfig>
  hooks?: Record<string, unknown>
  features?: Record<string, boolean>
  network_proxy?: string
  exec_policy?: string
}

export interface CodexProviderConfig {
  api_key?: string
  base_url?: string
  model?: string
}

export interface CodexMcpServerConfig {
  command?: string
  args?: string[]
  env?: Record<string, string>
  url?: string
  type?: "stdio" | "sse" | "http"
}

export interface LegnaCodeSettingsPartial {
  env?: Record<string, string>
  mcpServers?: Record<string, unknown>
}

// ---------------------------------------------------------------------------
// TOML parser (flat tables + basic values, same as codexPluginAdapter)
// ---------------------------------------------------------------------------

function parseSimpleToml(content: string): Record<string, unknown> {
  const result: Record<string, unknown> = {}
  let currentSection: Record<string, unknown> = result

  for (const rawLine of content.split("\n")) {
    const line = rawLine.trim()
    if (!line || line.startsWith("#")) continue

    // Nested table: [section.subsection]
    const sectionMatch = line.match(/^\[([^\]]+)\]$/)
    if (sectionMatch) {
      const parts = sectionMatch[1]!.trim().split(".")
      let target = result
      for (const part of parts) {
        if (!(part in target) || typeof target[part] !== "object") {
          target[part] = {}
        }
        target = target[part] as Record<string, unknown>
      }
      currentSection = target
      continue
    }

    const kvMatch = line.match(/^([^=]+)=(.+)$/)
    if (kvMatch) {
      const k = kvMatch[1]!.trim()
      let v: unknown = kvMatch[2]!.trim()
      if (typeof v === "string") {
        if (v.startsWith('"') && v.endsWith('"')) v = v.slice(1, -1)
        else if (v === "true") v = true
        else if (v === "false") v = false
        else if (/^-?\d+$/.test(v)) v = parseInt(v, 10)
      }
      currentSection[k] = v
    }
  }
  return result
}

// ---------------------------------------------------------------------------
// Read
// ---------------------------------------------------------------------------

const CODEX_CONFIG_PATH = join(homedir(), ".codex", "config.toml")

/**
 * Read and parse `~/.codex/config.toml`. Returns `null` if the file
 * doesn't exist or can't be parsed.
 */
export async function readCodexConfig(): Promise<CodexConfig | null> {
  try {
    const raw = await readFile(CODEX_CONFIG_PATH, "utf-8")
    const parsed = parseSimpleToml(raw)
    logForDebugging(`[codex-compat] Read Codex config from ${CODEX_CONFIG_PATH}`)
    return parsed as CodexConfig
  } catch {
    return null
  }
}

/**
 * Synchronous variant for use in the settings loader (which is sync).
 */
export function readCodexConfigSync(): CodexConfig | null {
  try {
    const raw = readFileSync(CODEX_CONFIG_PATH, "utf-8")
    const parsed = parseSimpleToml(raw)
    logForDebugging(`[codex-compat] Read Codex config (sync) from ${CODEX_CONFIG_PATH}`)
    return parsed as CodexConfig
  } catch {
    return null
  }
}

// ---------------------------------------------------------------------------
// Mapping: Codex → LegnaCode
// ---------------------------------------------------------------------------

/**
 * Map Codex config values to LegnaCode env/settings equivalents.
 * Only returns values that have a meaningful mapping — caller decides
 * whether to apply them (typically: only when LegnaCode's own config
 * doesn't already set the value).
 */
export function mapCodexToLegnaSettings(
  codex: CodexConfig,
): LegnaCodeSettingsPartial {
  const env: Record<string, string> = {}

  // Model
  if (codex.model) {
    env.ANTHROPIC_MODEL = codex.model
  }

  // Sandbox mode
  if (codex.sandbox_mode) {
    const modeMap: Record<string, string> = {
      "read-only": "read-only",
      "workspace-write": "workspace-write",
      "danger-full-access": "danger-full-access",
    }
    if (modeMap[codex.sandbox_mode]) {
      env.CLAUDE_CODE_SANDBOX_MODE = modeMap[codex.sandbox_mode]!
    }
  }

  // Model providers → env vars
  if (codex.model_providers) {
    for (const [name, provider] of Object.entries(codex.model_providers)) {
      if (provider.api_key) {
        const envKey = `${name.toUpperCase()}_API_KEY`
        env[envKey] = provider.api_key
      }
      if (provider.base_url) {
        const envKey = `${name.toUpperCase()}_BASE_URL`
        env[envKey] = provider.base_url
      }
    }
  }

  // Network proxy
  if (codex.network_proxy) {
    env.HTTPS_PROXY = codex.network_proxy
  }

  // MCP servers
  let mcpServers: Record<string, unknown> | undefined
  if (codex.mcp_servers && Object.keys(codex.mcp_servers).length > 0) {
    mcpServers = {}
    for (const [name, srv] of Object.entries(codex.mcp_servers)) {
      if (srv.url) {
        mcpServers[name] = {
          type: srv.type === "http" ? "http" : "sse",
          url: srv.url,
        }
      } else if (srv.command) {
        mcpServers[name] = {
          type: "stdio",
          command: srv.command,
          args: srv.args,
          env: srv.env,
        }
      }
    }
  }

  return {
    ...(Object.keys(env).length > 0 ? { env } : {}),
    ...(mcpServers ? { mcpServers } : {}),
  }
}
