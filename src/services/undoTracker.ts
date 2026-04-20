/**
 * Undo Tracker — tracks file edits for /undo support.
 * Ported from AtomCode's undo system.
 *
 * Stores original content before each Edit/Write, enables single-step undo.
 * Stack is per-session, max 20 entries.
 */

import { writeFileSync, existsSync } from 'fs'
import { readFile, stat } from 'fs/promises'
import { logForDebugging } from '../utils/debug.js'

interface UndoEntry {
  filePath: string
  originalContent: string
  timestamp: number
  toolName: string
}

const MAX_UNDO_STACK = 20
const MAX_UNDO_FILE_SIZE = 1 * 1024 * 1024 // 1MB — skip undo for larger files
const undoStack: UndoEntry[] = []

/** Record file state before an edit. Call this BEFORE writing. */
export async function recordBeforeEdit(filePath: string, toolName: string): Promise<void> {
  try {
    if (!existsSync(filePath)) {
      undoStack.push({ filePath, originalContent: '', timestamp: Date.now(), toolName })
    } else {
      // Skip undo recording for files larger than 1MB to avoid OOM
      const st = await stat(filePath)
      if (st.size > MAX_UNDO_FILE_SIZE) {
        logForDebugging(`[undo] Skipping ${filePath} (${(st.size / 1024 / 1024).toFixed(1)}MB > 1MB limit)`)
        return
      }
      const content = await readFile(filePath, 'utf-8')
      undoStack.push({ filePath, originalContent: content, timestamp: Date.now(), toolName })
    }
    if (undoStack.length > MAX_UNDO_STACK) {
      undoStack.splice(0, undoStack.length - MAX_UNDO_STACK)
    }
  } catch (e) {
    logForDebugging(`[undo] Failed to record: ${e}`)
  }
}

/** Undo the last edit. Returns description of what was undone, or null. */
export function undoLastEdit(): string | null {
  const entry = undoStack.pop()
  if (!entry) return null

  try {
    if (entry.originalContent === '' && existsSync(entry.filePath)) {
      // File was newly created — delete it
      const { unlinkSync } = require('fs')
      unlinkSync(entry.filePath)
      return `Deleted ${entry.filePath} (was created by ${entry.toolName})`
    } else {
      writeFileSync(entry.filePath, entry.originalContent, 'utf-8')
      return `Restored ${entry.filePath} to state before ${entry.toolName}`
    }
  } catch (e) {
    return `Failed to undo ${entry.filePath}: ${e}`
  }
}

/** Get undo stack info */
export function getUndoInfo(): { count: number; lastFile?: string } {
  return {
    count: undoStack.length,
    lastFile: undoStack.length > 0 ? undoStack[undoStack.length - 1]!.filePath : undefined,
  }
}

/** Clear undo stack */
export function clearUndoStack(): void {
  undoStack.length = 0
}
