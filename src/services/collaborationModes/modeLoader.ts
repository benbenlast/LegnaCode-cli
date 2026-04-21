/**
 * Mode loader — loads collaboration mode templates from disk.
 *
 * Sources (merge priority: project > custom > builtin):
 * 1. Built-in: src/services/collaborationModes/templates/*.md
 * 2. Custom:   ~/.legnacode/modes/*.md
 * 3. Project:  $CWD/.legnacode/modes/*.md
 */

import { readdirSync, readFileSync } from 'fs'
import { join } from 'path'
import { getClaudeConfigHomeDir } from '../../utils/envUtils.js'
import type { CollaborationMode, ModeMetadata } from './types.js'

// ── YAML frontmatter parser (minimal) ────────────────────────────────────

const FRONTMATTER_RE = /^---\n([\s\S]*?)\n---\n([\s\S]*)$/

function parseModeFile(content: string): { meta: ModeMetadata; body: string } | null {
  const match = content.match(FRONTMATTER_RE)
  if (!match) return null

  const yamlBlock = match[1]!
  const body = match[2]!.trim()

  const meta: Record<string, unknown> = {}
  for (const line of yamlBlock.split('\n')) {
    const colonIdx = line.indexOf(':')
    if (colonIdx === -1) continue
    const key = line.slice(0, colonIdx).trim()
    let val: unknown = line.slice(colonIdx + 1).trim()

    // Parse booleans
    if (val === 'true') val = true
    else if (val === 'false') val = false
    // Parse arrays: ["a", "b"]
    else if (typeof val === 'string' && val.startsWith('[')) {
      try { val = JSON.parse(val) } catch { /* keep as string */ }
    }
    // Strip quotes
    else if (typeof val === 'string' && val.startsWith('"') && val.endsWith('"')) {
      val = val.slice(1, -1)
    }

    meta[key] = val
  }

  return {
    meta: meta as unknown as ModeMetadata,
    body,
  }
}

function metadataToMode(meta: ModeMetadata, body: string): CollaborationMode {
  return {
    id: meta.id,
    name: meta.name ?? meta.id,
    description: meta.description ?? '',
    systemPromptTemplate: body,
    toolRestrictions: (meta.toolsAllowed || meta.toolsDenied)
      ? {
          allowed: meta.toolsAllowed,
          denied: meta.toolsDenied,
        }
      : undefined,
    behaviorFlags: {
      readOnly: meta.readOnly ?? false,
      autoExecute: meta.autoExecute ?? false,
      stepByStep: meta.stepByStep ?? false,
      requirePlan: meta.requirePlan ?? false,
    },
  }
}

// ── Loaders ──────────────────────────────────────────────────────────────

function loadModesFromDir(dir: string): CollaborationMode[] {
  const modes: CollaborationMode[] = []
  let files: string[]
  try {
    files = readdirSync(dir).filter(f => f.endsWith('.md'))
  } catch {
    return modes
  }

  for (const file of files) {
    try {
      const content = readFileSync(join(dir, file), 'utf-8')
      const parsed = parseModeFile(content)
      if (parsed) {
        modes.push(metadataToMode(parsed.meta, parsed.body))
      }
    } catch {
      // Skip malformed files
    }
  }

  return modes
}

/** Load built-in mode templates shipped with LegnaCode. */
export function loadBuiltinModes(): CollaborationMode[] {
  const templatesDir = new URL('./templates', import.meta.url).pathname
  return loadModesFromDir(templatesDir)
}

/** Load user-level custom modes from ~/.legnacode/modes/. */
export function loadCustomModes(): CollaborationMode[] {
  const configDir = getClaudeConfigHomeDir()
  return loadModesFromDir(join(configDir, 'modes'))
}

/** Load project-level modes from $CWD/.legnacode/modes/. */
export function loadProjectModes(): CollaborationMode[] {
  return loadModesFromDir(join(process.cwd(), '.legnacode', 'modes'))
}

/**
 * Load all modes with merge priority: project > custom > builtin.
 * Later entries override earlier ones by id.
 */
export function loadAllModes(): CollaborationMode[] {
  const byId = new Map<string, CollaborationMode>()

  for (const mode of loadBuiltinModes()) byId.set(mode.id, mode)
  for (const mode of loadCustomModes()) byId.set(mode.id, mode)
  for (const mode of loadProjectModes()) byId.set(mode.id, mode)

  return Array.from(byId.values())
}
