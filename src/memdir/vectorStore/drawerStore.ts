/**
 * DrawerStore — SQLite-backed vector memory store with WAL audit trail.
 * Adapted from mempalace's palace.py. Uses bun:sqlite for zero-dependency persistence.
 */

import { Database } from 'bun:sqlite'
import { createHash } from 'crypto'
import { mkdirSync, existsSync, statSync } from 'fs'
import { dirname } from 'path'
import { TfidfVectorizer, cosineSimilarity } from './tfidfVectorizer.js'
import { generateL0, generateL1, estimateTokens } from './contentTiering.js'
import type {
  Drawer, SearchResult, SearchOptions, WalEntry, StoreStats, MetadataFilter,
} from './types.js'

/** Generate deterministic drawer ID. */
export function drawerId(wing: string, room: string, sourceFile: string, chunkIndex: number): string {
  return createHash('sha256')
    .update(`${wing}\0${room}\0${sourceFile}\0${chunkIndex}`)
    .digest('hex')
    .slice(0, 24)
}

export class DrawerStore {
  private db: Database
  private vectorizer: TfidfVectorizer
  private dirty = false

  constructor(dbPath: string) {
    const dir = dirname(dbPath)
    if (!existsSync(dir)) mkdirSync(dir, { recursive: true })

    this.db = new Database(dbPath)
    this.db.exec('PRAGMA journal_mode=WAL')
    this.db.exec('PRAGMA synchronous=NORMAL')
    this.initSchema()
    this.vectorizer = new TfidfVectorizer()
    this.rebuildVectorizer()
  }

  private initSchema(): void {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS drawers (
        id TEXT PRIMARY KEY,
        content TEXT NOT NULL,
        wing TEXT NOT NULL,
        room TEXT NOT NULL,
        source_file TEXT DEFAULT '',
        chunk_index INTEGER DEFAULT 0,
        importance REAL DEFAULT 0.5,
        added_by TEXT DEFAULT 'system',
        filed_at TEXT NOT NULL,
        source_mtime REAL DEFAULT 0,
        content_l0 TEXT DEFAULT '',
        content_l1 TEXT DEFAULT '',
        token_cost INTEGER DEFAULT 0,
        content_hash TEXT DEFAULT '',
        discovery_tokens INTEGER DEFAULT 0,
        read_tokens INTEGER DEFAULT 0,
        relevance_count INTEGER DEFAULT 0
      )
    `)
    // Migrate old schema: add new columns if missing
    try {
      this.db.exec('ALTER TABLE drawers ADD COLUMN content_l0 TEXT DEFAULT ""')
    } catch { /* column already exists */ }
    try {
      this.db.exec('ALTER TABLE drawers ADD COLUMN content_l1 TEXT DEFAULT ""')
    } catch { /* column already exists */ }
    try {
      this.db.exec('ALTER TABLE drawers ADD COLUMN token_cost INTEGER DEFAULT 0')
    } catch { /* column already exists */ }
    // claude-mem fusion: dedup, token economics, relevance feedback
    try {
      this.db.exec('ALTER TABLE drawers ADD COLUMN content_hash TEXT DEFAULT ""')
    } catch { /* column already exists */ }
    try {
      this.db.exec('ALTER TABLE drawers ADD COLUMN discovery_tokens INTEGER DEFAULT 0')
    } catch { /* column already exists */ }
    try {
      this.db.exec('ALTER TABLE drawers ADD COLUMN read_tokens INTEGER DEFAULT 0')
    } catch { /* column already exists */ }
    try {
      this.db.exec('ALTER TABLE drawers ADD COLUMN relevance_count INTEGER DEFAULT 0')
    } catch { /* column already exists */ }
    this.db.exec(`
      CREATE INDEX IF NOT EXISTS idx_drawers_wing ON drawers(wing)
    `)
    this.db.exec(`
      CREATE INDEX IF NOT EXISTS idx_drawers_room ON drawers(room)
    `)
    this.db.exec(`
      CREATE INDEX IF NOT EXISTS idx_drawers_importance ON drawers(importance DESC)
    `)
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS wal (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        operation TEXT NOT NULL,
        drawer_id TEXT NOT NULL,
        timestamp TEXT NOT NULL,
        agent TEXT DEFAULT 'system'
      )
    `)
    // IDF model cache
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS idf_cache (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL
      )
    `)
  }

  /** Rebuild TF-IDF vectorizer from all stored drawers. */
  private rebuildVectorizer(): void {
    const rows = this.db.query('SELECT content FROM drawers').all() as { content: string }[]
    if (rows.length === 0) return
    this.vectorizer.fit(rows.map(r => r.content))
    // Cache the IDF model
    this.db.query('INSERT OR REPLACE INTO idf_cache (key, value) VALUES (?, ?)')
      .run('idf_model', JSON.stringify(this.vectorizer.serialize()))
  }

  /** Upsert a drawer. Idempotent — same ID overwrites. Auto-generates L0/L1 tiers. Content-hash dedup within 30s window. */
  upsert(drawer: Drawer, agent = 'system'): void {
    const l0 = drawer.contentL0 || generateL0(drawer.content)
    const l1 = drawer.contentL1 || generateL1(drawer.content)
    const tc = drawer.tokenCost || estimateTokens(drawer.content)
    const hash = createHash('sha256').update(`${drawer.wing}\0${drawer.room}\0${drawer.content}`).digest('hex').slice(0, 32)
    const dt = drawer.discoveryTokens || estimateTokens(drawer.content)

    // Content-hash dedup: skip if same hash filed within 30 seconds
    const recent = this.db.query(
      `SELECT id FROM drawers WHERE content_hash = ? AND filed_at > datetime('now', '-30 seconds') LIMIT 1`
    ).get(hash) as any
    if (recent) return

    this.db.query(`
      INSERT OR REPLACE INTO drawers
        (id, content, wing, room, source_file, chunk_index, importance, added_by, filed_at, source_mtime, content_l0, content_l1, token_cost, content_hash, discovery_tokens, read_tokens, relevance_count)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, 0)
    `).run(
      drawer.id, drawer.content, drawer.wing, drawer.room,
      drawer.sourceFile ?? '', drawer.chunkIndex ?? 0,
      drawer.importance, drawer.addedBy, drawer.filedAt,
      drawer.sourceMtime ?? 0, l0, l1, tc, hash, dt,
    )
    // WAL
    this.db.query('INSERT INTO wal (operation, drawer_id, timestamp, agent) VALUES (?, ?, ?, ?)')
      .run('insert', drawer.id, new Date().toISOString(), agent)
    // Incremental IDF update
    this.vectorizer.addDocument(drawer.content)
    this.dirty = true
  }

  /** Bulk upsert for migration. */
  upsertMany(drawers: Drawer[], agent = 'system'): void {
    const tx = this.db.transaction(() => {
      for (const d of drawers) this.upsert(d, agent)
    })
    tx()
    if (this.dirty) this.rebuildVectorizer()
    this.dirty = false
  }

  /** Delete a drawer by ID. */
  delete(id: string, agent = 'system'): void {
    this.db.query('DELETE FROM drawers WHERE id = ?').run(id)
    this.db.query('INSERT INTO wal (operation, drawer_id, timestamp, agent) VALUES (?, ?, ?, ?)')
      .run('delete', id, new Date().toISOString(), agent)
  }

  /** Get a drawer by ID. */
  get(id: string): Drawer | null {
    const row = this.db.query('SELECT * FROM drawers WHERE id = ?').get(id) as any
    return row ? this.rowToDrawer(row) : null
  }

  /** Search drawers by vector similarity with optional metadata filtering. */
  search(query: string, opts: SearchOptions = {}): SearchResult[] {
    const topK = opts.topK ?? 10
    const minSim = opts.minSimilarity ?? 0.3

    // Build WHERE clause for metadata filtering
    const conditions: string[] = []
    const params: any[] = []
    if (opts.wing) { conditions.push('wing = ?'); params.push(opts.wing) }
    if (opts.room) { conditions.push('room = ?'); params.push(opts.room) }
    if (opts.minImportance) { conditions.push('importance >= ?'); params.push(opts.minImportance) }

    const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : ''
    const rows = this.db.query(`SELECT * FROM drawers ${where}`).all(...params) as any[]

    if (rows.length === 0) return []

    // Vectorize query
    const queryVec = this.vectorizer.vectorize(query)

    // Score each candidate with time decay
    const now = Date.now()
    const results: SearchResult[] = []
    for (const row of rows) {
      const docVec = this.vectorizer.vectorize(row.content)
      const sim = cosineSimilarity(queryVec, docVec)
      // 90-day time decay: max(0.3, 1.0 - age_days/90)
      const ageDays = (now - new Date(row.filed_at).getTime()) / 86400000
      const decay = Math.max(0.3, 1.0 - ageDays / 90)
      const effectiveSim = sim * decay
      if (effectiveSim >= minSim) {
        results.push({ drawer: this.rowToDrawer(row), similarity: effectiveSim })
      }
    }

    // Sort by similarity desc, take topK
    results.sort((a, b) => b.similarity - a.similarity)
    const topResults = results.slice(0, topK)

    // Relevance feedback: bump relevance_count + read_tokens for recalled drawers
    if (topResults.length > 0) {
      const ids = topResults.map(r => r.drawer.id)
      const placeholders = ids.map(() => '?').join(',')
      const readCost = estimateTokens(query)
      this.db.query(
        `UPDATE drawers SET relevance_count = relevance_count + 1, read_tokens = read_tokens + ? WHERE id IN (${placeholders})`
      ).run(readCost, ...ids)
    }

    return topResults
  }

  /** Get top drawers by effective importance (with time decay + relevance boost). */
  topByImportance(limit = 15, wing?: string): Drawer[] {
    const sql = wing
      ? 'SELECT * FROM drawers WHERE wing = ?'
      : 'SELECT * FROM drawers'
    const rows = (wing ? this.db.query(sql).all(wing) : this.db.query(sql).all()) as any[]

    // Score with time decay + relevance feedback
    const now = Date.now()
    const scored = rows.map(row => {
      const ageDays = (now - new Date(row.filed_at).getTime()) / 86400000
      const decay = Math.max(0.3, 1.0 - ageDays / 90)
      const relevanceBoost = 1 + 0.1 * Math.min(row.relevance_count ?? 0, 10)
      const effective = (row.importance ?? 0.5) * decay * relevanceBoost
      return { row, effective }
    })
    scored.sort((a, b) => b.effective - a.effective)
    return scored.slice(0, limit).map(s => this.rowToDrawer(s.row))
  }

  /** Get all unique wings. */
  wings(): string[] {
    return (this.db.query('SELECT DISTINCT wing FROM drawers').all() as { wing: string }[])
      .map(r => r.wing)
  }

  /** Get all unique rooms within a wing. */
  rooms(wing?: string): string[] {
    const sql = wing
      ? 'SELECT DISTINCT room FROM drawers WHERE wing = ?'
      : 'SELECT DISTINCT room FROM drawers'
    const rows = wing
      ? this.db.query(sql).all(wing) as { room: string }[]
      : this.db.query(sql).all() as { room: string }[]
    return rows.map(r => r.room)
  }

  /** Get store statistics. */
  stats(): StoreStats {
    const count = (this.db.query('SELECT COUNT(*) as c FROM drawers').get() as any).c
    return {
      totalDrawers: count,
      wings: this.wings(),
      rooms: this.rooms(),
      dbSizeBytes: existsSync(this.db.filename) ? statSync(this.db.filename).size : 0,
    }
  }

  /** Get WAL entries for audit. */
  walEntries(limit = 50): WalEntry[] {
    return this.db.query('SELECT * FROM wal ORDER BY id DESC LIMIT ?').all(limit) as WalEntry[]
  }

  /** Close the database. */
  close(): void {
    if (this.dirty) this.rebuildVectorizer()
    this.db.close()
  }

  private rowToDrawer(row: any): Drawer {
    return {
      id: row.id,
      content: row.content,
      wing: row.wing,
      room: row.room,
      sourceFile: row.source_file || undefined,
      chunkIndex: row.chunk_index ?? 0,
      importance: row.importance ?? 0.5,
      addedBy: row.added_by || 'system',
      filedAt: row.filed_at,
      sourceMtime: row.source_mtime || undefined,
      contentL0: row.content_l0 || undefined,
      contentL1: row.content_l1 || undefined,
      tokenCost: row.token_cost || undefined,
      discoveryTokens: row.discovery_tokens || undefined,
      readTokens: row.read_tokens || undefined,
      relevanceCount: row.relevance_count || undefined,
      contentHash: row.content_hash || undefined,
    }
  }
}
