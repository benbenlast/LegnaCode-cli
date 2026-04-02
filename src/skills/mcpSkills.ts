/**
 * MCP skill discovery — reads skill:// resources from MCP servers and
 * converts them into slash commands. Gated by feature('MCP_SKILLS').
 */
import type { Command } from '../commands.js'
import type { MCPServerConnection } from '../services/mcp/types.js'
import { memoizeWithLRU } from '../utils/memoize.js'
import { getMCPSkillBuilders } from './mcpSkillBuilders.js'
import { logForDebugging } from '../utils/debug.js'

async function fetchSkills(client: MCPServerConnection): Promise<Command[]> {
  if (client.type !== 'connected') return []
  if (!client.capabilities?.resources) return []

  const { createSkillCommand, parseSkillFrontmatterFields } =
    getMCPSkillBuilders()

  try {
    const result = await client.client.request(
      { method: 'resources/list' },
      { method: 'resources/list' } as any,
    )

    const resources = (result as any)?.resources
    if (!Array.isArray(resources)) return []

    const skillResources = resources.filter(
      (r: any) => typeof r.uri === 'string' && r.uri.startsWith('skill://'),
    )

    const commands: Command[] = []
    for (const resource of skillResources) {
      try {
        const content = await client.client.request(
          { method: 'resources/read', params: { uri: resource.uri } },
          { method: 'resources/read' } as any,
        )
        const text = (content as any)?.contents?.[0]?.text
        if (typeof text !== 'string') continue

        const fields = parseSkillFrontmatterFields(text)
        if (!fields) continue

        const cmd = createSkillCommand({
          ...fields,
          name: resource.name ?? resource.uri.replace('skill://', ''),
          source: 'mcp',
          loadedFrom: 'mcp',
        })
        if (cmd) commands.push(cmd)
      } catch (e) {
        logForDebugging(
          `MCP Skills: failed to read resource ${resource.uri}: ${e}`,
        )
      }
    }
    return commands
  } catch (e) {
    logForDebugging(`MCP Skills: failed to list resources from ${client.name}: ${e}`)
    return []
  }
}

export const fetchMcpSkillsForClient = memoizeWithLRU(
  fetchSkills,
  (client: MCPServerConnection) => client.name,
)
