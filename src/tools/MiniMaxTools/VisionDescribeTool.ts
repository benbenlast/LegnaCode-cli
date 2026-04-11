import { z } from 'zod/v4'
import { buildTool, type ToolDef } from '../../Tool.js'
import { lazySchema } from '../../utils/lazySchema.js'
import { isMiniMaxAvailable, minimaxRequest, getBaseUrl, ENDPOINTS } from './client.js'
import { MINIMAX_VISION_TOOL_NAME, MINIMAX_VISION_DESCRIPTION } from './prompt.js'
import { renderMiniMaxToolUse, renderMiniMaxToolResult, renderMiniMaxToolError } from './UI.js'

const InputSchema = lazySchema(() =>
  z.object({
    image_url: z.string().describe('URL of the image to analyze'),
    prompt: z.string().optional().describe('Question or instruction about the image (default: describe in detail)'),
  }),
)

type Output = {
  result: string
  description: string
}

export const MiniMaxVisionDescribeTool = buildTool({
  name: MINIMAX_VISION_TOOL_NAME,
  searchHint: 'analyze describe image vision VLM picture',
  userFacingName: () => 'MiniMax Vision',
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
    return MINIMAX_VISION_DESCRIPTION
  },

  renderToolUseMessage(input) {
    return renderMiniMaxToolUse('Analyzing image', input.image_url)
  },
  renderToolResultMessage(output: Output, opts) {
    return renderMiniMaxToolResult(output, opts)
  },
  renderToolUseErrorMessage: renderMiniMaxToolError,

  async call(input) {
    const url = ENDPOINTS.vision(getBaseUrl())
    const body: Record<string, unknown> = {
      image_url: input.image_url,
      prompt: input.prompt || 'Describe this image in detail.',
    }

    const res = await minimaxRequest<{
      data: { text: string }
    }>(url, body)

    const output: Output = {
      result: res.data.text,
      description: res.data.text,
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
