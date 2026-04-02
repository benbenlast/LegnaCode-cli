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

const result = await Bun.build({
  entrypoints: [resolve(ROOT, 'src/entrypoints/cli.tsx')],
  outdir: resolve(ROOT, '.compile-tmp'),
  target: 'bun',
  compile: true,
  define: defines,
  features,
  external: [
    '@ant/claude-for-chrome-mcp',
    '@ant/computer-use-input',
    '@ant/computer-use-mcp',
    '@ant/computer-use-mcp/sentinelApps',
    '@ant/computer-use-mcp/types',
    '@ant/computer-use-swift',
    '@anthropic-ai/mcpb',
    '@anthropic-ai/sandbox-runtime',
    '@anthropic-ai/claude-agent-sdk',
    'audio-capture.node',
    'audio-capture-napi',
    'modifiers-napi',
    'color-diff-napi',
  ],
})

if (!result.success) {
  console.error('Compile failed:')
  for (const log of result.logs) {
    console.error(log)
  }
  process.exit(1)
}

// Move binary to project root
const { renameSync, rmSync } = await import('fs')
const tmpBin = resolve(ROOT, '.compile-tmp/cli')
const outBin = resolve(ROOT, 'legna')
try { renameSync(tmpBin, outBin) } catch { /* cross-device */
  const { copyFileSync } = await import('fs')
  copyFileSync(tmpBin, outBin)
}
rmSync(resolve(ROOT, '.compile-tmp'), { recursive: true, force: true })

console.log(`Compiled: ${outBin}`)
