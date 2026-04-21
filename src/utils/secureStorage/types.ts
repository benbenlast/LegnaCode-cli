/**
 * Secure storage types for credential management.
 */

export type SecureStorageData = {
  mcpOAuth?: Record<string, {
    serverName: string
    serverUrl: string
    accessToken: string
    refreshToken?: string
    expiresAt: number
    clientId?: string
    clientSecret?: string
    scope?: string
    stepUpScope?: string
    discoveryState?: {
      authorizationServerUrl?: string
      resourceMetadataUrl?: string
    }
  }>
  [key: string]: unknown
}

export interface SecureStorage {
  name: string
  read(): SecureStorageData | null
  readAsync(): Promise<SecureStorageData | null>
  update(data: SecureStorageData): { success: boolean; warning?: string }
  delete(): void
}
