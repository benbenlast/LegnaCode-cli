/**
 * Agent config migrator — orchestrates detection and import from external tools.
 */

import { detectInstalledAgents, detectAgent } from './detectors.js'
import { importFromCodex } from './importers/codex.js'
import { importFromCursor } from './importers/cursor.js'
import { importFromCopilot } from './importers/copilot.js'
import type { DetectedAgent, ImporterOptions, MigrationResult } from './types.js'

type ImportFn = (options: ImporterOptions) => MigrationResult

const IMPORTERS: Record<string, ImportFn> = {
  codex: importFromCodex,
  cursor: importFromCursor,
  copilot: importFromCopilot,
}

export class AgentConfigMigrator {
  /** Detect all installed AI coding tools. */
  detect(): DetectedAgent[] {
    return detectInstalledAgents()
  }

  /** Detect a specific agent. */
  detectOne(name: string): DetectedAgent | null {
    return detectAgent(name)
  }

  /** Preview what would be imported from a specific agent (dry run). */
  preview(agentName: string): MigrationResult {
    const importer = IMPORTERS[agentName]
    if (!importer) {
      return {
        agent: agentName,
        imported: [],
        skipped: [],
        errors: [`No importer available for "${agentName}".`],
      }
    }
    return importer({ dryRun: true })
  }

  /** Execute import from a specific agent. */
  import(agentName: string, options: ImporterOptions = {}): MigrationResult {
    const importer = IMPORTERS[agentName]
    if (!importer) {
      return {
        agent: agentName,
        imported: [],
        skipped: [],
        errors: [`No importer available for "${agentName}".`],
      }
    }
    return importer(options)
  }

  /** Import from all detected agents. */
  importAll(options: ImporterOptions = {}): MigrationResult[] {
    const detected = this.detect()
    const results: MigrationResult[] = []

    for (const agent of detected) {
      if (IMPORTERS[agent.name]) {
        results.push(this.import(agent.name, options))
      }
    }

    return results
  }

  /** List agents that have importers available. */
  listSupportedAgents(): string[] {
    return Object.keys(IMPORTERS)
  }
}
