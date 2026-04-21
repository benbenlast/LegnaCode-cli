/**
 * Codex Configuration Compatibility
 *
 * Bidirectional config mapping between LegnaCode and Codex.
 */

export {
  readCodexConfig,
  readCodexConfigSync,
  mapCodexToLegnaSettings,
} from "./codexConfigReader.js"
export type {
  CodexConfig,
  CodexProviderConfig,
  CodexMcpServerConfig,
  LegnaCodeSettingsPartial,
} from "./codexConfigReader.js"

export {
  mapLegnaToCodexConfig,
  writeCodexConfig,
} from "./codexConfigWriter.js"
