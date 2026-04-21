/**
 * LSP server configuration types.
 */

export type LspServerConfig = {
  command: string
  args?: string[]
  env?: Record<string, string>
  rootUri?: string
  initializationOptions?: Record<string, unknown>
  languages?: string[]
  [key: string]: unknown
}

export type ScopedLspServerConfig = LspServerConfig & {
  scope?: string
}
