import { z } from 'zod/v4'
import type { ToolResultBlockParam } from '@anthropic-ai/sdk/resources/index.mjs'
import React from 'react'
import { Text } from '../../ink.js'
import { buildTool } from '../../Tool.js'
import type { ToolUseContext } from '../../Tool.js'
import {
  registerMonitorMcpTask,
  updateMonitorMcpTask,
  killMonitorMcp,
  isMonitorMcpTask,
} from '../../tasks/MonitorMcpTask/MonitorMcpTask.js'

const inputSchema = z.object({
  server_name: z
    .string()
    .optional()
    .describe('Name of the MCP server to monitor. Omit to target all servers.'),
  action: z
    .enum(['start', 'stop', 'status'])
    .describe('Action to perform: start monitoring, stop monitoring, or check status.'),
})

type Input = z.infer<typeof inputSchema>
type Output = string

// Periodic ping interval (ms)
const PING_INTERVAL_MS = 30_000

// Active interval handles keyed by task ID
const activeIntervals = new Map<string, ReturnType<typeof setInterval>>()

function getMcpConnectionStatus(
  context: ToolUseContext,
  serverName?: string,
): string {
  const clients = context.options.mcpClients ?? []
  if (clients.length === 0) {
    return 'No MCP servers configured.'
  }
  const targets = serverName
    ? clients.filter(c => c.name === serverName)
    : clients
  if (targets.length === 0) {
    return serverName
      ? `MCP server "${serverName}" not found.`
      : 'No MCP servers found.'
  }
  const lines = targets.map(c => {
    const status = c.status ?? 'unknown'
    return `  ${c.name}: ${status}`
  })
  return `MCP server status:\n${lines.join('\n')}`
}

function findRunningMonitorTask(
  context: ToolUseContext,
  serverName?: string,
): string | undefined {
  const tasks = context.getAppState().tasks ?? {}
  for (const [taskId, task] of Object.entries(tasks)) {
    if (
      isMonitorMcpTask(task) &&
      task.status === 'running' &&
      task.serverName === serverName
    ) {
      return taskId
    }
  }
  return undefined
}

export const MonitorTool = buildTool({
  name: 'MonitorTool',
  inputSchema,
  maxResultSizeChars: 50_000,
  shouldDefer: true,

  isReadOnly(input: Input) {
    return input.action === 'status'
  },

  async checkPermissions(input: Input, _context: ToolUseContext) {
    if (input.action === 'status') {
      return { behavior: 'allow' as const, updatedInput: input }
    }
    return { behavior: 'askUser' as const, updatedInput: input }
  },

  async description() {
    return 'Monitor MCP server connections. Start/stop periodic health checks or query current status.'
  },

  async prompt() {
    return (
      'Use MonitorTool to monitor MCP server connections. ' +
      'Actions: "start" begins periodic health pings, "stop" ends monitoring, ' +
      '"status" reports current connection health. ' +
      'Optionally specify server_name to target a specific server.'
    )
  },

  renderToolUseMessage(input: Partial<Input>) {
    const server = input.server_name ? ` ${input.server_name}` : ''
    return React.createElement(Text, null, `${input.action ?? 'monitor'}${server}`)
  },

  mapToolResultToToolResultBlockParam(
    content: Output,
    toolUseID: string,
  ): ToolResultBlockParam {
    return {
      type: 'tool_result',
      tool_use_id: toolUseID,
      content: [{ type: 'text', text: content }],
    }
  },

  async call(input: Input, context: ToolUseContext) {
    const setAppState = context.setAppStateForTasks ?? context.setAppState

    switch (input.action) {
      case 'start': {
        // Check for existing monitor
        const existing = findRunningMonitorTask(context, input.server_name)
        if (existing) {
          return {
            data: `Monitor already running (task ${existing})` as Output,
          }
        }

        const taskId = registerMonitorMcpTask(setAppState, {
          serverName: input.server_name,
          agentId: context.agentId,
          toolUseId: context.toolUseId,
        })

        // Set up periodic ping
        const interval = setInterval(() => {
          const status = getMcpConnectionStatus(context, input.server_name)
          updateMonitorMcpTask(taskId, setAppState, status)
        }, PING_INTERVAL_MS)
        activeIntervals.set(taskId, interval)

        const status = getMcpConnectionStatus(context, input.server_name)
        updateMonitorMcpTask(taskId, setAppState, status)

        return {
          data: `Started monitoring (task ${taskId}).\n${status}` as Output,
        }
      }

      case 'stop': {
        const taskId = findRunningMonitorTask(context, input.server_name)
        if (!taskId) {
          return {
            data: 'No active monitor found for the specified server.' as Output,
          }
        }
        const interval = activeIntervals.get(taskId)
        if (interval) {
          clearInterval(interval)
          activeIntervals.delete(taskId)
        }
        killMonitorMcp(taskId, setAppState)
        return { data: `Stopped monitor (task ${taskId}).` as Output }
      }

      case 'status': {
        return {
          data: getMcpConnectionStatus(context, input.server_name) as Output,
        }
      }
    }
  },
})
