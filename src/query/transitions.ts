/**
 * Query state transition types.
 */
export type Terminal = {
  reason: string
  turnCount?: number
  error?: unknown
}

export type Continue = {
  reason: string
  attempt?: number
  committed?: unknown
}
