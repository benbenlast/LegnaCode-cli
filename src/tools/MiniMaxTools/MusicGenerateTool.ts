import { z } from 'zod/v4'
import { buildTool, type ToolDef } from '../../Tool.js'
import { lazySchema } from '../../utils/lazySchema.js'
import { isMiniMaxAvailable, minimaxRequest, getBaseUrl, ENDPOINTS } from './client.js'
import { MINIMAX_MUSIC_TOOL_NAME, MINIMAX_MUSIC_DESCRIPTION } from './prompt.js'
import { renderMiniMaxToolUse, renderMiniMaxToolResult, renderMiniMaxToolError } from './UI.js'

const InputSchema = lazySchema(() =>
  z.object({
    prompt: z.string().describe('Music generation prompt describing style, mood, instruments'),
    lyrics: z.string().optional().describe('Optional lyrics for vocal music'),
    duration: z.number().optional().describe('Duration in seconds (default 30)'),
  }),
)

type Output = {
  result: string
  audio_url: string | undefined
  task_id: string | undefined
}

export const MiniMaxMusicGenerateTool = buildTool({
  name: MINIMAX_MUSIC_TOOL_NAME,
  searchHint: 'generate create music song audio melody',
  userFacingName: () => 'MiniMax Music',
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
    return MINIMAX_MUSIC_DESCRIPTION
  },

  renderToolUseMessage(input) {
    return renderMiniMaxToolUse('Generating music', input.prompt)
  },
  renderToolResultMessage(output: Output, opts) {
    return renderMiniMaxToolResult(output, opts)
  },
  renderToolUseErrorMessage: renderMiniMaxToolError,

  async call(input) {
    const url = ENDPOINTS.music(getBaseUrl())
    const body: Record<string, unknown> = {
      model: 'music-01',
      prompt: input.prompt,
    }
    if (input.lyrics) body.lyrics = input.lyrics
    if (input.duration) body.duration = input.duration

    const res = await minimaxRequest<{
      data: { audio_url?: string; task_id?: string }
    }>(url, body)

    const output: Output = {
      result: res.data.audio_url
        ? `Music generated successfully.\nAudio URL: ${res.data.audio_url}`
        : `Music generation submitted.\nTask ID: ${res.data.task_id || 'unknown'}`,
      audio_url: res.data.audio_url,
      task_id: res.data.task_id,
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
