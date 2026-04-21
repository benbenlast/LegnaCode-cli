/**
 * Codex Skills Discovery
 *
 * Scans `~/.codex/skills/` (if it exists) and returns the directory path
 * so the standard skill loader can pick up Codex-format skills alongside
 * native LegnaCode skills.
 */

import { homedir } from "os"
import { join } from "path"
import { getFsImplementation } from "../utils/fsOperations.js"
import { logForDebugging } from "../utils/debug.js"

const CODEX_SKILLS_DIR = join(homedir(), ".codex", "skills")

/**
 * Returns the Codex skills directory path if it exists on disk.
 * Returns `null` if the directory doesn't exist or is inaccessible.
 */
export async function getCodexSkillsDir(): Promise<string | null> {
  try {
    const fs = getFsImplementation()
    const st = await fs.stat(CODEX_SKILLS_DIR)
    if (st.isDirectory()) {
      logForDebugging(`[codex-compat] Found Codex skills dir: ${CODEX_SKILLS_DIR}`)
      return CODEX_SKILLS_DIR
    }
  } catch {
    // Not found — expected on most machines
  }
  return null
}
