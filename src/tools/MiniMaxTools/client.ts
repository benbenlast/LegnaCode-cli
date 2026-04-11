/**
 * MiniMax API client for non-chat endpoints.
 * Adapted from vendor/minimax-cli/src/client/http.ts and endpoints.ts.
 */

const REGIONS = {
  global: 'https://api.minimax.io',
  cn: 'https://api.minimaxi.com',
} as const

type Region = keyof typeof REGIONS

function getApiKey(): string | undefined {
  return process.env.MINIMAX_API_KEY
}

function getRegion(): Region {
  const r = process.env.MINIMAX_REGION?.toLowerCase()
  if (r === 'cn') return 'cn'
  return 'global'
}

function getBaseUrl(): string {
  return process.env.MINIMAX_BASE_URL || REGIONS[getRegion()]
}

export function isMiniMaxAvailable(): boolean {
  // Only available when using MiniMax model AND API key is set
  const apiKey = getApiKey()
  if (!apiKey) return false
  // Check if current model or base URL points to MiniMax
  const model = process.env.ANTHROPIC_DEFAULT_OPUS_MODEL || process.env.SONNET_MODEL || ''
  const baseUrl = process.env.ANTHROPIC_BASE_URL || ''
  if (/^minimax-/i.test(model)) return true
  try {
    const host = new URL(baseUrl).host
    if (host === 'api.minimaxi.com' || host === 'api.minimax.io') return true
  } catch {}
  return false
}

export const ENDPOINTS = {
  image: (base: string) => `${base}/v1/image_generation`,
  video: (base: string) => `${base}/v1/video_generation`,
  videoTask: (base: string, taskId: string) =>
    `${base}/v1/query/video_generation?task_id=${taskId}`,
  speech: (base: string) => `${base}/v1/t2a_v2`,
  music: (base: string) => `${base}/v1/music_generation`,
  search: (base: string) => `${base}/v1/web_search`,
  vision: (base: string) => `${base}/v1/coding_plan/vlm`,
  fileRetrieve: (base: string, fileId: string) =>
    `${base}/v1/files/retrieve?file_id=${fileId}`,
} as const

/**
 * Make an authenticated request to MiniMax non-chat API.
 * Auth: x-api-key for chat-adjacent, Bearer for media endpoints.
 * Adapted from vendor/minimax-cli/src/client/http.ts
 */
export async function minimaxRequest<T>(
  endpoint: string,
  body: Record<string, unknown>,
  opts?: { authStyle?: 'x-api-key' | 'bearer'; timeout?: number },
): Promise<T> {
  const apiKey = getApiKey()
  if (!apiKey) throw new Error('MINIMAX_API_KEY not set')

  const authStyle = opts?.authStyle ?? 'bearer'
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(authStyle === 'x-api-key'
      ? { 'x-api-key': apiKey }
      : { Authorization: `Bearer ${apiKey}` }),
  }

  const res = await fetch(endpoint, {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(opts?.timeout ?? 120_000),
  })

  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new Error(`MiniMax API error ${res.status}: ${text.slice(0, 500)}`)
  }

  const data = (await res.json()) as T & {
    base_resp?: { status_code?: number; status_msg?: string }
  }
  if (data.base_resp?.status_code && data.base_resp.status_code !== 0) {
    throw new Error(
      `MiniMax API error: ${data.base_resp.status_msg || 'unknown'}`,
    )
  }

  return data
}

/**
 * Poll a video generation task until completion.
 * Adapted from vendor/minimax-cli/src/polling/poll.ts
 */
export async function pollVideoTask(
  taskId: string,
  maxWaitMs = 300_000,
  intervalMs = 5_000,
): Promise<{ fileId: string; status: string }> {
  const base = getBaseUrl()
  const deadline = Date.now() + maxWaitMs

  while (Date.now() < deadline) {
    const url = ENDPOINTS.videoTask(base, taskId)
    const apiKey = getApiKey()!
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${apiKey}` },
      signal: AbortSignal.timeout(30_000),
    })
    const data = (await res.json()) as {
      base_resp?: { status_code?: number }
      status: string
      file_id?: string
    }
    if (data.status === 'Success' && data.file_id) {
      return { fileId: data.file_id, status: 'Success' }
    }
    if (data.status === 'Failed') {
      throw new Error('Video generation failed')
    }
    await new Promise(r => setTimeout(r, intervalMs))
  }
  throw new Error(`Video generation timed out after ${maxWaitMs / 1000}s`)
}

/**
 * Get download URL for a file by file_id.
 * Adapted from vendor/minimax-cli/src/files/download.ts
 */
export async function getFileDownloadUrl(fileId: string): Promise<string> {
  const base = getBaseUrl()
  const url = ENDPOINTS.fileRetrieve(base, fileId)
  const apiKey = getApiKey()!
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${apiKey}` },
    signal: AbortSignal.timeout(30_000),
  })
  const data = (await res.json()) as {
    file?: { download_url?: string }
  }
  if (!data.file?.download_url) throw new Error('No download URL returned')
  return data.file.download_url
}

export { getBaseUrl }
