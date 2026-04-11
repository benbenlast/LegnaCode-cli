import { z } from 'zod/v4'
import { buildTool, type ToolDef } from '../../Tool.js'
import { lazySchema } from '../../utils/lazySchema.js'
import { isMiniMaxAvailable, minimaxRequest, getBaseUrl, pollVideoTask, getFileDownloadUrl, ENDPOINTS } from './client.js'
import { MINIMAX_VIDEO_TOOL_NAME, MINIMAX_VIDEO_DESCRIPTION } from './prompt.js'
import { renderMiniMaxToolUse, renderMiniMaxToolResult, renderMiniMaxToolError } from './UI.js'

const InputSchema = lazySchema(() =>
  z.object({
    prompt: z.string().describe('Video generation prompt'),
    first_frame_image: z.string().optional().describe('URL of first frame image (optional, for image-to-video)'),
  }),
)

type Output = {
  result: string
  task_id: string
  file_id: string
  download_url: string
}

export const MiniMaxVideoGenerateTool = buildTool({
  name: MINIMAX_VIDEO_TOOL_NAME,
  searchHint: 'generate create video clip animation',
  userFacingName: () => 'MiniMax Video',
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
    return MINIMAX_VIDEO_DESCRIPTION
  },

  renderToolUseMessage(input) {
    return renderMiniMaxToolUse('Generating video', input.prompt)
  },
  renderToolResultMessage(output: Output, opts) {
    return renderMiniMaxToolResult(output, opts)
  },
  renderToolUseErrorMessage: renderMiniMaxToolError,

  async call(input) {
    const url = ENDPOINTS.video(getBaseUrl())
    const body: Record<string, unknown> = {
      model: 'video-01',
      prompt: input.prompt,
    }
    if (input.first_frame_image) body.first_frame_image = input.first_frame_image

    const res = await minimaxRequest<{ task_id: string }>(url, body)
    const { fileId } = await pollVideoTask(res.task_id)
    const downloadUrl = await getFileDownloadUrl(fileId)

    const output: Output = {
      result: `Video generated successfully.\nTask ID: ${res.task_id}\nFile ID: ${fileId}\nDownload URL: ${downloadUrl}`,
      task_id: res.task_id,
      file_id: fileId,
      download_url: downloadUrl,
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
