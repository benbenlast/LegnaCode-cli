/**
 * File Search TypeScript binding — wraps native Rust addon with TS fallback.
 *
 * Uses the Rust `nucleo-matcher` + `ignore` crate when available,
 * falls back to existing GlobTool logic otherwise.
 */

import {
  fileSearchAddon,
  hasNativeFileSearch,
  type NativeSearchOptions,
  type NativeSearchResult,
} from './index.js'

export interface FuzzySearchOptions {
  maxResults?: number
  extensions?: string[]
  followSymlinks?: boolean
  respectGitignore?: boolean
}

export interface FuzzySearchResult {
  path: string
  score: number
}

/**
 * Fuzzy file search — returns paths ranked by match score.
 * 3-5x faster than Node.js fast-glob on large monorepos when native addon is available.
 */
export function nativeFuzzySearch(
  query: string,
  rootDir: string,
  options?: FuzzySearchOptions,
): FuzzySearchResult[] | null {
  if (!hasNativeFileSearch || !fileSearchAddon) {
    return null // Caller should fallback to TS implementation
  }

  const nativeOpts: NativeSearchOptions = {
    max_results: options?.maxResults ?? 50,
    extensions: options?.extensions,
    follow_symlinks: options?.followSymlinks ?? false,
    respect_gitignore: options?.respectGitignore ?? true,
  }

  const results: NativeSearchResult[] = fileSearchAddon.fuzzySearch(query, rootDir, nativeOpts)
  return results.map((r) => ({ path: r.path, score: r.score }))
}

/**
 * Glob pattern search — returns matching file paths.
 * Returns null if native addon is unavailable (caller should fallback).
 */
export function nativeGlobSearch(
  pattern: string,
  rootDir: string,
): string[] | null {
  if (!hasNativeFileSearch || !fileSearchAddon) {
    return null
  }

  return fileSearchAddon.globSearch(pattern, rootDir)
}

/** Whether the native file search addon is loaded. */
export { hasNativeFileSearch }
