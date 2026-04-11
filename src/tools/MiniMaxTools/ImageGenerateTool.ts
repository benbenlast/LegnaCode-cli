import { z } from 'zod/v4'
import { buildTool, type ToolDef } from '../../Tool.js'
import { lazySchema } from '../../utils/lazySchema.js'
import { isMiniMaxAvailable, minimaxRequest, getBaseUrl, ENDPOINTS } from './client.js'
import { MINIMAX_IMAGE_TOOL_NAME, MINIMAX_IMAGE_DESCRIPTION } from './prompt.js'
import { renderMiniMaxToolUse, renderMiniMaxToolResult, renderMiniMaxToolError } from './UI.js'

const InputSchema = lazySchema(() =>
  z.object({
    prompt: z.string().describe('Image generation prompt'),
    n: z.number().optional().describe('Number of images (1-9, default 1)'),
    aspect_ratio: z.string().optional().describe('Aspect ratio, e.g. "1:1", "16:9", "9:16"'),
  }),
)

type Output = {
  result: string
  image_urls: string[]
  task_id: string
  count: number
}

export const MiniMaxImageGenerateTool = buildTool({
  name: MINIMAX_IMAGE_TOOL_NAME,
  searchHint: 'generate create image picture photo illustration',
  userFacingName: () => 'MiniMax Image',
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
    return MINIMAX_IMAGE_DESCRIPTION
  },

  renderToolUseMessage(input) {
    return renderMiniMaxToolUse('Generating image', input.prompt)
  },
  renderToolResultMessage(output: Output, opts) {
    return renderMiniMaxToolResult(output, opts)
  },
  renderToolUseErrorMessage: renderMiniMaxToolError,

  async call(input) {
    const url = ENDPOINTS.image(getBaseUrl())
    const body: Record<string, unknown> = {
      model: 'image-01',
      prompt: input.prompt,
    }
    if (input.n) body.n = input.n
    if (input.aspect_ratio) body.aspect_ratio = input.aspect_ratio

    const res = await minimaxRequest<{
      data: { image_urls: string[]; task_id: string; success_count: number }
    }>(url, body)

    const urls = res.data.image_urls
    const output: Output = {
      result: urls.length > 0
        ? `Generated ${urls.length} image(s):\n${urls.join('\n')}`
        : 'No images generated',
      image_urls: urls,
      task_id: res.data.task_id,
      count: res.data.success_count,
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
