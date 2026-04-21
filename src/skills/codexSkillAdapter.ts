/**
 * Codex SKILL.md Adapter
 *
 * Codex skills use the same SKILL.md convention but with slightly different
 * frontmatter field names. This adapter normalises Codex frontmatter into
 * the LegnaCode-native shape so the standard skill loader can consume them.
 *
 * Codex frontmatter differences:
 *   - `triggers` → mapped to `when_to_use`
 *   - `tools`    → mapped to `allowed-tools`
 *   - `invoke`   → mapped to `argument-hint`
 *   - `context_limit` → ignored (LegnaCode handles this automatically)
 */

import type { FrontmatterData } from "../utils/frontmatterParser.js"

/**
 * Detect whether a parsed frontmatter block looks like Codex format
 * (has Codex-specific keys that LegnaCode doesn't use).
 */
export function isCodexFrontmatter(fm: FrontmatterData): boolean {
  return (
    fm.triggers !== undefined ||
    fm.invoke !== undefined ||
    fm.context_limit !== undefined ||
    (fm.tools !== undefined && fm["allowed-tools"] === undefined)
  )
}

/**
 * Normalise Codex frontmatter fields into LegnaCode equivalents.
 * Returns a new object — the original is not mutated.
 */
export function normaliseCodexFrontmatter(fm: FrontmatterData): FrontmatterData {
  if (!isCodexFrontmatter(fm)) return fm

  const out: FrontmatterData = { ...fm }

  // triggers → when_to_use
  if (out.triggers && !out.when_to_use) {
    out.when_to_use = Array.isArray(out.triggers)
      ? (out.triggers as string[]).join("; ")
      : out.triggers
    delete out.triggers
  }

  // tools → allowed-tools
  if (out.tools && !out["allowed-tools"]) {
    out["allowed-tools"] = out.tools
    delete out.tools
  }

  // invoke → argument-hint
  if (out.invoke && !out["argument-hint"]) {
    out["argument-hint"] = out.invoke
    delete out.invoke
  }

  // Drop Codex-only fields that have no LegnaCode equivalent
  delete out.context_limit

  return out
}
