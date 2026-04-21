/**
 * `legna migrate` — migrate sessions and config from ~/.claude to project-local .legna/
 *
 * Flags:
 *   --global    Migrate global data ~/.claude/ → ~/.legna/
 *   --sessions  Migrate current project sessions to .legna/sessions/
 *   --agents    Import config from other AI tools (Codex, Cursor, Copilot)
 *   --all       All of the above (default)
 *   --dry-run   Preview only, no writes
 *   --force     Overwrite existing config during agent import
 */

import { copyFileSync, existsSync, mkdirSync, readdirSync } from 'fs'
import { homedir } from 'os'
import { join } from 'path'
import type { LocalCommandCall } from '../../types/command.js'
import { getClaudeConfigHomeDir } from '../../utils/envUtils.js'
import { sanitizePath } from '../../utils/sessionStoragePortable.js'

// biome-ignore-all lint/suspicious/noConsole: CLI command uses console intentionally

interface MigrateStats {
  files: number
  dirs: number
  skipped: number
}

function copyDirRecursive(
  src: string,
  dst: string,
  dryRun: boolean,
  stats: MigrateStats,
): void {
  if (!existsSync(src)) return
  if (!dryRun) mkdirSync(dst, { recursive: true })
  stats.dirs++

  for (const entry of readdirSync(src, { withFileTypes: true })) {
    const srcPath = join(src, entry.name)
    const dstPath = join(dst, entry.name)
    if (entry.isDirectory()) {
      copyDirRecursive(srcPath, dstPath, dryRun, stats)
    } else if (existsSync(dstPath)) {
      stats.skipped++
    } else {
      if (!dryRun) copyFileSync(srcPath, dstPath)
      stats.files++
    }
  }
}

function migrateGlobal(dryRun: boolean): MigrateStats {
  const stats: MigrateStats = { files: 0, dirs: 0, skipped: 0 }
  const src = join(homedir(), '.claude')
  const dst = getClaudeConfigHomeDir()

  if (src === dst) {
    console.log('  Global config already points to the target directory, skipping.')
    return stats
  }

  if (!existsSync(src)) {
    console.log('  ~/.claude/ does not exist, nothing to migrate.')
    return stats
  }

  const label = dryRun ? '[dry-run] ' : ''

  // Copy key files/dirs (settings, credentials, etc.) but NOT projects/
  const entries = readdirSync(src, { withFileTypes: true })
  for (const entry of entries) {
    // Skip projects — handled by session migration
    if (entry.name === 'projects') continue
    const srcPath = join(src, entry.name)
    const dstPath = join(dst, entry.name)

    if (entry.isDirectory()) {
      console.log(`  ${label}dir:  ${entry.name}/`)
      copyDirRecursive(srcPath, dstPath, dryRun, stats)
    } else if (existsSync(dstPath)) {
      console.log(`  ${label}skip: ${entry.name} (already exists)`)
      stats.skipped++
    } else {
      console.log(`  ${label}copy: ${entry.name}`)
      if (!dryRun) {
        mkdirSync(dst, { recursive: true })
        copyFileSync(srcPath, dstPath)
      }
      stats.files++
    }
  }

  return stats
}

function migrateSessions(cwd: string, dryRun: boolean): MigrateStats {
  const stats: MigrateStats = { files: 0, dirs: 0, skipped: 0 }
  const sanitized = sanitizePath(cwd)
  const label = dryRun ? '[dry-run] ' : ''
  const localSessionsDir = join(cwd, '.legna', 'sessions')

  // Sources to scan: ~/.legna/projects/<sanitized>/ and ~/.claude/projects/<sanitized>/
  const sources: Array<{ tag: string; dir: string }> = []

  const legnaProjects = join(getClaudeConfigHomeDir(), 'projects', sanitized)
  if (existsSync(legnaProjects)) {
    sources.push({ tag: '~/.legna/projects', dir: legnaProjects })
  }

  const claudeProjects = join(homedir(), '.claude', 'projects', sanitized)
  if (existsSync(claudeProjects)) {
    sources.push({ tag: '~/.claude/projects', dir: claudeProjects })
  }

  if (sources.length === 0) {
    console.log('  No session directories found for this project.')
    return stats
  }

  if (!dryRun) mkdirSync(localSessionsDir, { recursive: true })

  for (const { tag, dir } of sources) {
    console.log(`  Scanning ${tag}/`)
    const entries = readdirSync(dir, { withFileTypes: true })
    for (const entry of entries) {
      const srcPath = join(dir, entry.name)
      const dstPath = join(localSessionsDir, entry.name)

      if (entry.isDirectory()) {
        // Sub-agent transcripts
        console.log(`  ${label}dir:  ${entry.name}/`)
        copyDirRecursive(srcPath, dstPath, dryRun, stats)
      } else if (entry.name.endsWith('.jsonl')) {
        if (existsSync(dstPath)) {
          stats.skipped++
        } else {
          console.log(`  ${label}copy: ${entry.name}`)
          if (!dryRun) copyFileSync(srcPath, dstPath)
          stats.files++
        }
      }
    }
  }

  return stats
}

function migrateAgentConfigs(dryRun: boolean, force: boolean): { imported: number; skipped: number; errors: number } {
  const totals = { imported: 0, skipped: 0, errors: 0 }

  let AgentConfigMigrator: typeof import('../../utils/agentConfigMigration/index.js').AgentConfigMigrator
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    AgentConfigMigrator = require('../../utils/agentConfigMigration/index.js').AgentConfigMigrator
  } catch {
    console.log('  Agent config migration module not available.')
    return totals
  }

  const migrator = new AgentConfigMigrator()
  const detected = migrator.detect()

  if (detected.length === 0) {
    console.log('  No external AI coding tools detected.')
    return totals
  }

  console.log(`  Detected: ${detected.map(a => a.name).join(', ')}`)

  for (const agent of detected) {
    const supported = migrator.listSupportedAgents()
    if (!supported.includes(agent.name)) {
      console.log(`  ${agent.name}: no importer available (skipped)`)
      continue
    }

    if (dryRun) {
      const preview = migrator.preview(agent.name)
      if (preview.imported.length) {
        console.log(`  ${agent.name} [dry-run]: would import ${preview.imported.join(', ')}`)
        totals.imported += preview.imported.length
      }
    } else {
      const result = migrator.import(agent.name, { force })
      if (result.imported.length) {
        console.log(`  ${agent.name}: imported ${result.imported.join(', ')}`)
        totals.imported += result.imported.length
      }
      if (result.skipped.length) {
        console.log(`  ${agent.name}: skipped ${result.skipped.join(', ')}`)
        totals.skipped += result.skipped.length
      }
      if (result.errors.length) {
        console.log(`  ${agent.name}: errors — ${result.errors.join(', ')}`)
        totals.errors += result.errors.length
      }
    }
  }

  return totals
}

export async function runMigrate(args: string[]): Promise<void> {
  const dryRun = args.includes('--dry-run')
  const force = args.includes('--force')
  const wantGlobal = args.includes('--global')
  const wantSessions = args.includes('--sessions')
  const wantAgents = args.includes('--agents')
  const wantAll = args.includes('--all') || (!wantGlobal && !wantSessions && !wantAgents)

  const cwd = process.cwd()
  const steps = (wantAll ? 3 : [wantGlobal, wantSessions, wantAgents].filter(Boolean).length)
  let step = 0

  console.log(`\nLegnaCode Migrate${dryRun ? ' (dry-run)' : ''}\n`)

  let totalFiles = 0
  let totalSkipped = 0

  if (wantAll || wantGlobal) {
    step++
    console.log(`[${step}/${steps}] Global config migration (~/.claude/ → ~/.legna/)`)
    const gs = migrateGlobal(dryRun)
    totalFiles += gs.files
    totalSkipped += gs.skipped
    console.log()
  }

  if (wantAll || wantSessions) {
    step++
    console.log(`[${step}/${steps}] Session migration → ${join(cwd, '.legna', 'sessions')}/`)
    const ss = migrateSessions(cwd, dryRun)
    totalFiles += ss.files
    totalSkipped += ss.skipped
    console.log()
  }

  if (wantAll || wantAgents) {
    step++
    console.log(`[${step}/${steps}] External agent config import`)
    const as_ = migrateAgentConfigs(dryRun, force)
    totalFiles += as_.imported
    totalSkipped += as_.skipped
    console.log()
  }

  console.log(`Done. ${totalFiles} file(s) copied/imported, ${totalSkipped} skipped.`)
  if (dryRun) {
    console.log('(dry-run mode — no files were actually written)')
  }
}

/** Slash-command entry point: /migrate [args] */
export const call: LocalCommandCall = async (args) => {
  const tokens = args.trim().split(/\s+/).filter(Boolean)
  await runMigrate(tokens)
  return { type: 'text', value: '' }
}
