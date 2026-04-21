/**
 * UI option type for select components.
 */
import type { ReactNode } from 'react'

export type Option = {
  label: ReactNode
  value: string
  description?: string
  dimDescription?: boolean
  disabled?: boolean
}
