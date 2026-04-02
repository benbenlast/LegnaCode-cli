import { DIAMOND_FILLED, DIAMOND_OPEN } from '../constants/figures.js'
import { count } from '../utils/array.js'
import { t, tf } from '../utils/i18n.js'
import type { BackgroundTaskState } from './types.js'

/**
 * Produces the compact footer-pill label for a set of background tasks.
 * Used by both the footer pill and the turn-duration transcript line so the
 * two surfaces agree on terminology.
 */
export function getPillLabel(tasks: BackgroundTaskState[]): string {
  const n = tasks.length
  const allSameType = tasks.every(tk => tk.type === tasks[0]!.type)

  if (allSameType) {
    switch (tasks[0]!.type) {
      case 'local_bash': {
        const monitors = count(
          tasks,
          tk => tk.type === 'local_bash' && tk.kind === 'monitor',
        )
        const shells = n - monitors
        const parts: string[] = []
        if (shells > 0)
          parts.push(shells === 1 ? t('1 shell') : tf('{0} shells', String(shells)))
        if (monitors > 0)
          parts.push(monitors === 1 ? t('1 monitor') : tf('{0} monitors', String(monitors)))
        return parts.join(', ')
      }
      case 'in_process_teammate': {
        const teamCount = new Set(
          tasks.map(tk =>
            tk.type === 'in_process_teammate' ? tk.identity.teamName : '',
          ),
        ).size
        return teamCount === 1 ? t('1 team') : tf('{0} teams', String(teamCount))
      }
      case 'local_agent':
        return n === 1 ? t('1 local agent') : tf('{0} local agents', String(n))
      case 'remote_agent': {
        const first = tasks[0]!
        // Per design mockup: ◇ open diamond while running/needs-input,
        // ◆ filled once ExitPlanMode is awaiting approval.
        if (n === 1 && first.type === 'remote_agent' && first.isUltraplan) {
          switch (first.ultraplanPhase) {
            case 'plan_ready':
              return `${DIAMOND_FILLED} ${t('ultraplan ready')}`
            case 'needs_input':
              return `${DIAMOND_OPEN} ${t('ultraplan needs your input')}`
            default:
              return `${DIAMOND_OPEN} ${t('ultraplan')}`
          }
        }
        return n === 1
          ? `${DIAMOND_OPEN} ${t('1 cloud session')}`
          : `${DIAMOND_OPEN} ${tf('{0} cloud sessions', String(n))}`
      }
      case 'local_workflow':
        return n === 1 ? t('1 background workflow') : tf('{0} background workflows', String(n))
      case 'monitor_mcp':
        return n === 1 ? t('1 monitor') : tf('{0} monitors', String(n))
      case 'dream':
        return t('dreaming')
    }
  }

  return n === 1 ? tf('{0} background task', String(n)) : tf('{0} background tasks', String(n))
}

/**
 * True when the pill should show the dimmed " · ↓ to view" call-to-action.
 * Per the state diagram: only the two attention states (needs_input,
 * plan_ready) surface the CTA; plain running shows just the diamond + label.
 */
export function pillNeedsCta(tasks: BackgroundTaskState[]): boolean {
  if (tasks.length !== 1) return false
  const tk = tasks[0]!
  return (
    tk.type === 'remote_agent' &&
    tk.isUltraplan === true &&
    tk.ultraplanPhase !== undefined
  )
}
