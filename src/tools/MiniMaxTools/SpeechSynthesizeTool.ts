import { z } from 'zod/v4'
import { buildTool, type ToolDef } from '../../Tool.js'
import { lazySchema } from '../../utils/lazySchema.js'
import { isMiniMaxAvailable, minimaxRequest, getBaseUrl, ENDPOINTS } from './client.js'
import { MINIMAX_SPEECH_TOOL_NAME, MINIMAX_SPEECH_DESCRIPTION } from './prompt.js'
import { renderMiniMaxToolUse, renderMiniMaxToolResult, renderMiniMaxToolError } from './UI.js'

const InputSchema = lazySchema(() =>
  z.object({
    text: z.string().describe('Text to synthesize into speech'),
    voice: z.string().optional().describe('Voice ID (default: English_expressive_narrator)'),
    speed: z.number().optional().describe('Speech speed 0.5-2.0 (default 1.0)'),
  }),
)

type Output = {
  result: string
  audio_url: string | undefined
  duration_ms: number | undefined
}

export const MiniMaxSpeechSynthesizeTool = buildTool({
  name: MINIMAX_SPEECH_TOOL_NAME,
  searchHint: 'text to speech TTS voice audio synthesize',
  userFacingName: () => 'MiniMax Speech',
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
    return MINIMAX_SPEECH_DESCRIPTION
  },

  renderToolUseMessage(input) {
    const preview = input.text ? input.text.slice(0, 60) + (input.text.length > 60 ? '...' : '') : undefined
    return renderMiniMaxToolUse('Synthesizing speech', preview)
  },
  renderToolResultMessage(output: Output, opts) {
    return renderMiniMaxToolResult(output, opts)
  },
  renderToolUseErrorMessage: renderMiniMaxToolError,

  async call(input) {
    const url = ENDPOINTS.speech(getBaseUrl())
    const body: Record<string, unknown> = {
      model: 'speech-2.8-hd',
      text: input.text,
      voice_setting: {
        voice_id: input.voice || 'English_expressive_narrator',
        speed: input.speed ?? 1.0,
      },
      audio_setting: { format: 'mp3', sample_rate: 32000 },
      output_format: 'url',
    }

    const res = await minimaxRequest<{
      data: { audio_url?: string; status: number }
      extra_info?: { audio_length?: number }
    }>(url, body)

    const output: Output = {
      result: res.data.audio_url
        ? `Speech synthesized successfully.\nAudio URL: ${res.data.audio_url}${res.extra_info?.audio_length ? `\nDuration: ${res.extra_info.audio_length}ms` : ''}`
        : 'Speech synthesis returned no audio URL',
      audio_url: res.data.audio_url,
      duration_ms: res.extra_info?.audio_length,
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
