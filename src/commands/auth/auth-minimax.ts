import { writeFile, mkdir, readFile } from 'fs/promises'
import { join } from 'path'
import { homedir } from 'os'
import type { LocalCommandCall } from '../../types/command.js'

const CREDENTIALS_PATH = join(homedir(), '.legna', 'minimax-credentials.json')

export const call: LocalCommandCall = async (_args, _messages, options) => {
  const apiKey = options?.args?.trim()

  if (!apiKey) {
    // Show current status
    try {
      const data = JSON.parse(await readFile(CREDENTIALS_PATH, 'utf-8'))
      if (data.api_key) {
        const masked = data.api_key.slice(0, 6) + '...' + data.api_key.slice(-4)
        return {
          type: 'text',
          value: `MiniMax API key configured: ${masked}\nRegion: ${data.region || 'global'}\nCredentials: ${CREDENTIALS_PATH}\n\nTo update: /auth-minimax <new-api-key>\nOr set MINIMAX_API_KEY environment variable`,
        }
      }
    } catch {
      // No credentials file
    }

    if (process.env.MINIMAX_API_KEY) {
      const masked = process.env.MINIMAX_API_KEY.slice(0, 6) + '...' + process.env.MINIMAX_API_KEY.slice(-4)
      return {
        type: 'text',
        value: `MiniMax API key set via environment: ${masked}\n\nTo persist: /auth-minimax <api-key>`,
      }
    }

    return {
      type: 'text',
      value: `No MiniMax API key configured.\n\nUsage: /auth-minimax <api-key>\nOr set MINIMAX_API_KEY environment variable\n\nGet your API key at https://platform.minimaxi.com (China) or https://platform.minimax.io (Global)`,
    }
  }

  // Save API key
  try {
    await mkdir(join(homedir(), '.legna'), { recursive: true })
    const region = process.env.MINIMAX_REGION || 'global'
    await writeFile(
      CREDENTIALS_PATH,
      JSON.stringify({ api_key: apiKey, region }, null, 2),
      'utf-8',
    )
    const masked = apiKey.slice(0, 6) + '...' + apiKey.slice(-4)
    return {
      type: 'text',
      value: `MiniMax API key saved: ${masked}\nRegion: ${region}\nCredentials: ${CREDENTIALS_PATH}\n\nNote: Set MINIMAX_API_KEY=${apiKey} in your shell profile for this session, or restart LegnaCode to pick up the saved credentials.\n\nMiniMax tools now available: MiniMaxImageGenerate, MiniMaxVideoGenerate, MiniMaxSpeechSynthesize, MiniMaxMusicGenerate, MiniMaxVisionDescribe, MiniMaxWebSearch`,
    }
  } catch (err) {
    return {
      type: 'text',
      value: `Failed to save credentials: ${err}`,
    }
  }
}
