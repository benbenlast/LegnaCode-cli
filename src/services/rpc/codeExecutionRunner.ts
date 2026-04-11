/**
 * Code Execution Runner — spawn a child process with RPC tool access.
 *
 * Adapted from Hermes Agent's code_execution_tool.py.
 * Runs an AI-generated script in a sandboxed child process.
 * The script can call LegnaCode tools via RPC (Unix domain socket).
 */

import { spawn } from 'child_process'
import { writeFile, unlink, mkdir } from 'fs/promises'
import { join } from 'path'
import { tmpdir } from 'os'
import { randomUUID } from 'crypto'
import { logForDebugging } from '../../utils/debug.js'
import { RpcServer, type RpcServerOptions } from './rpcServer.js'
import { generateStubModule } from './stubGenerator.js'

const MAX_STDOUT_BYTES = 50_000
const MAX_STDERR_BYTES = 10_000
const DEFAULT_TIMEOUT_MS = 300_000

export interface CodeExecutionResult {
  stdout: string
  stderr: string
  exitCode: number | null
  toolCallCount: number
  timedOut: boolean
}

/**
 * Run a script with RPC tool access.
 * 1. Start UDS RPC server
 * 2. Write legna_tools.js stub + user script to temp dir
 * 3. Spawn child process with LEGNA_RPC_SOCKET env var
 * 4. Collect stdout/stderr, enforce timeout
 * 5. Clean up
 */
export async function executeCodeWithRpc(
  script: string,
  rpcOpts: RpcServerOptions,
  opts?: { timeout?: number; runtime?: 'node' | 'bun' },
): Promise<CodeExecutionResult> {
  const timeout = opts?.timeout ?? DEFAULT_TIMEOUT_MS
  const runtime = opts?.runtime ?? 'node'
  const sessionId = randomUUID().slice(0, 8)
  const workDir = join(tmpdir(), `legna-exec-${sessionId}`)

  await mkdir(workDir, { recursive: true })

  const rpcServer = new RpcServer(rpcOpts)
  const socketPath = await rpcServer.start()

  try {
    // Write stub module
    const stubCode = generateStubModule([
      'Bash', 'Read', 'Write', 'Edit', 'Glob', 'Grep', 'WebFetch',
    ])
    const stubPath = join(workDir, 'legna_tools.js')
    await writeFile(stubPath, stubCode, 'utf-8')

    // Write user script
    const scriptPath = join(workDir, 'script.js')
    await writeFile(scriptPath, script, 'utf-8')

    logForDebugging(`[codeExecution] Running script in ${workDir} with RPC at ${socketPath}`)

    // Spawn child
    const result = await new Promise<CodeExecutionResult>((resolve) => {
      let stdout = ''
      let stderr = ''
      let timedOut = false

      const child = spawn(runtime, [scriptPath], {
        cwd: workDir,
        env: {
          ...process.env,
          LEGNA_RPC_SOCKET: socketPath,
          NODE_PATH: workDir,
        },
        stdio: ['ignore', 'pipe', 'pipe'],
      })

      child.stdout.on('data', (chunk: Buffer) => {
        if (stdout.length < MAX_STDOUT_BYTES) {
          stdout += chunk.toString().slice(0, MAX_STDOUT_BYTES - stdout.length)
        }
      })

      child.stderr.on('data', (chunk: Buffer) => {
        if (stderr.length < MAX_STDERR_BYTES) {
          stderr += chunk.toString().slice(0, MAX_STDERR_BYTES - stderr.length)
        }
      })

      const timer = setTimeout(() => {
        timedOut = true
        child.kill('SIGKILL')
      }, timeout)

      child.on('close', (code) => {
        clearTimeout(timer)
        resolve({
          stdout,
          stderr,
          exitCode: code,
          toolCallCount: rpcServer.stats.toolCallCount,
          timedOut,
        })
      })
    })

    return result
  } finally {
    await rpcServer.stop()
    // Clean up temp files
    try {
      await unlink(join(workDir, 'legna_tools.js'))
      await unlink(join(workDir, 'script.js'))
      const { rmdir } = await import('fs/promises')
      await rmdir(workDir)
    } catch {
      // Best effort cleanup
    }
  }
}
