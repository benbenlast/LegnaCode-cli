/**
 * Agent wizard data types for new-agent-creation flow.
 */

export type AgentWizardData = {
  agentType?: string
  whenToUse?: string
  systemPrompt?: string
  selectedTools?: string[]
  selectedModel?: string
  selectedMemory?: string
  location?: string
  generationPrompt?: string
  wasGenerated?: boolean
  finalAgent?: {
    agentType: string
    whenToUse: string
    getSystemPrompt: () => string
    tools?: string[]
    model?: string
    color?: string
    memory?: string
    source?: string
  }
}
