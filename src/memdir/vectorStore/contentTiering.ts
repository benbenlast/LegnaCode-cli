/**
 * Content Tiering — auto-generate L0/L1 summaries for drawers.
 * Adapted from OpenViking's L0/L1/L2 content tiers.
 *
 * L0: ~25 words, one-sentence summary (for budget-constrained injection)
 * L1: ~200 words, core info (for planning-phase decisions)
 * L2: full verbatim content (stored as `content`)
 *
 * Pure heuristic — no LLM calls. Fast enough for upsert-time generation.
 */

/**
 * Generate L0 summary: first meaningful sentence, max 100 chars.
 * For Q+A pairs, extracts the question.
 */
export function generateL0(content: string): string {
  const trimmed = content.trim()
  if (!trimmed) return ''

  // Q+A format: extract the question
  const qaMatch = trimmed.match(/^Q:\s*(.+?)(?:\n|$)/)
  if (qaMatch) {
    return qaMatch[1]!.slice(0, 100).trim()
  }

  // First sentence: split on . ! ? or newline
  const firstSentence = trimmed.split(/[.!?\n]/)[0]?.trim() ?? ''
  if (firstSentence.length > 0 && firstSentence.length <= 100) {
    return firstSentence
  }

  // Truncate to 100 chars at word boundary
  if (trimmed.length <= 100) return trimmed
  const cut = trimmed.slice(0, 100)
  const lastSpace = cut.lastIndexOf(' ')
  return (lastSpace > 50 ? cut.slice(0, lastSpace) : cut) + '…'
}

/**
 * Generate L1 overview: selects the most information-dense sentences up to 400 chars.
 * Uses keyword density scoring: sentences with more non-stopword terms rank higher.
 * Always includes the first sentence for context anchoring.
 */
export function generateL1(content: string): string {
  const trimmed = content.trim()
  if (!trimmed) return ''
  if (trimmed.length <= 400) return trimmed

  // Split into sentences
  const sentences = trimmed.split(/(?<=[.!?])\s+/).filter(s => s.length > 10)
  if (sentences.length <= 3) {
    return trimmed.slice(0, 400)
  }

  // Score each sentence by keyword density (non-stopword ratio)
  const STOP = new Set([
    'a','an','the','and','or','but','in','on','at','to','for','of','with','by',
    'from','is','it','its','was','are','were','be','been','being','have','has',
    'had','do','does','did','will','would','could','should','this','that','these',
    'those','i','me','my','we','our','you','your','he','him','his','she','her',
    'they','them','their','not','so','very','just','also','as','if','then','there',
  ])

  const scored = sentences.map((s, idx) => {
    const words = s.toLowerCase().split(/\W+/).filter(w => w.length > 1)
    const keywords = words.filter(w => !STOP.has(w))
    // Density = keyword ratio * sqrt(keyword count) — rewards both density and richness
    const density = words.length > 0
      ? (keywords.length / words.length) * Math.sqrt(keywords.length)
      : 0
    return { s, idx, density }
  })

  // Always include first sentence (context anchor), then top by density
  const first = scored[0]!
  const rest = scored.slice(1).sort((a, b) => b.density - a.density)

  // Greedily fill up to 400 chars, preserving original order
  const selected = [first]
  let totalLen = first.s.length
  for (const candidate of rest) {
    if (totalLen + candidate.s.length + 1 > 400) continue
    selected.push(candidate)
    totalLen += candidate.s.length + 1
  }

  // Sort by original position for coherent reading
  selected.sort((a, b) => a.idx - b.idx)
  let result = selected.map(s => s.s).join(' ')
  if (result.length > 400) {
    result = result.slice(0, 400)
    const lastSpace = result.lastIndexOf(' ')
    if (lastSpace > 200) result = result.slice(0, lastSpace)
    result += '…'
  }
  return result
}

/**
 * Estimate token count from text length.
 * ~4 chars per token for English, ~2 for CJK.
 */
export function estimateTokens(text: string): number {
  if (!text) return 0
  // Rough heuristic: count CJK chars separately
  const cjkCount = (text.match(/[\u4e00-\u9fff\u3040-\u309f\u30a0-\u30ff]/g) || []).length
  const nonCjkLen = text.length - cjkCount
  return Math.ceil(nonCjkLen / 4 + cjkCount / 2)
}
