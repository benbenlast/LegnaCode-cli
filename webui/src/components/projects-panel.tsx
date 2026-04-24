import { useState, useEffect } from 'react'

interface Project {
  id: string
  name: string
  path: string
  exists: boolean
  source: 'claude' | 'legna' | 'both'
  sessionCount: number
  lastActive: string | null
  memorySize: number | null
  migratedLocal: boolean
}

export function ProjectsPanel() {
  const [projects, setProjects] = useState<Project[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState('')
  const [migrating, setMigrating] = useState<string | null>(null)

  const load = () => {
    setLoading(true)
    fetch('/api/projects')
      .then(r => r.json())
      .then(setProjects)
      .catch(() => {})
      .finally(() => setLoading(false))
  }

  useEffect(load, [])

  const migrateLocal = async (id: string) => {
    setMigrating(id)
    try {
      const r = await fetch(`/api/projects/${id}/migrate-local`, { method: 'POST' })
      const data = await r.json()
      if (data.ok) load()
      else alert(data.error || 'Migration failed')
    } catch (e: any) {
      alert(e.message)
    }
    setMigrating(null)
  }

  const restore = async (id: string) => {
    if (!confirm('恢复到 Claude？这会将本地会话复制回 ~/.claude/projects/')) return
    try {
      await fetch(`/api/projects/${id}/restore`, { method: 'POST' })
      load()
    } catch {}
  }

  const filtered = projects.filter(p =>
    p.name.toLowerCase().includes(filter.toLowerCase()) ||
    p.path.toLowerCase().includes(filter.toLowerCase())
  )

  const formatDate = (d: string | null) => {
    if (!d) return '—'
    return new Date(d).toLocaleDateString('zh-CN', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
  }

  const formatSize = (b: number | null) => {
    if (b === null) return '—'
    if (b < 1024) return `${b}B`
    if (b < 1024 * 1024) return `${(b / 1024).toFixed(1)}KB`
    return `${(b / 1024 / 1024).toFixed(1)}MB`
  }

  if (loading) return <div className="text-gray-400 text-center py-12">加载中...</div>

  return (
    <div>
      <div className="flex items-center gap-4 mb-6">
        <input
          type="text"
          placeholder="搜索项目..."
          value={filter}
          onChange={e => setFilter(e.target.value)}
          className="flex-1 px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-sm text-gray-200 placeholder-gray-500 focus:outline-none focus:border-blue-500"
        />
        <span className="text-xs text-gray-500">{filtered.length} 个项目</span>
      </div>

      {filtered.length === 0 ? (
        <div className="text-gray-500 text-center py-12">未找到项目</div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filtered.map(p => (
            <div
              key={p.id}
              className={`rounded-xl border p-4 transition-all hover:shadow-lg ${
                p.exists
                  ? 'border-gray-700 bg-gray-800/50 hover:border-gray-600'
                  : 'border-red-900/50 bg-red-950/20 hover:border-red-800/50'
              }`}
            >
              <div className="flex items-start justify-between mb-2">
                <div className="flex items-center gap-2">
                  <span className="text-base font-medium text-gray-100">{p.name}</span>
                  {!p.exists && (
                    <span className="px-1.5 py-0.5 text-[10px] bg-red-900/50 text-red-400 rounded">路径不存在</span>
                  )}
                  {p.migratedLocal && (
                    <span className="px-1.5 py-0.5 text-[10px] bg-green-900/50 text-green-400 rounded">已迁移</span>
                  )}
                </div>
                <span className={`px-1.5 py-0.5 text-[10px] rounded ${
                  p.source === 'both' ? 'bg-purple-900/50 text-purple-400' :
                  p.source === 'claude' ? 'bg-blue-900/50 text-blue-400' :
                  'bg-cyan-900/50 text-cyan-400'
                }`}>
                  {p.source === 'both' ? 'Claude + Legna' : p.source === 'claude' ? 'Claude' : 'Legna'}
                </span>
              </div>

              <p className="text-xs text-gray-500 font-mono mb-3 truncate" title={p.path}>{p.path}</p>

              <div className="flex items-center gap-4 text-xs text-gray-400 mb-3">
                <span>{p.sessionCount} 个会话</span>
                <span>最后活跃: {formatDate(p.lastActive)}</span>
                <span>记忆: {formatSize(p.memorySize)}</span>
              </div>

              <div className="flex gap-2">
                {p.exists && !p.migratedLocal && (
                  <button
                    onClick={() => migrateLocal(p.id)}
                    disabled={migrating === p.id}
                    className="px-2.5 py-1 text-xs bg-blue-600 hover:bg-blue-500 text-white rounded-md disabled:opacity-50 transition-colors"
                  >
                    {migrating === p.id ? '迁移中...' : '迁移到本地'}
                  </button>
                )}
                {p.migratedLocal && (
                  <button
                    onClick={() => restore(p.id)}
                    className="px-2.5 py-1 text-xs bg-gray-700 hover:bg-gray-600 text-gray-300 rounded-md transition-colors"
                  >
                    恢复到 Claude
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
