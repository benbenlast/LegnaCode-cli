import { z } from 'zod/v4'
import { buildTool, type ToolDef } from '../../Tool.js'
import { lazySchema } from '../../utils/lazySchema.js'
import { isMiniMaxAvailable, minimaxRequest, getBaseUrl, ENDPOINTS } from './client.js'
import { MINIMAX_SEARCH_TOOL_NAME, MINIMAX_SEARCH_DESCRIPTION } from './prompt.js'
import { renderMiniMaxToolUse, renderMiniMaxToolResult, renderMiniMaxToolError } from './UI.js'

const InputSchema = lazySchema(() =>
  z.object({
    query: z.string().describe('Search query string'),
  }),
)

type SearchResult = {
  title: string
  url: string
  snippet: string
  date: string
}

type Output = {
  result: string
  results: SearchResult[]
}

export const MiniMaxWebSearchTool = buildTool({
  name: MINIMAX_SEARCH_TOOL_NAME,
  searchHint: 'web search query find information online',
  userFacingName: () => 'MiniMax Search',
  inputSchema: InputSchema,

  isEnabled() {
    return isMiniMaxAvailable()
  },
  isReadOnly() {
    return true
  },
  isConcurrencySafe() {
    return true
  },

  async prompt() {
    return MINIMAX_SEARCH_DESCRIPTION
  },

  renderToolUseMessage(input) {
    return renderMiniMaxToolUse('Searching web', input.query)
  },
  renderToolResultMessage(output: Output, opts) {
    return renderMiniMaxToolResult(output, opts)
  },
  renderToolUseErrorMessage: renderMiniMaxToolError,

  async call(input) {
    const url = ENDPOINTS.search(getBaseUrl())
    const res = await minimaxRequest<{
      organic: Array<{ title: string; link: string; snippet: string; date: string }>
    }>(url, { q: input.query })

    const results: SearchResult[] = (res.organic || []).map(r => ({
      title: r.title,
      url: r.link,
      snippet: r.snippet,
      date: r.date,
    }))

    const formatted = results.length > 0
      ? results.map((r, i) => `${i + 1}. ${r.title}\n   ${r.url}\n   ${r.snippet}${r.date ? `\n   ${r.date}` : ''}`).join('\n\n')
      : 'No results found.'

    const output: Output = {
      result: formatted,
      results,
    }
    return { data: output }
  },

  mapToolResultToToolResultBlockParam(output, toolUseID) {
    return {
      tool_use_id: toolUseID,
      type: 'tool_result',
      content: output.result,
    }
  },
} satisfies ToolDef<typeof InputSchema, Output>)
