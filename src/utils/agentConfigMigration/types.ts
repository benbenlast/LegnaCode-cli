/**
 * Agent config migration type definitions.
 *
 * Supports detecting and importing configurations from other AI coding tools:
 * Codex, Cursor, GitHub Copilot, Windsurf, Aider, Continue.
 */

export interface DetectedAgent {
  name: string
  configPath: string
  version?: string
  features: {
    mcpServers?: boolean
    modelConfig?: boolean
    permissions?: boolean
    skills?: boolean
    instructions?: boolean
  }
}

export interface MigrationResult {
  agent: string
  imported: string[]
  skipped: string[]
  errors: string[]
}

export interface ImporterOptions {
  force?: boolean
  dryRun?: boolean
  targetDir?: string
}

export interface AgentImporter {
  name: string
  detect(): DetectedAgent | null
  preview(): MigrationResult
  import(options: ImporterOptions): MigrationResult
}

export const SUPPORTED_AGENTS = [
  'codex',
  'cursor',
  'copilot',
  'windsurf',
  'aider',
  'continue',
] as const

export type SupportedAgent = (typeof SUPPORTED_AGENTS)[number]
