/**
 * Codex config importer — imports settings from OpenAI Codex CLI.
 *
 * Reads config.toml / config.json and maps to LegnaCode equivalents.
 */

import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'fs'
import { join } from 'path'
import { homedir } from 'os'
import type { ImporterOptions, MigrationResult } from '../types.js'
import { detectAgent } from '../detectors.js'

const LEGNACODE_DIR = join(homedir(), '.legnacode')

function ensureDir(dir: string): void {
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true })
}

function readJsonSafe(path: string): Record<string, unknown> | null {
  try {
    return JSON.parse(readFileSync(path, 'utf-8'))
  } catch {
    return null
  }
}

/**
 * Parse a minimal TOML file (key = "value" pairs and [sections]).
 * Not a full TOML parser — handles the simple cases in Codex config.
 */
function parseSimpleToml(content: string): Record<string, unknown> {
  const result: Record<string, unknown> = {}
  let currentSection = result

  for (const line of content.split('\n')) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue

    // Section header
    const sectionMatch = trimmed.match(/^\[(.+)]$/)
    if (sectionMatch) {
      const key = sectionMatch[1]!
      const section: Record<string, unknown> = {}
      result[key] = section
      currentSection = section
      continue
    }

    // Key = value
    const eqIdx = trimmed.indexOf('=')
    if (eqIdx === -1) continue
    const key = trimmed.slice(0, eqIdx).trim()
    let val: unknown = trimmed.slice(eqIdx + 1).trim()

    if (typeof val === 'string') {
      if (val === 'true') val = true
      else if (val === 'false') val = false
      else if (/^\d+$/.test(val)) val = parseInt(val, 10)
      else if (val.startsWith('"') && val.endsWith('"')) val = val.slice(1, -1)
    }

    (currentSection as Record<string, unknown>)[key] = val
  }

  return result
}

export function importFromCodex(options: ImporterOptions = {}): MigrationResult {
  const result: MigrationResult = {
    agent: 'codex',
    imported: [],
    skipped: [],
    errors: [],
  }

  const agent = detectAgent('codex')
  if (!agent) {
    result.errors.push('Codex not detected.')
    return result
  }

  const targetDir = options.targetDir ?? LEGNACODE_DIR

  // Read config
  let config: Record<string, unknown> | null = null
  if (agent.configPath.endsWith('.toml')) {
    try {
      const content = readFileSync(agent.configPath, 'utf-8')
      config = parseSimpleToml(content)
    } catch (e) {
      result.errors.push(`Failed to parse ${agent.configPath}: ${e}`)
      return result
    }
  } else {
    config = readJsonSafe(agent.configPath)
  }

  if (!config) {
    result.errors.push(`Failed to read config from ${agent.configPath}`)
    return result
  }

  if (options.dryRun) {
    // Preview mode — just report what would be imported
    if (config.model) result.imported.push('model configuration')
    if (config.mcp_servers || config.mcpServers) result.imported.push('MCP servers')
    if (config.exec_policy || config.execPolicy) result.imported.push('exec policy rules')
    return result
  }

  ensureDir(targetDir)

  // Import model config
  if (config.model) {
    const settingsPath = join(targetDir, 'settings.json')
    const existing = readJsonSafe(settingsPath) ?? {}
    if (!existing.model || options.force) {
      existing.model = config.model
      writeFileSync(settingsPath, JSON.stringify(existing, null, 2))
      result.imported.push('model configuration')
    } else {
      result.skipped.push('model configuration (already set)')
    }
  }

  // Import MCP servers
  const mcpServers = config.mcp_servers ?? config.mcpServers
  if (mcpServers && typeof mcpServers === 'object') {
    const mcpPath = join(targetDir, 'mcp-servers.json')
    const existing = readJsonSafe(mcpPath) ?? {}
    if (Object.keys(existing).length === 0 || options.force) {
      writeFileSync(mcpPath, JSON.stringify(mcpServers, null, 2))
      result.imported.push('MCP servers')
    } else {
      result.skipped.push('MCP servers (already configured)')
    }
  }

  return result
}
