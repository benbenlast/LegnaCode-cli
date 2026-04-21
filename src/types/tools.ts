/**
 * Tool progress types for streaming tool execution feedback.
 */

export type ShellProgress = {
  output: string
  fullOutput: string
  elapsedTimeSeconds: number
  totalLines: number
}

export type BashProgress = ShellProgress

export type PowerShellProgress = ShellProgress

export type AgentToolProgress = {
  message: {
    type: 'assistant'
    message: { content: Array<unknown>; id?: string }
  } | {
    type: 'user'
    message: { content: Array<unknown> }
  }
}

export type MCPProgress = {
  [key: string]: unknown
}

export type WebSearchProgress = {
  [key: string]: unknown
}

export type SkillToolProgress = AgentToolProgress

export type TaskOutputProgress = {
  [key: string]: unknown
}

export type REPLToolProgress = {
  [key: string]: unknown
}

export type SdkWorkflowProgress = {
  type: string
  index: number
  [key: string]: unknown
}

export type ToolProgressData =
  | AgentToolProgress
  | BashProgress
  | MCPProgress
  | WebSearchProgress
  | SkillToolProgress
  | TaskOutputProgress
  | REPLToolProgress
  | ShellProgress
  | PowerShellProgress
