/**
 * Cross-Session Memory Search — search historical sessions for relevant context.
 *
 * Maintains a lightweight text index over session JSONL files.
 * Supports keyword search with relevance ranking.
 */

import { readdir, readFile } from 'fs/promises'
import { join } from 'path'
import { logForDebugging } from '../utils/debug.js'
import { getOriginalCwd } from '../utils/cwd.js'

interface SearchHit {
  sessionId: string
  timestamp: number
  text: string
  score: number
}

/**
 * Search across session files for messages matching a query.
 * Uses simple keyword matching with TF scoring.
 */
export async function searchSessions(
  query: string,
  maxResults = 10,
): Promise<SearchHit[]> {
  const keywords = query.toLowerCase().split(/\s+/).filter(w => w.length > 2)
  if (keywords.length === 0) return []

  const cwd = getOriginalCwd()
  const sessionDirs = [
    join(cwd, '.legna', 'sessions'),
  ]

  const hits: SearchHit[] = []

  for (const dir of sessionDirs) {
    let files: string[]
    try {
      files = (await readdir(dir)).filter(f => f.endsWith('.jsonl'))
    } catch {
      continue
    }

    for (const file of files) {
      const sessionId = file.replace('.jsonl', '')
      try {
        const content = await readFile(join(dir, file), 'utf-8')
        const lines = content.split('\n').filter(Boolean)

        for (const line of lines) {
          try {
            const entry = JSON.parse(line)
            if (entry.type !== 'assistant' && entry.type !== 'user') continue

            const msgContent = entry.message?.content
            let text = ''
            if (typeof msgContent === 'string') {
              text = msgContent
            } else if (Array.isArray(msgContent)) {
              text = msgContent
                .filter((b: any) => b.type === 'text')
                .map((b: any) => b.text)
                .join(' ')
            }
            if (!text) continue

            const lower = text.toLowerCase()
            let score = 0
            for (const kw of keywords) {
              const idx = lower.indexOf(kw)
              if (idx !== -1) score++
            }

            if (score > 0) {
              hits.push({
                sessionId,
                timestamp: entry.timestamp || 0,
                text: text.slice(0, 300),
                score,
              })
            }
          } catch {
            // Skip malformed lines
          }
        }
      } catch {
        // Skip unreadable files
      }
    }
  }

  // Sort by score desc, then timestamp desc
  hits.sort((a, b) => b.score - a.score || b.timestamp - a.timestamp)

  const result = hits.slice(0, maxResults)
  logForDebugging(
    `[sessionSearch] query="${query}" found ${hits.length} hits, returning ${result.length}`,
  )
  return result
}

/**
 * Format search results for display.
 */
export function formatSearchResults(hits: SearchHit[]): string {
  if (hits.length === 0) return 'No matching sessions found.'

  return hits
    .map(
      (h, i) =>
        `${i + 1}. [Session ${h.sessionId.slice(0, 8)}...] (score: ${h.score})\n   ${h.text}`,
    )
    .join('\n\n')
}
