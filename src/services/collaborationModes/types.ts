/**
 * Collaboration mode type definitions.
 *
 * Modes define how LegnaCode interacts with the user:
 * - default: standard assistant
 * - plan: three-phase planning (explore → discuss → implement)
 * - execute: independent execution with progress reporting
 * - pair: step-by-step collaborative coding
 */

export interface CollaborationMode {
  id: string
  name: string
  description: string
  systemPromptTemplate: string
  toolRestrictions?: {
    allowed?: string[]
    denied?: string[]
  }
  behaviorFlags: {
    readOnly: boolean
    autoExecute: boolean
    stepByStep: boolean
    requirePlan: boolean
  }
}

export interface ModeMetadata {
  id: string
  name: string
  description: string
  readOnly?: boolean
  autoExecute?: boolean
  stepByStep?: boolean
  requirePlan?: boolean
  toolsAllowed?: string[]
  toolsDenied?: string[]
}

export const BUILTIN_MODE_IDS = ['default', 'plan', 'execute', 'pair'] as const
export type BuiltinModeId = (typeof BUILTIN_MODE_IDS)[number]
