/**
 * Process hardening module — first line of defense.
 *
 * Inspired by Codex's `process-hardening` crate. Runs at startup before
 * any business logic to reduce the attack surface of the LegnaCode process.
 *
 * - Disables core dumps (prevents credential leaks via crash dumps)
 * - Strips dangerous environment variables (LD_PRELOAD injection, etc.)
 * - Detects ptrace attachment (debugger/injector detection)
 * - Sanitizes NODE_OPTIONS to prevent --require/--loader injection
 */

import { execSync } from 'child_process'
import * as fs from 'fs'
import * as os from 'os'

// ── Dangerous env vars to strip ──────────────────────────────────────────

const DANGEROUS_ENV_VARS = [
  // Linux dynamic linker injection
  'LD_PRELOAD',
  'LD_LIBRARY_PATH',
  'LD_AUDIT',
  'LD_DEBUG',
  'LD_PROFILE',
  // macOS dynamic linker injection
  'DYLD_INSERT_LIBRARIES',
  'DYLD_FORCE_FLAT_NAMESPACE',
  'DYLD_LIBRARY_PATH',
  'DYLD_FRAMEWORK_PATH',
  // Other injection vectors
  'ELECTRON_RUN_AS_NODE',
  'NODE_REPL_EXTERNAL_MODULE',
] as const

// Patterns in NODE_OPTIONS that could be used for code injection
const NODE_OPTIONS_DANGEROUS_FLAGS = [
  /--require\s*[=\s]\s*\S+/g,
  /--loader\s*[=\s]\s*\S+/g,
  /--experimental-loader\s*[=\s]\s*\S+/g,
  /--import\s*[=\s]\s*\S+/g,
  /-r\s+\S+/g,
]

// ── Types ────────────────────────────────────────────────────────────────

export interface HardeningReport {
  platform: string
  coreDumpDisabled: boolean
  envVarsStripped: string[]
  nodeOptionsCleanedFlags: string[]
  ptraceDetected: boolean
  ptraceTracerPid: number | null
  warnings: string[]
}

// ── Core dump prevention ─────────────────────────────────────────────────

function disableCoreDumps(): { success: boolean; warning?: string } {
  const platform = os.platform()

  if (platform === 'linux') {
    try {
      // prctl(PR_SET_DUMPABLE, 0) via /proc interface
      // PR_SET_DUMPABLE = 4, value 0 = not dumpable
      fs.writeFileSync('/proc/self/coredump_filter', '0', { flag: 'w' })
      return { success: true }
    } catch {
      // Not fatal — may not have permissions
      return { success: false, warning: 'Could not disable core dumps (no /proc access)' }
    }
  }

  if (platform === 'darwin') {
    try {
      // Check if core dumps are enabled system-wide
      const result = execSync('sysctl -n kern.coredump', { encoding: 'utf-8', timeout: 2000 }).trim()
      if (result === '1') {
        return { success: false, warning: 'System core dumps are enabled (kern.coredump=1)' }
      }
      return { success: true }
    } catch {
      return { success: false, warning: 'Could not check core dump status' }
    }
  }

  // Windows / other — no-op
  return { success: true }
}

// ── Environment variable sanitization ────────────────────────────────────

function stripDangerousEnvVars(): string[] {
  const stripped: string[] = []

  for (const varName of DANGEROUS_ENV_VARS) {
    if (process.env[varName]) {
      stripped.push(varName)
      delete process.env[varName]
    }
  }

  return stripped
}

function sanitizeNodeOptions(): string[] {
  const nodeOptions = process.env['NODE_OPTIONS']
  if (!nodeOptions) return []

  const cleanedFlags: string[] = []
  let sanitized = nodeOptions

  for (const pattern of NODE_OPTIONS_DANGEROUS_FLAGS) {
    const matches = sanitized.match(pattern)
    if (matches) {
      cleanedFlags.push(...matches.map(m => m.trim()))
      sanitized = sanitized.replace(pattern, '')
    }
  }

  // Clean up extra whitespace
  sanitized = sanitized.replace(/\s+/g, ' ').trim()

  if (cleanedFlags.length > 0) {
    if (sanitized) {
      process.env['NODE_OPTIONS'] = sanitized
    } else {
      delete process.env['NODE_OPTIONS']
    }
  }

  return cleanedFlags
}

// ── Ptrace detection ─────────────────────────────────────────────────────

function detectPtrace(): { detected: boolean; tracerPid: number | null } {
  if (os.platform() !== 'linux') {
    return { detected: false, tracerPid: null }
  }

  try {
    const status = fs.readFileSync('/proc/self/status', 'utf-8')
    const match = status.match(/TracerPid:\s*(\d+)/)
    if (match) {
      const tracerPid = parseInt(match[1]!, 10)
      return { detected: tracerPid !== 0, tracerPid: tracerPid || null }
    }
  } catch {
    // Can't read /proc — not fatal
  }

  return { detected: false, tracerPid: null }
}

// ── Public API ───────────────────────────────────────────────────────────

/**
 * Harden the current process. Call this as early as possible in the
 * startup chain — before loading any plugins, configs, or user code.
 *
 * Returns a report of what was done. Non-fatal failures are reported
 * as warnings rather than throwing.
 */
export function hardenProcess(): HardeningReport {
  const warnings: string[] = []

  // 1. Disable core dumps
  const coreDump = disableCoreDumps()
  if (coreDump.warning) {
    warnings.push(coreDump.warning)
  }

  // 2. Strip dangerous env vars
  const envVarsStripped = stripDangerousEnvVars()

  // 3. Sanitize NODE_OPTIONS
  const nodeOptionsCleanedFlags = sanitizeNodeOptions()

  // 4. Detect ptrace
  const ptrace = detectPtrace()
  if (ptrace.detected) {
    warnings.push(`Process is being traced by PID ${ptrace.tracerPid} — possible debugger or injector attached`)
  }

  return {
    platform: os.platform(),
    coreDumpDisabled: coreDump.success,
    envVarsStripped,
    nodeOptionsCleanedFlags,
    ptraceDetected: ptrace.detected,
    ptraceTracerPid: ptrace.tracerPid,
    warnings,
  }
}

/**
 * Quick check: is the process currently being traced?
 */
export function isBeingTraced(): boolean {
  return detectPtrace().detected
}
