/**
 * Codex Plugin Adapter - Converts Codex plugin manifests to LegnaCode LoadedPlugin format
 *
 * Codex plugins use a different manifest structure (codex-plugin.json / codex-plugin.toml).
 * This adapter translates them into our native PluginManifest + LoadedPlugin so they
 * can participate in the standard plugin lifecycle without any special-casing downstream.
 */

import * as fs from "fs/promises"
import * as path from "path"
import type { LoadedPlugin } from "../../types/plugin.js"
import type { PluginManifest } from "../../utils/plugins/schemas.js"
import type { McpServerConfig } from "../../services/mcp/types.js"

// ---------------------------------------------------------------------------
// Codex-native manifest shape (subset we care about)
// ---------------------------------------------------------------------------

export interface CodexPluginManifest {
  name: string
  version?: string
  description?: string
  author?: string | { name: string; email?: string; url?: string }
  license?: string
  homepage?: string
  repository?: string

  // Codex-specific fields
  engine?: string // e.g. "codex >= 0.5"
  permissions?: CodexPermissions
  tools?: CodexToolDef[]
  mcp_servers?: Record<string, CodexMcpDef>
  skills?: string[]
  hooks?: Record<string, CodexHookDef>
  commands?: Record<string, CodexCommandDef>
  settings?: Record<string, unknown>
}

export interface CodexPermissions {
  network?: boolean | string[]
  filesystem?: boolean | "read" | "write" | string[]
  exec?: boolean | string[]
  env?: string[]
}

export interface CodexToolDef {
  name: string
  description?: string
  command: string
  args?: string[]
  env?: Record<string, string>
}

export interface CodexMcpDef {
  command?: string
  args?: string[]
  env?: Record<string, string>
  url?: string
  type?: "stdio" | "sse" | "http"
}

export interface CodexHookDef {
  command: string
  args?: string[]
  timeout?: number
  on?: "pre" | "post"
}

export interface CodexCommandDef {
  description?: string
  script?: string
  source?: string
  model?: string
}

// ---------------------------------------------------------------------------
// Detection: find codex-plugin.json or codex-plugin.toml in a directory
// ---------------------------------------------------------------------------

const CODEX_MANIFEST_NAMES = [
  "codex-plugin.json",
  "codex-plugin.toml",
  ".codex/plugin.json",
  ".codex/plugin.toml",
]

export async function detectCodexPlugin(
  dir: string,
): Promise<{ path: string; format: "json" | "toml" } | null> {
  for (const name of CODEX_MANIFEST_NAMES) {
    const full = path.join(dir, name)
    try {
      await fs.access(full)
      return { path: full, format: name.endsWith(".toml") ? "toml" : "json" }
    } catch {
      // not found, try next
    }
  }
  return null
}

// ---------------------------------------------------------------------------
// Simple TOML parser (handles flat tables + basic values)
// ---------------------------------------------------------------------------

function parseSimpleToml(content: string): Record<string, unknown> {
  const result: Record<string, unknown> = {}
  let currentSection: Record<string, unknown> = result

  for (const rawLine of content.split("\n")) {
    const line = rawLine.trim()
    if (!line || line.startsWith("#")) continue

    const sectionMatch = line.match(/^\[([^\]]+)\]$/)
    if (sectionMatch) {
      const key = sectionMatch[1]!.trim()
      const obj: Record<string, unknown> = {}
      result[key] = obj
      currentSection = obj
      continue
    }

    const kvMatch = line.match(/^([^=]+)=(.+)$/)
    if (kvMatch) {
      const k = kvMatch[1]!.trim()
      let v: unknown = kvMatch[2]!.trim()
      if (typeof v === "string") {
        if (v.startsWith('"') && v.endsWith('"'))
          v = v.slice(1, -1)
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
// Load a Codex manifest from disk
// ---------------------------------------------------------------------------

export async function loadCodexManifest(
  manifestPath: string,
  format: "json" | "toml",
): Promise<CodexPluginManifest> {
  const raw = await fs.readFile(manifestPath, "utf-8")
  const parsed =
    format === "json" ? JSON.parse(raw) : parseSimpleToml(raw)
  return parsed as CodexPluginManifest
}

// ---------------------------------------------------------------------------
// Convert Codex manifest → native PluginManifest
// ---------------------------------------------------------------------------

function normalizeAuthor(
  author: string | { name: string; email?: string; url?: string } | undefined,
): { name: string; email?: string; url?: string } | undefined {
  if (!author) return undefined
  if (typeof author === "string") return { name: author }
  return author
}

function convertMcpServers(
  defs: Record<string, CodexMcpDef> | undefined,
): Record<string, McpServerConfig> | undefined {
  if (!defs) return undefined
  const out: Record<string, McpServerConfig> = {}
  for (const [name, def] of Object.entries(defs)) {
    if (def.url) {
      const type = def.type === "http" ? "http" : "sse"
      out[name] = { type, url: def.url } as McpServerConfig
    } else if (def.command) {
      out[name] = {
        type: "stdio" as const,
        command: def.command,
        args: def.args,
        env: def.env,
      }
    }
  }
  return Object.keys(out).length > 0 ? out : undefined
}

function convertHooks(
  hooks: Record<string, CodexHookDef> | undefined,
): Record<string, unknown> | undefined {
  if (!hooks) return undefined
  const out: Record<string, unknown> = {}
  for (const [event, def] of Object.entries(hooks)) {
    out[event] = [
      {
        type: "command" as const,
        command: def.command,
        ...(def.args && { args: def.args }),
        ...(def.timeout && { timeout: def.timeout }),
      },
    ]
  }
  return out
}

function convertCommands(
  cmds: Record<string, CodexCommandDef> | undefined,
): Record<string, { source?: string; content?: string; description?: string; model?: string }> | undefined {
  if (!cmds) return undefined
  const out: Record<string, { source?: string; content?: string; description?: string; model?: string }> = {}
  for (const [name, def] of Object.entries(cmds)) {
    out[name] = {
      ...(def.source && { source: def.source }),
      ...(def.script && { content: def.script }),
      ...(def.description && { description: def.description }),
      ...(def.model && { model: def.model }),
    }
  }
  return Object.keys(out).length > 0 ? out : undefined
}

export function codexManifestToNative(
  codex: CodexPluginManifest,
): PluginManifest {
  return {
    name: codex.name,
    ...(codex.version && { version: codex.version }),
    ...(codex.description && { description: codex.description }),
    ...(codex.author && { author: normalizeAuthor(codex.author) }),
    ...(codex.homepage && { homepage: codex.homepage }),
    ...(codex.repository && { repository: codex.repository }),
    ...(codex.license && { license: codex.license }),
    ...(convertMcpServers(codex.mcp_servers) && {
      mcpServers: convertMcpServers(codex.mcp_servers),
    }),
    ...(convertHooks(codex.hooks) && {
      hooks: convertHooks(codex.hooks) as any,
    }),
    ...(convertCommands(codex.commands) && {
      commands: convertCommands(codex.commands),
    }),
    ...(codex.skills && { skills: codex.skills }),
    ...(codex.settings && { settings: codex.settings }),
  } as PluginManifest
}

// ---------------------------------------------------------------------------
// Full pipeline: detect → load → convert → LoadedPlugin
// ---------------------------------------------------------------------------

export async function createLoadedPluginFromCodex(
  dir: string,
): Promise<LoadedPlugin | null> {
  const detected = await detectCodexPlugin(dir)
  if (!detected) return null

  const codex = await loadCodexManifest(detected.path, detected.format)
  const manifest = codexManifestToNative(codex)

  return {
    name: manifest.name,
    manifest,
    path: dir,
    source: "codex-compat",
    repository: "codex-compat",
    enabled: true,
    ...(manifest.mcpServers && { mcpServers: manifest.mcpServers as Record<string, McpServerConfig> }),
    ...(manifest.settings && { settings: manifest.settings }),
  } as LoadedPlugin
}
