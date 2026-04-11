/**
 * Export MiniMax tool schemas in Anthropic tool format.
 * Compatible with mmx-cli's `mmx config export-schema` output.
 */
import {
  MiniMaxImageGenerateTool,
  MiniMaxVideoGenerateTool,
  MiniMaxSpeechSynthesizeTool,
  MiniMaxMusicGenerateTool,
  MiniMaxVisionDescribeTool,
  MiniMaxWebSearchTool,
} from './index.js'

interface AnthropicToolSchema {
  name: string
  description: string
  input_schema: Record<string, unknown>
}

const MINIMAX_TOOLS = [
  MiniMaxImageGenerateTool,
  MiniMaxVideoGenerateTool,
  MiniMaxSpeechSynthesizeTool,
  MiniMaxMusicGenerateTool,
  MiniMaxVisionDescribeTool,
  MiniMaxWebSearchTool,
]

/**
 * Export all MiniMax tool schemas in Anthropic-compatible format.
 * Can be used for external tool registration or schema sharing.
 */
export function exportMiniMaxToolSchemas(): AnthropicToolSchema[] {
  return MINIMAX_TOOLS.map(tool => {
    const schema = typeof tool.inputSchema === 'function'
      ? (tool.inputSchema as any)()
      : tool.inputSchema
    // Convert zod schema to JSON schema
    const jsonSchema = schema?.shape
      ? Object.fromEntries(
          Object.entries(schema.shape).map(([key, val]: [string, any]) => [
            key,
            {
              type: val?._def?.typeName === 'ZodNumber' ? 'number' : 'string',
              description: val?._def?.description || val?.description || '',
            },
          ]),
        )
      : {}

    return {
      name: tool.name,
      description: typeof tool.prompt === 'function'
        ? tool.name // fallback — prompt is async
        : String(tool.prompt || tool.name),
      input_schema: {
        type: 'object',
        properties: jsonSchema,
        required: Object.keys(jsonSchema).filter(k => {
          const val = (schema?.shape as any)?.[k]
          return val && !val?.isOptional?.()
        }),
      },
    }
  })
}

/**
 * Export schemas as JSON string for CLI output.
 */
export function exportMiniMaxToolSchemasJSON(): string {
  return JSON.stringify(exportMiniMaxToolSchemas(), null, 2)
}
