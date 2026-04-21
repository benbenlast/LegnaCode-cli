/**
 * JSON-RPC filesystem methods — file operations for IDE integration.
 */

import { readFileSync, writeFileSync, mkdirSync, readdirSync, statSync } from 'fs'
import type { JsonRpcRouter } from '../router.js'

interface ReadFileParams {
  path: string
  encoding?: string
}

interface WriteFileParams {
  path: string
  content: string
  encoding?: string
}

interface ReadDirectoryParams {
  path: string
  recursive?: boolean
}

interface GetMetadataParams {
  path: string
}

export function registerFsMethods(router: JsonRpcRouter): void {
  router.register('fs/readFile', async (params) => {
    const p = params as ReadFileParams
    if (!p?.path) throw new Error('Invalid params: path required.')
    const content = readFileSync(p.path, (p.encoding ?? 'utf-8') as BufferEncoding)
    return { path: p.path, content }
  })

  router.register('fs/writeFile', async (params) => {
    const p = params as WriteFileParams
    if (!p?.path || p.content === undefined) {
      throw new Error('Invalid params: path and content required.')
    }
    writeFileSync(p.path, p.content, (p.encoding ?? 'utf-8') as BufferEncoding)
    return { path: p.path, written: true }
  })

  router.register('fs/createDirectory', async (params) => {
    const p = params as { path: string; recursive?: boolean }
    if (!p?.path) throw new Error('Invalid params: path required.')
    mkdirSync(p.path, { recursive: p.recursive ?? true })
    return { path: p.path, created: true }
  })

  router.register('fs/readDirectory', async (params) => {
    const p = params as ReadDirectoryParams
    if (!p?.path) throw new Error('Invalid params: path required.')
    const entries = readdirSync(p.path, { withFileTypes: true })
    return {
      path: p.path,
      entries: entries.map(e => ({
        name: e.name,
        type: e.isDirectory() ? 'directory' : e.isFile() ? 'file' : 'other',
      })),
    }
  })

  router.register('fs/getMetadata', async (params) => {
    const p = params as GetMetadataParams
    if (!p?.path) throw new Error('Invalid params: path required.')
    const stat = statSync(p.path)
    return {
      path: p.path,
      size: stat.size,
      isFile: stat.isFile(),
      isDirectory: stat.isDirectory(),
      createdAt: stat.birthtime.toISOString(),
      modifiedAt: stat.mtime.toISOString(),
      permissions: stat.mode.toString(8),
    }
  })
}
