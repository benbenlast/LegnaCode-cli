/**
 * Sandbox TypeScript binding — wraps native Rust addon with TS fallback.
 *
 * Implements the same interface as `src/security/shellEscalation/sandboxWrapper.ts`
 * but prefers the Rust NAPI addon when available.
 */

import {
  sandboxAddon,
  hasNativeSandbox,
  type NativeSandboxConfig,
  type NativeSandboxResult,
} from './index.js'

export type SandboxLevel = 0 | 1 | 2 | 3

export interface SandboxExecOptions {
  mode: 'read-only' | 'workspace-write' | 'danger-full-access'
  writablePaths: string[]
  readablePaths: string[]
  networkPolicy: 'full' | 'limited' | 'blocked'
  envVars?: string[]
  protectedPaths?: string[]
}

export interface SandboxExecResult {
  exitCode: number
  stdout: string
  stderr: string
  sandboxLevel: string
}

/**
 * Detect the highest sandbox level available on this platform.
 *
 * - 3: Native kernel sandbox (bubblewrap / Seatbelt / RestrictedToken)
 * - 2: Network-only isolation (unshare --net)
 * - 1: Container-level (@anthropic-ai/sandbox-runtime)
 * - 0: No sandbox
 */
export function detectSandboxLevel(): SandboxLevel {
  if (hasNativeSandbox && sandboxAddon) {
    return sandboxAddon.detectSandboxLevel() as SandboxLevel
  }
  return 0
}

/**
 * Execute a command inside a sandbox.
 * Uses Rust native addon if available, otherwise falls back to direct execution.
 */
export async function sandboxExec(
  command: string,
  options: SandboxExecOptions,
): Promise<SandboxExecResult> {
  if (hasNativeSandbox && sandboxAddon) {
    const config: NativeSandboxConfig = {
      mode: options.mode,
      writable_paths: options.writablePaths,
      readable_paths: options.readablePaths,
      network_policy: options.networkPolicy,
      env_vars: options.envVars,
      protected_paths: options.protectedPaths,
    }

    const result: NativeSandboxResult = sandboxAddon.sandboxExec(command, config)
    return {
      exitCode: result.exit_code,
      stdout: result.stdout,
      stderr: result.stderr,
      sandboxLevel: result.sandbox_level,
    }
  }

  // Fallback: direct execution via child_process
  const { execSync } = await import('child_process')
  try {
    const stdout = execSync(command, {
      encoding: 'utf-8',
      timeout: 30_000,
      maxBuffer: 10 * 1024 * 1024,
    })
    return { exitCode: 0, stdout, stderr: '', sandboxLevel: '0-none-ts-fallback' }
  } catch (err: unknown) {
    const e = err as { status?: number; stdout?: string; stderr?: string }
    return {
      exitCode: e.status ?? 1,
      stdout: e.stdout ?? '',
      stderr: e.stderr ?? String(err),
      sandboxLevel: '0-none-ts-fallback',
    }
  }
}
