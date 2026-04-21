/**
 * Agent config detectors — detect installed AI coding tools.
 *
 * Scans known config paths for each supported tool.
 */

import { existsSync } from 'fs'
import { homedir } from 'os'
import { join } from 'path'
import type { DetectedAgent } from './types.js'

const HOME = homedir()

interface DetectorEntry {
  name: string
  paths: string[]
  features: DetectedAgent['features']
}

const DETECTORS: DetectorEntry[] = [
  {
    name: 'codex',
    paths: [
      join(HOME, '.codex', 'config.toml'),
      join(HOME, '.codex', 'config.json'),
    ],
    features: {
      mcpServers: true,
      modelConfig: true,
      permissions: true,
      skills: true,
      instructions: true,
    },
  },
  {
    name: 'cursor',
    paths: [
      join(HOME, '.cursor', 'settings.json'),
      join(HOME, 'Library', 'Application Support', 'Cursor', 'User', 'settings.json'),
      join(HOME, '.config', 'Cursor', 'User', 'settings.json'),
    ],
    features: {
      mcpServers: true,
      modelConfig: true,
      instructions: true,
    },
  },
  {
    name: 'copilot',
    paths: [
      join(HOME, '.config', 'github-copilot', 'hosts.json'),
      join(HOME, '.config', 'github-copilot', 'versions.json'),
    ],
    features: {
      modelConfig: true,
      instructions: true,
    },
  },
  {
    name: 'windsurf',
    paths: [
      join(HOME, '.windsurf', 'settings.json'),
      join(HOME, '.config', 'windsurf', 'settings.json'),
    ],
    features: {
      mcpServers: true,
      modelConfig: true,
      instructions: true,
    },
  },
  {
    name: 'aider',
    paths: [
      join(HOME, '.aider.conf.yml'),
      join(HOME, '.aider', 'config.yml'),
    ],
    features: {
      modelConfig: true,
    },
  },
  {
    name: 'continue',
    paths: [
      join(HOME, '.continue', 'config.json'),
      join(HOME, '.continue', 'config.yaml'),
    ],
    features: {
      mcpServers: true,
      modelConfig: true,
      instructions: true,
    },
  },
]

/**
 * Detect all installed AI coding tools by checking known config paths.
 */
export function detectInstalledAgents(): DetectedAgent[] {
  const found: DetectedAgent[] = []

  for (const detector of DETECTORS) {
    for (const configPath of detector.paths) {
      if (existsSync(configPath)) {
        found.push({
          name: detector.name,
          configPath,
          features: detector.features,
        })
        break // Only report first found path per agent
      }
    }
  }

  return found
}

/**
 * Detect a specific agent by name.
 */
export function detectAgent(name: string): DetectedAgent | null {
  const detector = DETECTORS.find(d => d.name === name)
  if (!detector) return null

  for (const configPath of detector.paths) {
    if (existsSync(configPath)) {
      return {
        name: detector.name,
        configPath,
        features: detector.features,
      }
    }
  }

  return null
}
