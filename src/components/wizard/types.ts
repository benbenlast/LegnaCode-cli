/**
 * Wizard component types.
 */
import type { ReactNode } from 'react'

export type WizardContextValue<T extends Record<string, unknown> = Record<string, unknown>> = {
  currentStepIndex: number
  totalSteps: number
  wizardData: T
  setWizardData: (data: T) => void
  updateWizardData: (updates: Partial<T>) => void
  goNext: () => void
  goBack: () => void
  goToStep: (index: number) => void
  cancel: () => void
  title?: string
  showStepCounter: boolean
}

export type WizardStepComponent = React.ComponentType

export type WizardProviderProps<T extends Record<string, unknown> = Record<string, unknown>> = {
  steps: WizardStepComponent[]
  initialData?: T
  onComplete: (data: T) => void | Promise<void>
  onCancel?: () => void
  children?: ReactNode
  title?: string
  showStepCounter?: boolean
}
