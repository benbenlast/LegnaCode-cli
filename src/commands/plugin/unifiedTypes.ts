/**
 * Unified installed item types for plugin management UI.
 */

export type UnifiedInstalledItem =
  | {
      type: 'plugin'; id: string; name: string; description?: string; marketplace: string
      scope: string; isEnabled: boolean; errorCount: number; errors: unknown[]
      plugin: unknown; pendingEnable?: boolean; pendingUpdate?: boolean
      pendingToggle?: 'will-enable' | 'will-disable'
    }
  | {
      type: 'flagged-plugin'; id: string; name: string; marketplace: string
      scope: string; reason: string; text: string; flaggedAt: string
    }
  | {
      type: 'failed-plugin'; id: string; name: string; marketplace: string
      scope: string; errorCount: number; errors: unknown[]
    }
  | {
      type: 'mcp'; id: string; name: string; description?: string
      scope: string; status: string; client: unknown; indented?: boolean
    }
