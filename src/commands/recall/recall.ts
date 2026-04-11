import { searchSessions, formatSearchResults } from '../../services/sessionSearch.js'
import type { LocalCommandCall } from '../../types/command.js'

export const call: LocalCommandCall = async (_args, _messages, options) => {
  const query = options?.args?.trim()
  if (!query) {
    return {
      type: 'text',
      value: 'Usage: /recall <search query>\nExample: /recall "auth bug fix"',
    }
  }

  const hits = await searchSessions(query, 10)
  const formatted = formatSearchResults(hits)

  return { type: 'text', value: formatted }
}
