/**
 * Plugin settings view state types.
 */

export type ViewState =
  | { type: 'help' }
  | { type: 'validate'; path: string }
  | { type: 'browse-marketplace'; targetMarketplace: string; targetPlugin?: string }
  | { type: 'discover-plugins'; targetPlugin?: string }
  | { type: 'manage-plugins'; targetPlugin?: string; targetMarketplace?: string; action?: 'enable' | 'disable' | 'uninstall' }
  | { type: 'manage-marketplaces'; targetMarketplace?: string; action?: 'remove' | 'update' }
  | { type: 'add-marketplace'; initialValue?: string }
  | { type: 'marketplace-list' }
  | { type: 'marketplace-menu' }
  | { type: 'menu' }

export type PluginSettingsProps = {
  onComplete: (result?: string) => void
  args: string[]
  showMcpRedirectMessage?: boolean
}
