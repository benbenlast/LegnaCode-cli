/**
 * GitHub Copilot config importer.
 *
 * Imports copilot-instructions.md → LEGNACODE.md
 * and any MCP server configurations if present.
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

export function importFromCopilot(options: ImporterOptions = {}): MigrationResult {
  const result: MigrationResult = {
    agent: 'copilot',
    imported: [],
    skipped: [],
    errors: [],
  }

  const agent = detectAgent('copilot')
  // Copilot instructions can exist even without global config
  const instructionsPath = join(process.cwd(), '.github', 'copilot-instructions.md')
  const hasInstructions = existsSync(instructionsPath)

  if (!agent && !hasInstructions) {
    result.errors.push('GitHub Copilot not detected.')
    return result
  }

  const targetDir = options.targetDir ?? LEGNACODE_DIR

  if (options.dryRun) {
    if (hasInstructions) result.imported.push('copilot-instructions.md → LEGNACODE.md')
    return result
  }

  ensureDir(targetDir)

  // Import copilot-instructions.md → LEGNACODE.md
  if (hasInstructions) {
    const legnacodeMdPath = join(process.cwd(), 'LEGNACODE.md')
    if (!existsSync(legnacodeMdPath) || options.force) {
      const instructions = readFileSync(instructionsPath, 'utf-8')
      const content = `# Project Instructions\n\n> Imported from .github/copilot-instructions.md\n\n${instructions}`
      writeFileSync(legnacodeMdPath, content)
      result.imported.push('copilot-instructions.md → LEGNACODE.md')
    } else {
      result.skipped.push('copilot-instructions.md (LEGNACODE.md already exists)')
    }
  }

  return result
}
