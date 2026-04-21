/**
 * CLI rollback command — restore files to a previous checkpoint.
 *
 * Leverages the existing fileHistory infrastructure (snapshots, backups)
 * to provide a user-facing rollback experience:
 *
 *   rollback()              — list recent rollback points
 *   rollback(target)        — rollback to a specific point
 *   rollback(_, {list})     — list all rollback points
 *   rollback(_, {dryRun})   — preview what would change
 *   rollback(_, {safe})     — create git backup branch before rollback
 */

import { execSync } from 'child_process'
import type { UUID } from 'crypto'
import { getOriginalCwd } from '../bootstrap/state.js'
import {
  type DiffStats,
  type FileHistorySnapshot,
  type FileHistoryState,
  fileHistoryCanRestore,
  fileHistoryEnabled,
  fileHistoryGetDiffStats,
  fileHistoryRewind,
} from '../utils/fileHistory.js'
import { logForDebugging } from '../utils/debug.js'

// ── Types ────────────────────────────────────────────────────────────────

export interface RollbackPoint {
  index: number
  messageId: UUID
  timestamp: Date
  fileCount: number
  files: string[]
}

export interface RollbackOptions {
  list?: boolean
  dryRun?: boolean
  safe?: boolean
}

export interface RollbackResult {
  success: boolean
  message: string
  rollbackPoints?: RollbackPoint[]
  diffStats?: DiffStats
  backupBranch?: string
}

// ── Helpers ──────────────────────────────────────────────────────────────

function snapshotToRollbackPoint(
  snapshot: FileHistorySnapshot,
  index: number,
): RollbackPoint {
  const files = Object.keys(snapshot.trackedFileBackups)
  return {
    index,
    messageId: snapshot.messageId,
    timestamp: new Date(snapshot.timestamp),
    fileCount: files.length,
    files,
  }
}

function formatRollbackPoint(point: RollbackPoint): string {
  const ts = point.timestamp.toLocaleString()
  const idShort = point.messageId.slice(0, 8)
  return `  #${point.index}  ${idShort}  ${ts}  (${point.fileCount} files)`
}

function createGitBackupBranch(): string | null {
  const cwd = getOriginalCwd()
  const branchName = `legnacode-backup-${Date.now()}`
  try {
    execSync('git rev-parse --is-inside-work-tree', { cwd, encoding: 'utf-8' })
    execSync(`git checkout -b ${branchName}`, { cwd, encoding: 'utf-8' })
    execSync('git add -A && git commit -m "LegnaCode rollback backup" --allow-empty', {
      cwd,
      encoding: 'utf-8',
    })
    execSync('git checkout -', { cwd, encoding: 'utf-8' })
    return branchName
  } catch {
    return null
  }
}

// ── Main ─────────────────────────────────────────────────────────────────

/**
 * Execute a rollback operation.
 *
 * @param target - Message ID prefix or rollback point index (e.g. "#3" or "a1b2c3d4")
 * @param options - Control flags
 * @param fileHistoryState - Current file history state (injected by caller)
 * @param updateFileHistoryState - State updater function (injected by caller)
 */
export async function rollback(
  target?: string,
  options?: RollbackOptions,
  fileHistoryState?: FileHistoryState,
  updateFileHistoryState?: (updater: (prev: FileHistoryState) => FileHistoryState) => void,
): Promise<RollbackResult> {
  if (!fileHistoryEnabled()) {
    return {
      success: false,
      message: 'File checkpointing is disabled. Enable it in settings to use rollback.',
    }
  }

  if (!fileHistoryState || !updateFileHistoryState) {
    return {
      success: false,
      message: 'Rollback requires an active session with file history state.',
    }
  }

  const snapshots = fileHistoryState.snapshots
  if (snapshots.length === 0) {
    return {
      success: false,
      message: 'No rollback points available. File changes will create rollback points automatically.',
    }
  }

  // ── List mode ──────────────────────────────────────────────────────
  if (options?.list || !target) {
    const limit = options?.list ? snapshots.length : Math.min(20, snapshots.length)
    const points = snapshots
      .slice(-limit)
      .map((s, i) => snapshotToRollbackPoint(s, snapshots.length - limit + i + 1))
      .reverse()

    const lines = [
      `${points.length} rollback point${points.length === 1 ? '' : 's'} available:`,
      '',
      ...points.map(formatRollbackPoint),
      '',
      'Usage: rollback <index> or rollback <message-id-prefix>',
    ]

    return { success: true, message: lines.join('\n'), rollbackPoints: points }
  }

  // ── Resolve target ─────────────────────────────────────────────────
  let targetSnapshot: FileHistorySnapshot | undefined

  // Try as index (e.g. "#3" or "3")
  const indexStr = target.startsWith('#') ? target.slice(1) : target
  const index = parseInt(indexStr, 10)
  if (!isNaN(index) && index >= 1 && index <= snapshots.length) {
    targetSnapshot = snapshots[index - 1]
  }

  // Try as message ID prefix
  if (!targetSnapshot) {
    const prefix = target.toLowerCase()
    targetSnapshot = snapshots.findLast(s =>
      s.messageId.toLowerCase().startsWith(prefix),
    )
  }

  if (!targetSnapshot) {
    return {
      success: false,
      message: `No rollback point found matching "${target}". Use rollback --list to see available points.`,
    }
  }

  const messageId = targetSnapshot.messageId

  // ── Dry-run mode ───────────────────────────────────────────────────
  if (options?.dryRun) {
    const diffStats = await fileHistoryGetDiffStats(fileHistoryState, messageId)
    const files = diffStats?.filesChanged ?? []
    const lines = [
      `Dry run — rollback to ${messageId.slice(0, 8)} would:`,
      `  ${files.length} file${files.length === 1 ? '' : 's'} changed`,
      `  +${diffStats?.insertions ?? 0} / -${diffStats?.deletions ?? 0} lines`,
    ]
    if (files.length > 0) {
      lines.push('', '  Files:', ...files.map(f => `    ${f}`))
    }
    return { success: true, message: lines.join('\n'), diffStats }
  }

  // ── Safe mode: create git backup branch ────────────────────────────
  let backupBranch: string | undefined
  if (options?.safe) {
    const branch = createGitBackupBranch()
    if (branch) {
      backupBranch = branch
      logForDebugging(`[rollback] Created backup branch: ${branch}`)
    } else {
      return {
        success: false,
        message: 'Failed to create git backup branch. Are you in a git repository?',
      }
    }
  }

  // ── Execute rollback ───────────────────────────────────────────────
  if (!fileHistoryCanRestore(fileHistoryState, messageId)) {
    return {
      success: false,
      message: `Cannot restore to ${messageId.slice(0, 8)} — snapshot data is missing or corrupted.`,
    }
  }

  try {
    await fileHistoryRewind(updateFileHistoryState, messageId)
    const msg = backupBranch
      ? `Rolled back to ${messageId.slice(0, 8)}. Backup branch: ${backupBranch}`
      : `Rolled back to ${messageId.slice(0, 8)}.`
    return { success: true, message: msg, backupBranch }
  } catch (error) {
    const errMsg = error instanceof Error ? error.message : String(error)
    return { success: false, message: `Rollback failed: ${errMsg}` }
  }
}
