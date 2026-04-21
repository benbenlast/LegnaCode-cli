/**
 * Tip types for spinner tips system.
 */

export type TipContext = {
  bashTools?: Set<string>
  readFileState?: Map<string, unknown>
  [key: string]: unknown
}

export type Tip = {
  id: string
  content: () => Promise<string> | string
  cooldownSessions?: number
  isRelevant?: (context?: TipContext) => Promise<boolean> | boolean
}
