/**
 * Agent config migration — barrel export.
 */

export { AgentConfigMigrator } from './migrator.js'
export { detectInstalledAgents, detectAgent } from './detectors.js'
export { importFromCodex } from './importers/codex.js'
export { importFromCursor } from './importers/cursor.js'
export { importFromCopilot } from './importers/copilot.js'

export type {
  DetectedAgent,
  MigrationResult,
  ImporterOptions,
  AgentImporter,
  SupportedAgent,
} from './types.js'

export { SUPPORTED_AGENTS } from './types.js'
