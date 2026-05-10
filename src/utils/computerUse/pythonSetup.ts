/**
 * Python environment auto-management for Computer Use.
 * Detects system Python 3.12+, creates a venv, installs platform-specific
 * dependencies on first use. Subsequent calls are near-instant (marker check).
 */

import { execFile } from 'child_process'
import { existsSync } from 'fs'
import { mkdir, writeFile, readFile } from 'fs/promises'
import { join } from 'path'
import { promisify } from 'util'
import { logForDebugging } from '../debug.js'

const execFileAsync = promisify(execFile)

const VENV_DIR_NAME = 'computer-use-venv'
const SETUP_MARKER = '.setup-complete'
const MIN_PYTHON_MAJOR = 3
const MIN_PYTHON_MINOR = 12

function getVenvDir(): string {
  return join(
    process.env.HOME || process.env.USERPROFILE || '~',
    '.legna',
    VENV_DIR_NAME,
  )
}

function getRequirementsPath(): string {
  const suffix =
    process.platform === 'darwin' ? 'macos' :
    process.platform === 'win32' ? 'windows' : 'common'
  const filename = `requirements-${suffix}.txt`

  const candidates = [
    join(__dirname, '..', '..', '..', 'runtime', filename),
    join(process.cwd(), 'runtime', filename),
  ]
  if (process.env.LEGNA_RUNTIME_DIR) {
    candidates.unshift(join(process.env.LEGNA_RUNTIME_DIR, filename))
  }
  for (const p of candidates) {
    if (existsSync(p)) return p
  }
  // Fallback to legacy single file
  const legacy = join(__dirname, '..', '..', '..', 'runtime', 'requirements.txt')
  if (existsSync(legacy)) return legacy
  return candidates[0]!
}

/**
 * Probe a Python executable: returns { path, major, minor } or null.
 */
async function probePython(
  cmd: string,
): Promise<{ path: string; major: number; minor: number } | null> {
  try {
    const { stdout } = await execFileAsync(cmd, ['--version'], {
      timeout: 5_000,
    })
    const m = stdout.match(/Python (\d+)\.(\d+)/)
    if (!m) return null
    return { path: cmd, major: +m[1]!, minor: +m[2]! }
  } catch {
    return null
  }
}

/**
 * Find a system Python >= 3.12. Search order:
 *   1. LEGNA_PYTHON_BIN env var
 *   2. python3.14 .. python3.12 (explicit minor versions)
 *   3. python3, python
 *   4. Windows: py -3 launcher
 */
async function findPython(): Promise<string> {
  // Env override — trust the user
  if (process.env.LEGNA_PYTHON_BIN) {
    const p = await probePython(process.env.LEGNA_PYTHON_BIN)
    if (p && p.major >= MIN_PYTHON_MAJOR && p.minor >= MIN_PYTHON_MINOR) {
      return p.path
    }
    logForDebugging(
      `[computer-use] LEGNA_PYTHON_BIN=${process.env.LEGNA_PYTHON_BIN} is not Python ${MIN_PYTHON_MAJOR}.${MIN_PYTHON_MINOR}+, searching PATH`,
    )
  }

  const candidates: string[] = []

  // Explicit minor-version binaries (highest first)
  for (let minor = 14; minor >= MIN_PYTHON_MINOR; minor--) {
    candidates.push(`python3.${minor}`)
  }

  if (process.platform === 'win32') {
    candidates.push('python', 'python3', 'py')
  } else {
    candidates.push('python3', 'python')
  }

  for (const cmd of candidates) {
    const p = await probePython(cmd)
    if (p && p.major >= MIN_PYTHON_MAJOR && p.minor >= MIN_PYTHON_MINOR) {
      return p.path
    }
  }

  // Windows py launcher with version flag
  if (process.platform === 'win32') {
    const p = await probePython('py')
    if (p && p.major >= MIN_PYTHON_MAJOR && p.minor >= MIN_PYTHON_MINOR) {
      return 'py'
    }
  }

  throw new Error(
    `Python ${MIN_PYTHON_MAJOR}.${MIN_PYTHON_MINOR}+ not found. ` +
    `Install Python from https://www.python.org/downloads/ and ensure it is on your PATH.`,
  )
}

export function getVenvPythonPath(): string {
  const venvDir = getVenvDir()
  return process.platform === 'win32'
    ? join(venvDir, 'Scripts', 'python.exe')
    : join(venvDir, 'bin', 'python3')
}

export async function isComputerUseSetup(): Promise<boolean> {
  const marker = join(getVenvDir(), SETUP_MARKER)
  if (!existsSync(marker)) return false
  // Check if requirements changed since last setup
  try {
    const reqPath = getRequirementsPath()
    const currentReqs = await readFile(reqPath, 'utf8')
    const savedReqs = await readFile(marker, 'utf8')
    return currentReqs === savedReqs
  } catch {
    return false
  }
}

// In-flight setup promise — prevents concurrent setup races
let setupPromise: Promise<void> | null = null

/**
 * Ensure the Computer Use Python venv is ready. Safe to call repeatedly —
 * returns instantly after first successful setup (marker file check).
 * Concurrent calls coalesce into a single setup run.
 */
export async function ensurePythonEnv(
  onProgress?: (msg: string) => void,
): Promise<void> {
  if (await isComputerUseSetup()) return
  if (setupPromise) return setupPromise
  setupPromise = doSetup(onProgress).finally(() => { setupPromise = null })
  return setupPromise
}

async function doSetup(onProgress?: (msg: string) => void): Promise<void> {
  const venvDir = getVenvDir()
  const marker = join(venvDir, SETUP_MARKER)

  const log = (msg: string) => {
    logForDebugging(`[computer-use] ${msg}`)
    onProgress?.(msg)
  }

  log('Detecting Python...')
  const python = await findPython()
  log(`Found ${python}`)

  await mkdir(venvDir, { recursive: true })

  const venvPython = getVenvPythonPath()

  if (!existsSync(venvPython)) {
    log('Creating virtual environment...')
    await execFileAsync(python, ['-m', 'venv', venvDir], {
      timeout: 60_000,
    })
  }

  log('Installing dependencies...')
  const reqPath = getRequirementsPath()
  const pip = process.platform === 'win32'
    ? join(venvDir, 'Scripts', 'pip.exe')
    : join(venvDir, 'bin', 'pip3')

  await execFileAsync(pip, ['install', '-r', reqPath, '--quiet'], {
    timeout: 300_000,
    env: { ...process.env, PYTHONDONTWRITEBYTECODE: '1' },
  })

  // Write marker with requirements content for invalidation
  const reqContent = await readFile(reqPath, 'utf8').catch(() => '')
  await writeFile(marker, reqContent, 'utf8')

  log('Computer Use environment ready')
}
