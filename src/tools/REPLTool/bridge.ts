/**
 * LegnaCode REPL bridge — injected into the JS REPL global scope.
 *
 * Provides a `legnacode` object that lets REPL code call LegnaCode tools,
 * read files, execute shell commands, and emit images.
 */

import { homedir, tmpdir } from 'os'

export interface ToolRunner {
  run(name: string, args: Record<string, unknown>): Promise<unknown>
}

export interface LegnaCodeBridge {
  /** Call any LegnaCode tool by name. */
  tool(name: string, args: Record<string, unknown>): Promise<unknown>
  /** Emit an image (base64 string or file path). */
  emitImage(imageLike: string | Buffer): Promise<{ type: 'image'; data: string }>
  /** Current working directory. */
  cwd: string
  /** User home directory. */
  homeDir: string
  /** System temp directory. */
  tmpDir: string
  /** Read a file (shortcut for tool('Read', ...)). */
  readFile(path: string): Promise<unknown>
  /** Execute a shell command (shortcut for tool('Bash', ...)). */
  exec(command: string): Promise<unknown>
  /** Search files by glob pattern. */
  glob(pattern: string, path?: string): Promise<unknown>
  /** Search file contents by regex. */
  grep(pattern: string, path?: string): Promise<unknown>
}

/**
 * Create a LegnaCode bridge object for injection into the REPL context.
 */
export function createLegnaCodeBridge(toolRunner: ToolRunner): LegnaCodeBridge {
  return {
    async tool(name: string, args: Record<string, unknown>) {
      return toolRunner.run(name, args)
    },

    async emitImage(imageLike: string | Buffer) {
      let data: string
      if (Buffer.isBuffer(imageLike)) {
        data = imageLike.toString('base64')
      } else if (imageLike.length < 500 && !imageLike.includes('\n')) {
        // Likely a file path — read it
        const { readFileSync } = await import('fs')
        const buf = readFileSync(imageLike)
        data = buf.toString('base64')
      } else {
        // Already base64
        data = imageLike
      }
      return { type: 'image' as const, data }
    },

    cwd: process.cwd(),
    homeDir: homedir(),
    tmpDir: tmpdir(),

    async readFile(path: string) {
      return toolRunner.run('Read', { file_path: path })
    },

    async exec(command: string) {
      return toolRunner.run('Bash', { command })
    },

    async glob(pattern: string, path?: string) {
      const args: Record<string, unknown> = { pattern }
      if (path) args.path = path
      return toolRunner.run('Glob', args)
    },

    async grep(pattern: string, path?: string) {
      const args: Record<string, unknown> = { pattern }
      if (path) args.path = path
      return toolRunner.run('Grep', args)
    },
  }
}
