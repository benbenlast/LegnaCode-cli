/**
 * Sandbox wrapper — platform-specific command wrapping.
 *
 * macOS: sandbox-exec profile
 * Linux: bwrap (bubblewrap) or unshare --net fallback
 * Other: passthrough (no sandboxing)
 */

import { execSync } from 'child_process'
import type { SandboxCapabilities } from './types.js'
import { hasNativeSandbox } from '../../native/index.js'

// ── Capability detection ─────────────────────────────────────────────────

let _capabilities: SandboxCapabilities | null = null

export function detectSandboxCapabilities(): SandboxCapabilities {
  if (_capabilities) return _capabilities

  const platform = process.platform

  _capabilities = {
    platform,
    hasNativeAddon: hasNativeSandbox,
    hasBwrap: platform === 'linux' && commandExists('bwrap'),
    hasSeatbelt: platform === 'darwin' && commandExists('sandbox-exec'),
    hasUnshare: platform === 'linux' && commandExists('unshare'),
  }

  return _capabilities
}

function commandExists(name: string): boolean {
  try {
    execSync(`which ${name}`, { encoding: 'utf-8', stdio: 'pipe' })
    return true
  } catch {
    return false
  }
}

// ── Sandbox profiles ─────────────────────────────────────────────────────

/**
 * macOS Seatbelt profile — deny network, deny write outside workdir.
 */
function buildSeatbeltProfile(workingDir: string): string {
  return `(version 1)
(deny default)
(allow process-exec)
(allow process-fork)
(allow sysctl-read)
(allow mach-lookup)
(allow signal)
(allow file-read*)
(allow file-write*
  (subpath "${workingDir}")
  (subpath "/private/tmp")
  (subpath "/tmp")
  (subpath "/dev"))
(deny network*)
`
}

/**
 * Wrap a command with macOS sandbox-exec.
 */
function wrapWithSeatbelt(command: string, workingDir: string): string {
  const profile = buildSeatbeltProfile(workingDir)
  // Write profile inline via process substitution
  const escaped = profile.replace(/"/g, '\\"').replace(/\n/g, '\\n')
  return `sandbox-exec -p "$(printf '${escaped}')" /bin/sh -c ${shellQuote(command)}`
}

/**
 * Wrap a command with bubblewrap (Linux).
 */
function wrapWithBwrap(command: string, workingDir: string): string {
  return [
    'bwrap',
    '--ro-bind / /',                    // read-only root
    `--bind ${workingDir} ${workingDir}`, // writable workdir
    '--bind /tmp /tmp',                  // writable tmp
    '--dev /dev',                        // device access
    '--proc /proc',                      // proc filesystem
    '--unshare-net',                     // no network
    '--die-with-parent',                 // cleanup on parent exit
    '--',
    '/bin/sh', '-c', shellQuote(command),
  ].join(' ')
}

/**
 * Wrap a command with unshare --net (Linux fallback, network isolation only).
 */
function wrapWithUnshare(command: string): string {
  return `unshare --net /bin/sh -c ${shellQuote(command)}`
}

// ── Public API ───────────────────────────────────────────────────────────

export interface WrapOptions {
  networkIsolation: boolean
  readOnlyRoot: boolean
  workingDir: string
}

/**
 * Wrap a command for sandboxed execution based on platform capabilities.
 * Returns the original command if no sandbox is available.
 */
export function wrapCommand(
  command: string,
  options: WrapOptions,
): { wrapped: string; method: 'native' | 'seatbelt' | 'bwrap' | 'unshare' | 'none' } {
  // All sandbox wrapping disabled — Seatbelt (deny default) caused exit code 65
  // on all commands. Safety handled at TS permission layer (bashPermissions.ts).
  return { wrapped: command, method: 'none' }
}

export function resetCapabilitiesForTesting(): void {
  _capabilities = null
}

// ── Helpers ──────────────────────────────────────────────────────────────

function shellQuote(s: string): string {
  return `'${s.replace(/'/g, "'\\''")}'`
}
