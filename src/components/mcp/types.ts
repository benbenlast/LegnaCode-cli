/**
 * MCP server info types for UI components.
 */

export type AgentMcpServerInfo =
  | { name: string; sourceAgents: string[]; transport: 'stdio'; command: string; needsAuth: false }
  | { name: string; sourceAgents: string[]; transport: 'sse'; url: string; needsAuth: true }
  | { name: string; sourceAgents: string[]; transport: 'http'; url: string; needsAuth: true }
  | { name: string; sourceAgents: string[]; transport: 'ws'; url: string; needsAuth: false }

export type StdioServerInfo = {
  name: string; client: unknown; scope: string; transport: 'stdio'; config: unknown
}
export type SSEServerInfo = {
  name: string; client: unknown; scope: string; transport: 'sse'; isAuthenticated: boolean | undefined; config: unknown
}
export type HTTPServerInfo = {
  name: string; client: unknown; scope: string; transport: 'http'; isAuthenticated: boolean | undefined; config: unknown
}
export type ClaudeAIServerInfo = {
  name: string; client: unknown; scope: string; transport: 'claudeai-proxy'; isAuthenticated: boolean | undefined; config: unknown
}
