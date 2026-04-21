/**
 * Type declarations for external packages without bundled types.
 */

declare module 'cacache' {
  export function get(cachePath: string, key: string): Promise<{ data: Buffer; metadata: unknown; integrity: string }>
  export function put(cachePath: string, key: string, data: Buffer | string, opts?: unknown): Promise<string>
  export function rm(cachePath: string, key: string): Promise<void>
  export function ls(cachePath: string): Promise<Record<string, unknown>>
  export function verify(cachePath: string): Promise<unknown>
}

declare module 'cli-highlight' {
  export interface HighlightOptions {
    language?: string
    ignoreIllegals?: boolean
    theme?: Record<string, string | ((s: string) => string)>
  }
  export function highlight(code: string, options?: HighlightOptions): string
  export function supportsLanguage(language: string): boolean
  export function listLanguages(): string[]
}

declare module 'image-processor-napi' {
  export function processImage(input: Buffer | Uint8Array, options?: {
    maxWidth?: number
    maxHeight?: number
    quality?: number
    format?: string
  }): Promise<{ data: Buffer; width: number; height: number; format: string }>
}

declare module 'plist' {
  export function parse(input: string): unknown
  export function build(obj: unknown): string
}

declare module 'url-handler-napi' {
  export function register(scheme: string): boolean
  export function unregister(scheme: string): boolean
  export function isRegistered(scheme: string): boolean
}
