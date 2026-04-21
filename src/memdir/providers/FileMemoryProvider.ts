/**
 * File Memory Provider — default built-in implementation.
 *
 * Now backed by DrawerStore (SQLite + TF-IDF vector search) with
 * 4-layer memory stack from mempalace architecture.
 * Falls back to plain .md file search when DrawerStore is not initialized.
 */

import { readFile, readdir, mkdir, writeFile as fsWriteFile } from 'fs/promises'
import { join, basename } from 'path'
import { existsSync } from 'fs'
import { createHash } from 'crypto'
import { MemoryProvider, type ToolSchema } from './MemoryProvider.js'
import { getCwd } from '../../utils/cwd.js'
import { logForDebugging } from '../../utils/debug.js'
import { DrawerStore } from '../vectorStore/drawerStore.js'
import { LayeredStack } from '../vectorStore/layeredStack.js'
import { extractExchangePairs, pairsToDrawers } from '../vectorStore/exchangeExtractor.js'
import { detectRoom } from '../vectorStore/roomDetector.js'
import { migrateMemoryFiles, extractIdentity } from '../vectorStore/migration.js'

export class FileMemoryProvider extends MemoryProvider {
  readonly name = 'builtin'
  private memoryDir: string = ''
  private store: DrawerStore | null = null
  private stack: LayeredStack | null = null
  private projectSlug: string = '_project'
  // TTL cache for file reads (60s)
  private _solutionsCache: { ts: number; data: Map<string, string> } = { ts: 0, data: new Map() }
  private _memoryCache: { ts: number; data: Map<string, string> } = { ts: 0, data: new Map() }

  isAvailable(): boolean {
    return true
  }

  async initialize(sessionId: string): Promise<void> {
    const cwd = getCwd()
    this.memoryDir = join(cwd, '.legna', 'memory')
    this.projectSlug = basename(cwd)
    await mkdir(this.memoryDir, { recursive: true })

    // Initialize DrawerStore
    const palaceDir = join(cwd, '.legna', '.palace')
    const dbPath = join(palaceDir, 'drawers.sqlite3')
    try {
      this.store = new DrawerStore(dbPath)
      const stats = this.store.stats()

      // Auto-migrate on first run (no drawers yet)
      if (stats.totalDrawers === 0) {
        logForDebugging('[FileMemoryProvider] First run — migrating .md files to DrawerStore...')
        const result = await migrateMemoryFiles(this.memoryDir, this.store, this.projectSlug)
        logForDebugging(`[FileMemoryProvider] Migration: ${result.migrated} drawers, ${result.skipped} skipped`)
      }

      // Build layered stack
      const identity = await extractIdentity(this.memoryDir)
      this.stack = new LayeredStack(this.store, identity)

      logForDebugging(`[FileMemoryProvider] Initialized with DrawerStore (${this.store.stats().totalDrawers} drawers) for session ${sessionId}`)
    } catch (err) {
      logForDebugging(`[FileMemoryProvider] DrawerStore init failed, falling back to plain files: ${err}`)
      this.store = null
      this.stack = null
    }
  }

  systemPromptBlock(): string {
    // Budget-aware wake-up with L0/L1 degradation
    if (this.stack) {
      const result = this.stack.wakeUp(this.projectSlug, 800)
      if (result.text) {
        logForDebugging(`[FileMemoryProvider] Wake-up: ${result.tokenEstimate} tokens, ${result.drawerCount} drawers`)
        return result.text
      }
    }
    return ''
  }

  async prefetch(query: string): Promise<string> {
    const parts: string[] = []

    // Budget-capped recall with L2→L1→L0 degradation (OpenViking strategy)
    if (this.store && this.stack) {
      const items = this.stack.recallWithBudget(query, this.projectSlug, 4000)
      if (items.length > 0) {
        parts.push(this.stack.formatTieredRecall(items, 'Relevant Context'))
      }
    }

    // Compound engineering: search docs/solutions/ for past learnings
    const solutionHits = await this.searchSolutions(query)
    if (solutionHits) parts.push(solutionHits)

    if (parts.length > 0) return parts.join('\n\n')

    // Fallback: plain keyword search (with TTL cache)
    const keywords = query.toLowerCase().split(/\s+/).filter(w => w.length > 2)
    if (keywords.length === 0) return ''
    try {
      const now = Date.now()
      if (now - this._memoryCache.ts > 60_000) {
        this._memoryCache.data.clear()
        const files = (await readdir(this.memoryDir)).filter(f => f.endsWith('.md'))
        for (const file of files) {
          this._memoryCache.data.set(file, await readFile(join(this.memoryDir, file), 'utf-8'))
        }
        this._memoryCache.ts = now
      }
      const matches: string[] = []
      for (const [file, content] of this._memoryCache.data) {
        const lower = content.toLowerCase()
        const score = keywords.filter(kw => lower.includes(kw)).length
        if (score > 0) matches.push(`[${file}] ${content.slice(0, 200)}`)
      }
      if (matches.length > 0) return `Relevant memory:\n${matches.slice(0, 5).join('\n---\n')}`
    } catch {}
    return ''
  }

  /**
   * Compound engineering: search docs/solutions/ for past learnings.
   * Only active when docs/solutions/ exists and has >= 5 files.
   */
  private async searchSolutions(query: string): Promise<string | null> {
    const solutionsDir = join(getCwd(), 'docs', 'solutions')
    if (!existsSync(solutionsDir)) return null

    try {
      const keywords = query.toLowerCase().split(/\s+/).filter(w => w.length > 2)
      if (keywords.length === 0) return null

      // TTL cache: reload files at most once per 60s
      const now = Date.now()
      if (now - this._solutionsCache.ts > 60_000) {
        this._solutionsCache.data.clear()
        const files = (await readdir(solutionsDir)).filter(f => f.endsWith('.md'))
        for (const file of files.slice(-50)) {
          this._solutionsCache.data.set(file, await readFile(join(solutionsDir, file), 'utf-8'))
        }
        this._solutionsCache.ts = now
      }

      const hits: Array<{ file: string; score: number; preview: string }> = []
      for (const [file, content] of this._solutionsCache.data) {
        const lower = content.toLowerCase()
        const score = keywords.filter(kw => lower.includes(kw)).length
        if (score >= 2) {
          const problemMatch = content.match(/^problem:\s*"(.+?)"/m)
          const preview = problemMatch?.[1] || content.slice(0, 150)
          hits.push({ file, score, preview })
        }
      }

      if (hits.length === 0) return null
      hits.sort((a, b) => b.score - a.score)
      const lines = hits.slice(0, 3).map(h => `- [${h.file}] ${h.preview}`)
      return `[Past Learnings]\n${lines.join('\n')}`
    } catch {
      return null
    }
  }

  async syncTurn(userContent: string, assistantContent: string): Promise<void> {
    logForDebugging(`[FileMemoryProvider] syncTurn (${userContent.length} + ${assistantContent.length} chars)`)
  }

  getToolSchemas(): ToolSchema[] {
    return []
  }

  async shutdown(): Promise<void> {
    if (this.store) {
      this.store.close()
      this.store = null
    }
    logForDebugging('[FileMemoryProvider] Shutdown')
  }

  onSessionEnd(messages: unknown[]): void {
    logForDebugging(`[FileMemoryProvider] Session ended with ${messages.length} messages`)

    // AtomCode fusion: persist cross-session knowledge summary
    try {
      const { writeFileSync, existsSync, mkdirSync } = require('fs')
      const { join } = require('path')
      const { getCwd } = require('../utils/cwd.js')
      const cwd = getCwd()
      const legnaDir = join(cwd, '.legna')
      if (!existsSync(legnaDir)) mkdirSync(legnaDir, { recursive: true })
      const knowledgePath = join(legnaDir, 'knowledge.md')

      // Extract key decisions and actions from this session
      const entries: string[] = []
      const simplified = (messages as any[])
        .filter(m => m.type === 'assistant')
        .slice(-10) // last 10 assistant messages
      for (const m of simplified) {
        const content = m.message?.content
        let text = ''
        if (typeof content === 'string') text = content
        else if (Array.isArray(content)) {
          text = content.filter((b: any) => b.type === 'text').map((b: any) => b.text).join(' ')
        }
        // Extract lines that look like decisions/actions
        for (const line of text.split('\n')) {
          if (line.length > 30 && line.length < 200 &&
            /(?:created|modified|fixed|added|removed|updated|implemented|refactored|changed)/i.test(line)) {
            entries.push(line.trim())
          }
        }
      }

      if (entries.length > 0) {
        const timestamp = new Date().toISOString().slice(0, 19)
        const section = `\n## ${timestamp}\n${entries.slice(0, 10).map(e => `- ${e}`).join('\n')}\n`
        const existing = existsSync(knowledgePath) ? require('fs').readFileSync(knowledgePath, 'utf-8') : '# Session Knowledge\n'
        // Cap file at 50KB
        const combined = existing.length > 50000 ? existing.slice(-40000) + section : existing + section
        writeFileSync(knowledgePath, combined, 'utf-8')
        logForDebugging(`[FileMemoryProvider] Wrote ${entries.length} knowledge entries`)
      }
    } catch (e) {
      logForDebugging(`[FileMemoryProvider] knowledge.md write failed: ${e}`)
    }
  }

  onPreCompress(messages: unknown[]): string {
    // Extract exchange pairs AND working state from messages about to be compressed.
    if (!this.store) return ''

    try {
      const simplified = (messages as any[])
        .filter(m => m.type === 'user' || m.type === 'assistant')
        .map(m => {
          const content = m.message?.content
          let text = ''
          if (typeof content === 'string') text = content
          else if (Array.isArray(content)) {
            text = content.filter((b: any) => b.type === 'text').map((b: any) => b.text).join(' ')
          }
          return { type: m.type, content: text }
        })
        .filter(m => m.content.length > 20)

      // 1. Exchange pair extraction (existing)
      const pairs = extractExchangePairs(simplified)
      const drawers = pairsToDrawers(pairs, this.projectSlug, `compact-${Date.now()}`)

      if (drawers.length > 0) {
        this.store.upsertMany(drawers, 'precompress')
        logForDebugging(`[FileMemoryProvider] onPreCompress: saved ${drawers.length} exchange pairs to DrawerStore`)
        void this.compoundExtract(pairs, drawers)
      }

      // 2. Working state extraction — capture what the user is doing, not just Q&A pairs.
      //    This survives compaction so the agent can resume without losing context.
      const workingState = this.extractWorkingState(simplified)
      if (workingState.drawer) {
        this.store.upsert(workingState.drawer, 'precompress_state')
        logForDebugging(`[FileMemoryProvider] onPreCompress: saved working state to DrawerStore`)
      }

      const parts: string[] = []
      if (drawers.length > 0) parts.push(`Preserved ${drawers.length} key exchanges`)
      if (workingState.summary) parts.push(workingState.summary)

      return parts.length > 0 ? `[${parts.join('. ')}]` : ''
    } catch (err) {
      logForDebugging(`[FileMemoryProvider] onPreCompress error: ${err}`)
      return ''
    }
  }

  /**
   * Extract working state from messages about to be compressed.
   * Pure rule-based extraction (no LLM call — must be fast on the compact path).
   */
  private extractWorkingState(
    messages: Array<{ type: string; content: string }>,
  ): { summary: string; drawer: Drawer | null } {
    // Take the last ~10 messages for recency
    const recent = messages.slice(-10)
    const parts: string[] = []

    // Current task: last user message with substantial content
    const lastUserMsgs = recent.filter(m => m.type === 'user').slice(-2)
    for (const msg of lastUserMsgs) {
      const trimmed = msg.content.slice(0, 300).trim()
      if (trimmed.length > 30) parts.push(`Task: ${trimmed}`)
    }

    // Key decisions: assistant messages containing decision language
    const decisionPatterns = /(?:I(?:'ll| will)|Let's|chose|decided|going with|approach:|plan:|strategy:)/i
    for (const msg of recent.filter(m => m.type === 'assistant')) {
      for (const line of msg.content.split('\n')) {
        if (decisionPatterns.test(line) && line.length > 30 && line.length < 300) {
          parts.push(`Decision: ${line.trim()}`)
        }
      }
    }

    // File paths mentioned (from tool results or assistant text)
    const pathPattern = /(?:^|\s)((?:\/|\.\/|src\/|lib\/|test\/)\S+\.\w{1,6})/gm
    const paths = new Set<string>()
    for (const msg of recent) {
      for (const match of msg.content.matchAll(pathPattern)) {
        if (match[1] && paths.size < 10) paths.add(match[1])
      }
    }
    if (paths.size > 0) parts.push(`Files: ${[...paths].join(', ')}`)

    // Error patterns
    const errorPattern = /(?:error|Error|ERROR|failed|Failed|FAILED|exception|Exception):\s*(.{20,150})/
    for (const msg of recent.slice(-4)) {
      const match = msg.content.match(errorPattern)
      if (match?.[1]) {
        parts.push(`Error: ${match[1].trim()}`)
        break // only the most recent error
      }
    }

    if (parts.length === 0) return { summary: '', drawer: null }

    const content = parts.slice(0, 8).join('\n')
    const summary = `Working state: ${parts[0] ?? ''}`

    const id = createHash('sha256')
      .update(`${this.projectSlug}\0working_state\0${Date.now()}`)
      .digest('hex')
      .slice(0, 24)

    return {
      summary,
      drawer: {
        id,
        content,
        wing: this.projectSlug,
        room: 'working_state',
        sourceFile: `compact-state-${Date.now()}`,
        chunkIndex: 0,
        importance: 0.9, // high priority — recent working context
        addedBy: 'precompress_state',
        filedAt: new Date().toISOString(),
      },
    }
  }

  /**
   * Compound engineering: write high-value exchange pairs to docs/solutions/.
   * Only active when docs/solutions/ exists (user opt-in via mkdir).
   */
  private async compoundExtract(
    pairs: Array<{ user: string; assistant: string; score: number; markers: string[] }>,
    drawers: Array<{ content: string; room: string }>,
  ): Promise<void> {
    const solutionsDir = join(getCwd(), 'docs', 'solutions')
    if (!existsSync(solutionsDir)) return

    const highValue = pairs.filter(p => p.score >= 3)
    if (highValue.length === 0) return

    for (const pair of highValue) {
      const slug = pair.user.slice(0, 40).replace(/[^a-zA-Z0-9\u4e00-\u9fff]+/g, '-').replace(/-+$/, '').toLowerCase()
      const room = detectRoom(`${pair.user} ${pair.assistant}`)
      const tags = pair.markers.join(', ')
      const now = new Date().toISOString().split('T')[0]

      const content = `---
problem: "${pair.user.slice(0, 200).replace(/"/g, '\\"')}"
solution: "${pair.assistant.slice(0, 200).replace(/"/g, '\\"')}"
category: ${room}
tags: [${tags}]
confidence: ${Math.min(1.0, 0.5 + pair.score * 0.1).toFixed(1)}
created: ${now}
---

## Problem

${pair.user.slice(0, 500)}

## Solution

${pair.assistant.slice(0, 800)}
`
      const filePath = join(solutionsDir, `${now}-${slug || 'solution'}.md`)
      try {
        await fsWriteFile(filePath, content, 'utf-8')
        logForDebugging(`[compound] Wrote solution: ${filePath}`)
      } catch (err) {
        logForDebugging(`[compound] Failed to write solution: ${err}`)
      }
    }
  }
}
