/**
 * Built-in statusline renderer — cross-platform, no external script needed.
 * Shows: directory │ git branch sync │ model │ context bar │ time
 */

import { execFile } from 'child_process'
import { promisify } from 'util'
import type { StatusLineCommandInput } from '../types/statusLine.js'

const execAsync = promisify(execFile)

// ── ANSI helpers ──
const R = '\x1b[0m'
const DIM = '\x1b[2m'
const CYAN = '\x1b[36m'
const GREEN = '\x1b[32m'
const YELLOW = '\x1b[33m'
const RED = '\x1b[31m'
const MAG = '\x1b[35m'
const BOLD = '\x1b[1m'

const SEP = ` ${DIM}\u2502${R} `

// ── Git info ──
async function gitInfo(cwd: string): Promise<{ branch: string; sync: string } | null> {
  try {
    let branch: string
    try {
      const r = await execAsync('git', ['--no-optional-locks', 'symbolic-ref', '--short', 'HEAD'], { cwd, timeout: 2000 })
      branch = r.stdout.trim()
    } catch {
      const r = await execAsync('git', ['--no-optional-locks', 'rev-parse', '--short', 'HEAD'], { cwd, timeout: 2000 })
      branch = r.stdout.trim()
    }
    if (!branch) return null

    let sync = ''
    try {
      const r = await execAsync('git', ['--no-optional-locks', 'rev-list', '--left-right', '--count', 'HEAD...@{upstream}'], { cwd, timeout: 2000 })
      const [a, b] = r.stdout.trim().split(/\s+/).map(Number)
      const p: string[] = []
      if (a && a > 0) p.push(`\u2191${a}`)
      if (b && b > 0) p.push(`\u2193${b}`)
      sync = p.length ? p.join('') : '\u2261'
    } catch { /* no upstream */ }

    return { branch, sync }
  } catch {
    return null
  }
}

// ── Friendly model name ──
function friendlyModel(id: string, display: string): string {
  const lo = id.toLowerCase()
  // Match common patterns: claude-opus-4-6, claude-sonnet-4-5, etc.
  const m = lo.match(/(?:claude[_-]?)?(opus|sonnet|haiku)[_-]?(\d+)[_-](\d+)/)
  if (m) {
    const family = m[1]!.charAt(0).toUpperCase() + m[1]!.slice(1)
    return `${family} ${m[2]}.${m[3]}`
  }
  const m2 = lo.match(/(?:claude[_-]?)?(opus|sonnet|haiku)[_-]?(\d+)/)
  if (m2) {
    const family = m2[1]!.charAt(0).toUpperCase() + m2[1]!.slice(1)
    return `${family} ${m2[2]}`
  }
  // display_name might already be friendly
  if (display.length <= 25) return display
  return display.slice(0, 22) + '...'
}

// ── Progress bar ──
function progressBar(pct: number, width: number = 12): string {
  const filled = Math.round((pct / 100) * width)
  const empty = width - filled
  let col: string
  if (pct < 50) col = GREEN
  else if (pct < 75) col = YELLOW
  else col = RED
  return `${col}${'\u2588'.repeat(filled)}${DIM}${'\u2591'.repeat(empty)}${R} ${col}${Math.round(pct)}%${R}`
}

// ── Short directory ──
function shortDir(cwd: string): string {
  const home = process.env.HOME || process.env.USERPROFILE || ''
  let d = cwd
  if (home && d.startsWith(home)) d = '~' + d.slice(home.length)
  if (d === '~') return '~'
  const parts = d.split(/[/\\]/)
  return parts[parts.length - 1] || d
}

// ── Main entry ──
export async function formatBuiltinStatusLine(input: StatusLineCommandInput): Promise<string> {
  const parts: string[] = []

  // Directory
  parts.push(`${CYAN}${shortDir(input.workspace.current_dir)}${R}`)

  // Git
  const gi = await gitInfo(input.workspace.current_dir)
  if (gi) {
    const sc = gi.sync === '\u2261' ? `${DIM}${gi.sync}` : `${YELLOW}${gi.sync}`
    parts.push(`${GREEN}${BOLD}${gi.branch}${R} ${sc}${R}`)
  }

  // Model
  parts.push(`${MAG}${friendlyModel(input.model.id, input.model.display_name)}${R}`)

  // Context
  const pct = input.context_window.used_percentage
  if (pct != null) {
    parts.push(progressBar(pct))
  }

  // Time
  const now = new Date()
  const hh = String(now.getHours()).padStart(2, '0')
  const mm = String(now.getMinutes()).padStart(2, '0')
  parts.push(`${DIM}${hh}:${mm}${R}`)

  return parts.join(SEP)
}
