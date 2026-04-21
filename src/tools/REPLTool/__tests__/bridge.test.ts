/**
 * Tests for the LegnaCode REPL bridge.
 */

import { describe, expect, it, vi } from 'vitest'
import { createLegnaCodeBridge, type ToolRunner } from '../bridge.js'

function mockToolRunner(): ToolRunner {
  return {
    run: vi.fn().mockResolvedValue({ ok: true }),
  }
}

describe('createLegnaCodeBridge', () => {
  it('exposes environment info', () => {
    const bridge = createLegnaCodeBridge(mockToolRunner())
    expect(bridge.cwd).toBe(process.cwd())
    expect(typeof bridge.homeDir).toBe('string')
    expect(typeof bridge.tmpDir).toBe('string')
  })

  it('tool() delegates to toolRunner', async () => {
    const runner = mockToolRunner()
    const bridge = createLegnaCodeBridge(runner)
    await bridge.tool('Grep', { pattern: 'TODO' })
    expect(runner.run).toHaveBeenCalledWith('Grep', { pattern: 'TODO' })
  })

  it('readFile() is a shortcut for Read tool', async () => {
    const runner = mockToolRunner()
    const bridge = createLegnaCodeBridge(runner)
    await bridge.readFile('/tmp/test.ts')
    expect(runner.run).toHaveBeenCalledWith('Read', { file_path: '/tmp/test.ts' })
  })

  it('exec() is a shortcut for Bash tool', async () => {
    const runner = mockToolRunner()
    const bridge = createLegnaCodeBridge(runner)
    await bridge.exec('ls -la')
    expect(runner.run).toHaveBeenCalledWith('Bash', { command: 'ls -la' })
  })

  it('glob() delegates to Glob tool', async () => {
    const runner = mockToolRunner()
    const bridge = createLegnaCodeBridge(runner)
    await bridge.glob('**/*.ts', '/src')
    expect(runner.run).toHaveBeenCalledWith('Glob', { pattern: '**/*.ts', path: '/src' })
  })

  it('grep() delegates to Grep tool', async () => {
    const runner = mockToolRunner()
    const bridge = createLegnaCodeBridge(runner)
    await bridge.grep('TODO')
    expect(runner.run).toHaveBeenCalledWith('Grep', { pattern: 'TODO' })
  })

  it('emitImage() handles base64 string', async () => {
    const bridge = createLegnaCodeBridge(mockToolRunner())
    const b64 = Buffer.from('fake-image-data').toString('base64')
    const longB64 = b64.repeat(50) // make it long enough to not be treated as path
    const result = await bridge.emitImage(longB64)
    expect(result.type).toBe('image')
    expect(result.data).toBe(longB64)
  })

  it('emitImage() handles Buffer', async () => {
    const bridge = createLegnaCodeBridge(mockToolRunner())
    const buf = Buffer.from('fake-image-data')
    const result = await bridge.emitImage(buf)
    expect(result.type).toBe('image')
    expect(result.data).toBe(buf.toString('base64'))
  })
})
