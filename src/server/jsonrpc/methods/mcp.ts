/**
 * JSON-RPC MCP methods — MCP server status and tool/resource access.
 */

import type { JsonRpcRouter } from '../router.js'

interface McpResourceReadParams {
  serverId: string
  uri: string
}

interface McpToolCallParams {
  serverId: string
  toolName: string
  args?: Record<string, unknown>
}

export function registerMcpMethods(router: JsonRpcRouter): void {
  router.register('mcpServerStatus/list', async () => {
    // Placeholder — will integrate with MCP server manager
    return { servers: [] }
  })

  router.register('mcpServer/resource/read', async (params) => {
    const p = params as McpResourceReadParams
    if (!p?.serverId || !p?.uri) {
      throw new Error('Invalid params: serverId and uri required.')
    }
    return {
      serverId: p.serverId,
      uri: p.uri,
      content: null,
      error: 'MCP resource read not yet connected to server manager.',
    }
  })

  router.register('mcpServer/tool/call', async (params) => {
    const p = params as McpToolCallParams
    if (!p?.serverId || !p?.toolName) {
      throw new Error('Invalid params: serverId and toolName required.')
    }
    return {
      serverId: p.serverId,
      toolName: p.toolName,
      result: null,
      error: 'MCP tool call not yet connected to server manager.',
    }
  })
}
