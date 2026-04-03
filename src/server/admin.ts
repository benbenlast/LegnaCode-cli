/**
 * LegnaCode Admin WebUI — HTTP API + static file server.
 *
 * Bun.serve on port 3456. REST endpoints scoped by "claude" | "legna",
 * mapping to ~/.claude/ and ~/.legna/ respectively.
 */

import { readFileSync, writeFileSync, readdirSync, renameSync, copyFileSync, existsSync, mkdirSync } from 'fs'
import { resolve, join, extname } from 'path'

type Scope = 'claude' | 'legna'

function scopeDir(scope: Scope): string {
  const home = process.env.HOME || process.env.USERPROFILE || '~'
  return scope === 'claude' ? resolve(home, '.claude') : resolve(home, '.legna')
}

const MIME: Record<string, string> = {
  '.html': 'text/html',
  '.js': 'application/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
}

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
  })
}

function err(msg: string, status = 400) {
  return json({ error: msg }, status)
}

async function handleApi(req: Request, url: URL): Promise<Response> {
  const parts = url.pathname.replace(/^\/api\//, '').split('/')
  const method = req.method

  // GET /api/version
  if (parts[0] === 'version' && method === 'GET') {
    return json({ version: typeof MACRO !== 'undefined' ? MACRO.VERSION : '1.0.9' })
  }

  // POST /api/migrate
  if (parts[0] === 'migrate' && method === 'POST') {
    return handleMigrate(await req.json())
  }

  // Scoped endpoints: /api/:scope/...
  const scope = parts[0] as Scope
  if (scope !== 'claude' && scope !== 'legna') return err('Invalid scope', 404)
  const dir = scopeDir(scope)
  const sub = parts.slice(1).join('/')

  // GET /api/:scope/settings
  if (sub === 'settings' && method === 'GET') {
    try {
      const data = JSON.parse(readFileSync(join(dir, 'settings.json'), 'utf-8'))
      return json(data)
    } catch {
      return json({})
    }
  }

  // PUT /api/:scope/settings
  if (sub === 'settings' && method === 'PUT') {
    const body = await req.json()
    mkdirSync(dir, { recursive: true })
    writeFileSync(join(dir, 'settings.json'), JSON.stringify(body, null, 2) + '\n')
    return json({ ok: true })
  }

  // GET /api/:scope/profiles
  if (sub === 'profiles' && method === 'GET') {
    return handleProfiles(dir)
  }

  // POST /api/:scope/profiles/switch
  if (sub === 'profiles/switch' && method === 'POST') {
    const { filename } = await req.json() as { filename: string }
    return handleProfileSwitch(dir, filename)
  }

  // GET /api/:scope/sessions
  if (sub === 'sessions' && method === 'GET') {
    const limit = parseInt(url.searchParams.get('limit') || '50', 10)
    return handleSessions(dir, scope, limit)
  }

  return err('Not found', 404)
}

function handleProfiles(dir: string): Response {
  try {
    const files = readdirSync(dir).filter(f => f.startsWith('settings') && f.endsWith('.json'))
    const profiles = files.map(f => {
      try {
        const data = JSON.parse(readFileSync(join(dir, f), 'utf-8'))
        return {
          filename: f,
          baseUrl: data.env?.ANTHROPIC_BASE_URL || undefined,
          model: data.env?.ANTHROPIC_MODEL || data.env?.CLAUDE_MODEL || undefined,
          isActive: f === 'settings.json',
        }
      } catch {
        return { filename: f, isActive: f === 'settings.json' }
      }
    })
    return json(profiles)
  } catch {
    return json([])
  }
}

function handleProfileSwitch(dir: string, filename: string): Response {
  const active = join(dir, 'settings.json')
  const target = join(dir, filename)
  if (!existsSync(target)) return err('Profile not found', 404)
  if (filename === 'settings.json') return json({ ok: true })
  const tmp = join(dir, `settings.tmp.${Date.now()}.json`)
  try {
    if (existsSync(active)) {
      renameSync(active, tmp)
      renameSync(target, active)
      renameSync(tmp, target)
    } else {
      renameSync(target, active)
    }
    return json({ ok: true })
  } catch (e: any) {
    return err(e.message, 500)
  }
}

function handleSessions(dir: string, scope: Scope, limit: number): Response {
  const historyPath = join(dir, 'projects')
  const sessions: any[] = []
  try {
    const projects = readdirSync(historyPath)
    for (const proj of projects) {
      const projDir = join(historyPath, proj)
      // Each session is a <uuid>.jsonl file inside the project directory
      let files: string[]
      try { files = readdirSync(projDir).filter(f => f.endsWith('.jsonl')) } catch { continue }
      for (const file of files) {
        const sessionId = file.replace('.jsonl', '')
        const filePath = join(projDir, file)
        try {
          const raw = readFileSync(filePath, 'utf-8')
          const lines = raw.trim().split('\n').filter(Boolean)
          let timestamp = ''
          let cwd = ''
          let slug = ''
          let promptCount = 0
          for (const line of lines) {
            try {
              const entry = JSON.parse(line)
              if (entry.type === 'user') {
                promptCount++
                if (!timestamp && entry.timestamp) timestamp = entry.timestamp
                if (!cwd && entry.cwd) cwd = entry.cwd
                if (!slug && entry.slug) slug = entry.slug
              }
            } catch {}
          }
          if (!timestamp) continue
          sessions.push({
            id: sessionId,
            project: proj.replace(/-/g, '/'),
            cwd,
            slug,
            timestamp,
            promptCount,
            resumeCommand: `legna --resume ${sessionId}`,
          })
        } catch {}
      }
    }
  } catch {}
  sessions.sort((a, b) => (b.timestamp > a.timestamp ? 1 : -1))
  return json(sessions.slice(0, limit))
}

function handleMigrate(body: any): Response {
  const { from, to, fields } = body as { from: Scope; to: Scope; fields?: string[] }
  if (!from || !to) return err('Missing from/to')
  const srcFile = join(scopeDir(from), 'settings.json')
  const dstFile = join(scopeDir(to), 'settings.json')
  try {
    const srcData = JSON.parse(readFileSync(srcFile, 'utf-8'))
    mkdirSync(scopeDir(to), { recursive: true })
    if (!fields || fields.length === 0) {
      writeFileSync(dstFile, JSON.stringify(srcData, null, 2) + '\n')
      return json({ ok: true, migrated: Object.keys(srcData) })
    }
    let dstData: Record<string, any> = {}
    try { dstData = JSON.parse(readFileSync(dstFile, 'utf-8')) } catch {}
    const migrated: string[] = []
    for (const f of fields) {
      if (f in srcData) { dstData[f] = srcData[f]; migrated.push(f) }
    }
    writeFileSync(dstFile, JSON.stringify(dstData, null, 2) + '\n')
    return json({ ok: true, migrated })
  } catch (e: any) {
    return err(e.message, 500)
  }
}

// Static file serving for SPA
function serveStatic(url: URL): Response {
  const distDir = resolve(import.meta.dir, '../../webui/dist')
  const filePath = join(distDir, url.pathname === '/' ? 'index.html' : url.pathname)

  if (existsSync(filePath)) {
    const ext = extname(filePath)
    return new Response(Bun.file(filePath), {
      headers: { 'Content-Type': MIME[ext] || 'application/octet-stream' },
    })
  }

  // SPA fallback: non-asset paths → index.html
  const indexPath = join(distDir, 'index.html')
  if (existsSync(indexPath)) {
    return new Response(Bun.file(indexPath), {
      headers: { 'Content-Type': 'text/html' },
    })
  }

  return new Response('Admin UI not built. Run: cd webui && npm install && npm run build', {
    status: 404,
    headers: { 'Content-Type': 'text/plain' },
  })
}

export async function startAdminServer(opts: { port?: number } = {}) {
  const port = opts.port || 3456

  const server = Bun.serve({
    port,
    async fetch(req) {
      const url = new URL(req.url)

      if (req.method === 'OPTIONS') {
        return new Response(null, {
          headers: {
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'GET, PUT, POST, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type',
          },
        })
      }

      if (url.pathname.startsWith('/api/')) {
        try {
          return await handleApi(req, url)
        } catch (e: any) {
          return err(e.message, 500)
        }
      }

      return serveStatic(url)
    },
  })

  console.log(`\n  LegnaCode Admin WebUI`)
  console.log(`  http://localhost:${port}\n`)

  try {
    const { exec } = await import('child_process')
    const cmd = process.platform === 'darwin' ? 'open' : process.platform === 'win32' ? 'start' : 'xdg-open'
    exec(`${cmd} http://localhost:${port}`)
  } catch {}

  return server
}

if (import.meta.main) {
  startAdminServer()
}