/**
 * Compile script for Claude Code CLI standalone binary.
 *
 * Reads bunfig.toml for MACRO defines and feature flags, then compiles
 * a standalone binary via Bun.build({ compile: true }).
 *
 * Usage:
 *   bun run scripts/compile.ts
 */

import { readFileSync } from 'fs'
import { resolve } from 'path'

const ROOT = resolve(import.meta.dir, '..')

function parseBunfig(): {
  defines: Record<string, string>
  features: string[]
} {
  const content = readFileSync(resolve(ROOT, 'bunfig.toml'), 'utf-8')
  const defines: Record<string, string> = {}
  const features: string[] = []
  let section: 'define' | 'features' | null = null
  for (const line of content.split('\n')) {
    const trimmed = line.trim()
    if (trimmed === '[bundle.define]') { section = 'define'; continue }
    if (trimmed === '[bundle.features]') { section = 'features'; continue }
    if (trimmed.startsWith('[')) { section = null; continue }
    if (!line.includes('=')) continue
    const [key, ...rest] = line.split('=')
    const k = key!.trim().replace(/"/g, '')
    const v = rest.join('=').trim()
    if (section === 'define') {
      defines[k] = v
    } else if (section === 'features' && v === 'true') {
      features.push(k)
    }
  }
  return { defines, features }
}

const { defines, features } = parseBunfig()

// Override build-time stamp
defines['MACRO.BUILD_TIME'] = `'"${new Date().toISOString()}"'`

// Parse --target flag for cross-compilation (e.g. --target=bun-darwin-arm64)
const targetArg = process.argv.find(a => a.startsWith('--target='))
const target = targetArg ? targetArg.split('=')[1] : undefined

const result = await Bun.build({
  entrypoints: [resolve(ROOT, 'src/entrypoints/cli.tsx')],
  outdir: resolve(ROOT, '.compile-tmp'),
  target: target ?? 'bun',
  compile: true,
  define: defines,
  features,
  external: [],
})

if (!result.success) {
  console.error('Compile failed:')
  for (const log of result.logs) {
    console.error(log)
  }
  process.exit(1)
}

// Move binary to project root
const { renameSync, rmSync, existsSync } = await import('fs')
const ext = process.platform === 'win32' ? '.exe' : ''
const tmpBin = resolve(ROOT, `.compile-tmp/cli${ext}`)
const outBin = resolve(ROOT, `legna${ext}`)
try { renameSync(tmpBin, outBin) } catch { /* cross-device */
  const { copyFileSync } = await import('fs')
  copyFileSync(tmpBin, outBin)
}
rmSync(resolve(ROOT, '.compile-tmp'), { recursive: true, force: true })

console.log(`Compiled: ${outBin}`)
