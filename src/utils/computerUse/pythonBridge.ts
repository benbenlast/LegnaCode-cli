/**
 * Shared Python bridge caller. Extracted so both executor.ts and
 * hostAdapter.ts can call Python without duplicating the spawn logic.
 *
 * On first invocation, automatically ensures the venv is set up
 * (creates venv + installs deps if needed). Subsequent calls skip
 * the check via a process-lifetime flag.
 */

import { execFile } from 'child_process'
import { join } from 'path'
import { promisify } from 'util'
import { errorMessage } from '../errors.js'
import { logForDebugging } from '../debug.js'
import { ensurePythonEnv, getVenvPythonPath } from './pythonSetup.js'

const execFileAsync = promisify(execFile)

let envReady = false

function getHelperPath(): string {
  const platform = process.platform === 'win32' ? 'win_helper.py' : 'mac_helper.py'
  const candidates = [
    join(__dirname, '..', '..', '..', 'runtime', platform),
    join(process.cwd(), 'runtime', platform),
  ]
  if (process.env.LEGNA_RUNTIME_DIR) {
    candidates.unshift(join(process.env.LEGNA_RUNTIME_DIR, platform))
  }
  return candidates[0]!
}

function getPythonBin(): string {
  return process.env.LEGNA_PYTHON_BIN || getVenvPythonPath()
}

export async function callPythonBridge<T = unknown>(
  command: string,
  payload: Record<string, unknown> = {},
): Promise<T> {
  // Auto-setup on first call — near-instant if already done
  if (!envReady) {
    await ensurePythonEnv((msg) => logForDebugging(`[python-bridge] ${msg}`))
    envReady = true
  }

  const helper = getHelperPath()
  const python = getPythonBin()
  const payloadJson = JSON.stringify(payload)

  try {
    const { stdout } = await execFileAsync(python, [helper, command, '--payload', payloadJson], {
      timeout: 30_000,
      maxBuffer: 50 * 1024 * 1024,
      env: { ...process.env, PYTHONDONTWRITEBYTECODE: '1' },
    })
    const result = JSON.parse(stdout.trim())
    if (!result.ok) {
      throw new Error(result.error || `Python bridge command '${command}' failed`)
    }
    return result.result as T
  } catch (err: any) {
    if (err.killed) throw new Error(`Python bridge '${command}' timed out`)
    if (err.code === 'ENOENT') {
      // venv might be corrupted — reset flag so next call retries setup
      envReady = false
      throw new Error(
        `Python not found at ${python}. The venv may be corrupted — ` +
        `delete ~/.legna/computer-use-venv and retry.`,
      )
    }
    throw new Error(`Python bridge '${command}' failed: ${errorMessage(err)}`)
  }
}
