/**
 * Cursor config importer — imports settings from Cursor IDE.
 *
 * Reads Cursor settings.json and maps MCP servers, model config,
 * and rules/instructions to LegnaCode equivalents.
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

export function importFromCursor(options: ImporterOptions = {}): MigrationResult {
  const result: MigrationResult = {
    agent: 'cursor',
    imported: [],
    skipped: [],
    errors: [],
  }

  const agent = detectAgent('cursor')
  if (!agent) {
    result.errors.push('Cursor not detected.')
    return result
  }

  const config = readJsonSafe(agent.configPath)
  if (!config) {
    result.errors.push(`Failed to read config from ${agent.configPath}`)
    return result
  }

  const targetDir = options.targetDir ?? LEGNACODE_DIR

  if (options.dryRun) {
    if (config['mcp.servers'] || config.mcpServers) result.imported.push('MCP servers')
    if (config['ai.model']) result.imported.push('model configuration')
    // Check for .cursorrules in project
    if (existsSync(join(process.cwd(), '.cursorrules'))) {
      result.imported.push('project rules → LEGNACODE.md')
    }
    return result
  }

  ensureDir(targetDir)

  // Import MCP servers
  const mcpServers = config['mcp.servers'] ?? config.mcpServers
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

  // Import model config
  const model = config['ai.model']
  if (model) {
    const settingsPath = join(targetDir, 'settings.json')
    const existing = readJsonSafe(settingsPath) ?? {}
    if (!existing.cursorModel || options.force) {
      existing.cursorModel = model
      writeFileSync(settingsPath, JSON.stringify(existing, null, 2))
      result.imported.push('model configuration')
    } else {
      result.skipped.push('model configuration (already set)')
    }
  }

  // Import .cursorrules → LEGNACODE.md
  const cursorRulesPath = join(process.cwd(), '.cursorrules')
  const legnacodeMdPath = join(process.cwd(), 'LEGNACODE.md')
  if (existsSync(cursorRulesPath)) {
    if (!existsSync(legnacodeMdPath) || options.force) {
      const rules = readFileSync(cursorRulesPath, 'utf-8')
      const content = `# Project Instructions\n\n> Imported from .cursorrules\n\n${rules}`
      writeFileSync(legnacodeMdPath, content)
      result.imported.push('project rules → LEGNACODE.md')
    } else {
      result.skipped.push('project rules (LEGNACODE.md already exists)')
    }
  }

  return result
}
