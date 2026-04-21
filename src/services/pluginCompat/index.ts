/**
 * Codex Plugin Compatibility Layer
 *
 * Unified exports for all Codex → LegnaCode plugin compatibility modules.
 */

// Adapter: detect, load, and convert Codex plugin manifests
export {
  detectCodexPlugin,
  loadCodexManifest,
  codexManifestToNative,
  createLoadedPluginFromCodex,
} from "./codexPluginAdapter.js"
export type {
  CodexPluginManifest,
  CodexPermissions,
  CodexToolDef,
  CodexMcpDef,
  CodexHookDef,
  CodexCommandDef,
} from "./codexPluginAdapter.js"

// Marketplace: fetch, cache, and convert Codex registries
export {
  fetchCodexRegistry,
  fetchAnyCodexRegistry,
  cacheCodexRegistry,
  loadCachedCodexRegistry,
  codexEntryToMarketplaceEntry,
  codexRegistryToMarketplace,
  getCodexCompatMarketplace,
} from "./codexMarketplace.js"
export type {
  CodexRegistryIndex,
  CodexRegistryEntry,
  CodexInstallInfo,
} from "./codexMarketplace.js"

// Installation policy
export {
  evaluateInstallPolicy,
} from "./installationPolicy.js"
export type {
  InstallPolicyResult,
  CodexCapability,
} from "./installationPolicy.js"

// Auth policy
export {
  evaluateAuthPolicy,
} from "./authPolicy.js"
export type {
  CodexAuthDescriptor,
  AuthPolicyResult,
} from "./authPolicy.js"
