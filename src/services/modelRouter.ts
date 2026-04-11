/**
 * Smart Model Router — routes tasks to appropriate model tiers.
 *
 * Heuristics:
 * - Simple: single-file read, short Q&A, formatting → haiku/fast
 * - Medium: multi-file edit, code generation → sonnet/default
 * - Complex: architecture, large refactor, agent orchestration → opus/strong
 *
 * When using MiniMax: simple → MiniMax-M2.7-highspeed, complex → MiniMax-M2.7
 */

import { logForDebugging } from '../utils/debug.js'

export type TaskComplexity = 'simple' | 'medium' | 'complex'

interface RoutingHint {
  complexity: TaskComplexity
  reason: string
}

// Patterns that suggest simple tasks
const SIMPLE_PATTERNS = [
  /^(what|how|why|where|when|who|which|is|are|does|do|can|will)\b/i,
  /\b(explain|describe|summarize|list|show|tell)\b/i,
  /\b(format|lint|typo|rename|move)\b/i,
]

// Patterns that suggest complex tasks
const COMPLEX_PATTERNS = [
  /\b(refactor|redesign|architect|migrate|rewrite)\b/i,
  /\b(implement|build|create|develop)\b.*\b(system|framework|engine|pipeline)\b/i,
  /\b(plan|strategy|design)\b.*\b(for|to)\b/i,
  /\b(multi.?file|across|entire|whole|all files)\b/i,
]

/**
 * Estimate task complexity from user prompt.
 */
export function estimateComplexity(prompt: string): RoutingHint {
  const trimmed = prompt.trim()

  // Very short prompts are usually simple
  if (trimmed.length < 50) {
    for (const pat of SIMPLE_PATTERNS) {
      if (pat.test(trimmed)) {
        return { complexity: 'simple', reason: 'short question pattern' }
      }
    }
  }

  // Check complex patterns
  for (const pat of COMPLEX_PATTERNS) {
    if (pat.test(trimmed)) {
      return { complexity: 'complex', reason: `matches: ${pat.source.slice(0, 40)}` }
    }
  }

  // Long prompts with multiple requirements tend to be complex
  if (trimmed.length > 500 || (trimmed.match(/\n/g)?.length ?? 0) > 5) {
    return { complexity: 'complex', reason: 'long multi-requirement prompt' }
  }

  // Default to medium
  return { complexity: 'medium', reason: 'default' }
}

/**
 * Get the recommended model tier for a given complexity.
 * Returns a tier name that the caller maps to actual model strings.
 */
export function getModelTier(complexity: TaskComplexity): 'fast' | 'default' | 'strong' {
  switch (complexity) {
    case 'simple': return 'fast'
    case 'medium': return 'default'
    case 'complex': return 'strong'
  }
}

/**
 * Log routing decision for diagnostics.
 */
export function logRoutingDecision(prompt: string, hint: RoutingHint): void {
  logForDebugging(
    `[modelRouter] complexity=${hint.complexity} reason="${hint.reason}" prompt="${prompt.slice(0, 60)}..."`,
  )
}
