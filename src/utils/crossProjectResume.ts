import { sep } from 'path'
import { getOriginalCwd } from '../bootstrap/state.js'
import type { LogOption } from '../types/logs.js'
import { quote } from './bash/shellQuote.js'
import { getSessionIdFromLog } from './sessionStorage.js'

export type CrossProjectResumeResult =
  | {
      isCrossProject: false
    }
  | {
      isCrossProject: true
      isSameRepoWorktree: true
      projectPath: string
    }
  | {
      isCrossProject: true
      isSameRepoWorktree: false
      command: string
      projectPath: string
    }

/**
 * Check if a log is from a different project directory and determine
 * whether it's a related worktree or a completely different project.
 *
 * For same-repo worktrees, we can resume directly without requiring cd.
 * For different projects, we generate the cd command.
 */
export function checkCrossProjectResume(
  log: LogOption,
  showAllProjects: boolean,
  worktreePaths: string[],
): CrossProjectResumeResult {
  const currentCwd = getOriginalCwd()
  // Resolve relative cwd from migrated sessions
  const sessionPath = log.projectPath === '.' ? currentCwd : log.projectPath

  if (!showAllProjects || !sessionPath || sessionPath === currentCwd) {
    return { isCrossProject: false }
  }

  // Gate worktree detection to ants only for staged rollout
  if (process.env.USER_TYPE !== 'ant') {
    const sessionId = getSessionIdFromLog(log)
    const command = `cd ${quote([sessionPath])} && legna --resume ${sessionId}`
    return {
      isCrossProject: true,
      isSameRepoWorktree: false,
      command,
      projectPath: sessionPath,
    }
  }

  // Check if sessionPath is under a worktree of the same repo
  const isSameRepo = worktreePaths.some(
    wt => sessionPath === wt || sessionPath!.startsWith(wt + sep),
  )

  if (isSameRepo) {
    return {
      isCrossProject: true,
      isSameRepoWorktree: true,
      projectPath: sessionPath,
    }
  }

  // Different repo - generate cd command
  const sessionId = getSessionIdFromLog(log)
  const command = `cd ${quote([sessionPath])} && legna --resume ${sessionId}`
  return {
    isCrossProject: true,
    isSameRepoWorktree: false,
    command,
    projectPath: sessionPath,
  }
}
