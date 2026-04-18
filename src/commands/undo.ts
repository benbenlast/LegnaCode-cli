/**
 * /undo command — reverts the last file edit.
 * Ported from AtomCode's undo support.
 */

import type { LocalCommandCall } from '../types/command.js'

const call: LocalCommandCall = async (_args, _context) => {
  const { undoLastEdit, getUndoInfo } = await import('../services/undoTracker.js')
  const info = getUndoInfo()

  if (info.count === 0) {
    return { type: 'local-result', result: 'Nothing to undo.' }
  }

  const result = undoLastEdit()
  return {
    type: 'local-result',
    result: result ?? 'Undo failed.',
  }
}

const undo = {
  type: 'local' as const,
  call,
  name: 'undo',
  description: 'Undo the last file edit',
  isEnabled: true,
  isHidden: false,
  progressMessage: 'undoing last edit',
  userFacingName() { return 'undo' },
}

export default undo
