import { useState, useEffect } from 'react'
import type { Scope } from '../api/client'
import { getSettings, migrate } from '../api/client'

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

const FIELD_GROUPS = [
  { key: 'env', label: '环境变量', icon: '⚙️' },
  { key: 'model', label: '模型配置', icon: '🤖' },
  { key: 'permissions', label: '权限模式', icon: '🔒' },
  { key: 'alwaysThinkingEnabled', label: '始终思考', icon: '💭' },
  { key: 'skipDangerousModePermissionPrompt', label: '跳过确认', icon: '⚡' },
  { key: 'language', label: '语言', icon: '🌐' },
]

const SOURCE_COLORS: Record<string, string> = {
  claude: 'bg-violet-500/10 text-violet-400 border-violet-500/20',
  legna: 'bg-cyan-500/10 text-cyan-400 border-cyan-500/20',
  both: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
}

const SOURCE_LABELS: Record<string, string> = {
  claude: 'Claude',
  legna: 'Legna',
  both: 'Claude + Legna',
}

export function MigrationPanel() {
  const [from, setFrom] = useState<Scope>('claude')
  const [to, setTo] = useState<Scope>('legna')
  const [fromData, setFromData] = useState<Record<string, unknown>>({})
  const [toData, setToData] = useState<Record<string, unknown>>({})
  const [selected, setSelected] = useState<string[]>([])
  const [migrating, setMigrating] = useState(false)
  const [result, setResult] = useState<string | null>(null)
  const [projects, setProjects] = useState<Project[]>([])
  const [selectedProjects, setSelectedProjects] = useState<Set<string>>(new Set())
  const [projectMigrating, setProjectMigrating] = useState(false)
  const [projectResults, setProjectResults] = useState<{ ok: string[]; fail: string[] } | null>(null)
  const [tab, setTab] = useState<'projects' | 'settings'>('projects')
  const [showJson, setShowJson] = useState(false)

  useEffect(() => {
    getSettings(from).then(setFromData).catch(() => setFromData({}))
    getSettings(to).then(setToData).catch(() => setToData({}))
  }, [from, to])

  useEffect(() => {
    fetch('/api/projects').then(r => r.json()).then(setProjects).catch(() => {})
  }, [])

  const swap = () => { setFrom(to); setTo(from) }
  const toggleField = (k: string) => setSelected(p => p.includes(k) ? p.filter(x => x !== k) : [...p, k])
  const toggleProject = (id: string) => {
    setSelectedProjects(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n })
  }

  const migratableProjects = projects.filter(p => p.exists && !p.migratedLocal)
  const selectAll = () => {
    setSelectedProjects(prev =>
      prev.size === migratableProjects.length ? new Set() : new Set(migratableProjects.map(p => p.id))
    )
  }

  const doProjectMigrate = async () => {
    if (selectedProjects.size === 0) return
    setProjectMigrating(true)
    setProjectResults(null)
    const ok: string[] = [], fail: string[] = []
    for (const id of selectedProjects) {
      try {
        const r = await fetch(`/api/projects/${id}/migrate-local`, { method: 'POST' })
        const d = await r.json()
        const name = projects.find(p => p.id === id)?.name || id
        d.ok ? ok.push(`${name} (${d.migrated.length} 文件)`) : fail.push(`${name}: ${d.error}`)
      } catch (e: any) { fail.push(`${id}: ${e.message}`) }
    }
    setProjectResults({ ok, fail })
    setProjectMigrating(false)
    setSelectedProjects(new Set())
    fetch('/api/projects').then(r => r.json()).then(setProjects).catch(() => {})
  }

  const doSettingsMigrate = async () => {
    setMigrating(true); setResult(null)
    try {
      const res = await migrate({ from, to, fields: selected.length > 0 ? selected : undefined })
      setResult(`迁移成功: ${res.migrated.join(', ')}`)
      getSettings(to).then(setToData).catch(() => {})
    } catch (e: any) { setResult(`失败: ${e.message}`) }
    setMigrating(false)
  }

  const formatDate = (d: string | null) => {
    if (!d) return '—'
    const dt = new Date(d)
    const now = Date.now()
    const diff = now - dt.getTime()
    if (diff < 3600000) return `${Math.floor(diff / 60000)} 分钟前`
    if (diff < 86400000) return `${Math.floor(diff / 3600000)} 小时前`
    if (diff < 604800000) return `${Math.floor(diff / 86400000)} 天前`
    return dt.toLocaleDateString('zh-CN', { month: 'short', day: 'numeric' })
  }

  return (
    <div>
      {/* Tab switcher */}
      <div className="flex gap-1 mb-6 bg-gray-900 rounded-lg p-1 w-fit">
        <button
          onClick={() => setTab('projects')}
          className={`px-4 py-1.5 text-xs rounded-md transition-all ${
            tab === 'projects' ? 'bg-blue-600 text-white shadow' : 'text-gray-400 hover:text-gray-200'
          }`}
        >
          项目迁移
        </button>
        <button
          onClick={() => setTab('settings')}
          className={`px-4 py-1.5 text-xs rounded-md transition-all ${
            tab === 'settings' ? 'bg-blue-600 text-white shadow' : 'text-gray-400 hover:text-gray-200'
          }`}
        >
          配置同步
        </button>
      </div>

      {tab === 'projects' ? (
        <div>
          {/* Header */}
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-sm font-semibold text-gray-200">项目级迁移</h2>
              <p className="text-[11px] text-gray-500 mt-0.5">
                将会话和记忆迁移到项目本地 <code className="text-gray-400">.legna/</code> 目录，绝对路径转为相对路径，项目可随意移动/拷贝
              </p>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-[10px] text-gray-600">
                {migratableProjects.length} 可迁移 · {projects.filter(p => p.migratedLocal).length} 已完成 · {projects.filter(p => !p.exists).length} 路径缺失
              </span>
              {migratableProjects.length > 0 && (
                <button onClick={selectAll} className="text-[10px] text-blue-400 hover:text-blue-300 underline">
                  {selectedProjects.size === migratableProjects.length ? '取消全选' : '全选'}
                </button>
              )}
            </div>
          </div>

          {/* Info banner */}
          <div className="mb-4 px-3 py-2 bg-blue-950/20 border border-blue-900/30 rounded-lg flex items-start gap-2">
            <span className="text-blue-400 text-xs mt-0.5">ℹ</span>
            <div className="text-[11px] text-blue-400/70 leading-relaxed">
              迁移后会话文件中的绝对路径会被替换为相对路径（<code className="text-blue-300">cwd: "."</code>），
              项目拷贝到其他位置或其他机器后仍可 resume。原始 Claude 数据不受影响。
            </div>
          </div>

          {/* Project list */}
          {projects.length === 0 ? (
            <div className="text-center py-12 text-gray-600 text-sm">未发现项目数据</div>
          ) : (
            <div className="space-y-2 max-h-[420px] overflow-y-auto pr-1">
              {projects.map(p => (
                <div
                  key={p.id}
                  onClick={() => p.exists && !p.migratedLocal && toggleProject(p.id)}
                  className={`flex items-center gap-3 px-4 py-3 rounded-xl border transition-all cursor-pointer ${
                    !p.exists
                      ? 'border-red-900/30 bg-red-950/10 opacity-60 cursor-not-allowed'
                      : p.migratedLocal
                      ? 'border-green-900/30 bg-green-950/10 cursor-default'
                      : selectedProjects.has(p.id)
                      ? 'border-blue-500/40 bg-blue-950/20 shadow-sm shadow-blue-500/5'
                      : 'border-gray-800 bg-gray-800/30 hover:border-gray-700 hover:bg-gray-800/50'
                  }`}
                >
                  {/* Checkbox */}
                  <div className="flex-shrink-0">
                    {p.migratedLocal ? (
                      <div className="w-5 h-5 rounded-md bg-green-600/20 flex items-center justify-center">
                        <span className="text-green-400 text-xs">✓</span>
                      </div>
                    ) : !p.exists ? (
                      <div className="w-5 h-5 rounded-md bg-red-600/20 flex items-center justify-center">
                        <span className="text-red-400 text-[10px]">✕</span>
                      </div>
                    ) : (
                      <div className={`w-5 h-5 rounded-md border-2 transition-colors ${
                        selectedProjects.has(p.id) ? 'bg-blue-600 border-blue-600' : 'border-gray-600'
                      }`}>
                        {selectedProjects.has(p.id) && <span className="text-white text-xs flex items-center justify-center h-full">✓</span>}
                      </div>
                    )}
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-gray-200 truncate">{p.name}</span>
                      <span className={`px-1.5 py-0.5 text-[9px] rounded border ${SOURCE_COLORS[p.source]}`}>
                        {SOURCE_LABELS[p.source]}
                      </span>
                      {!p.exists && <span className="text-[9px] text-red-400 bg-red-900/30 px-1.5 py-0.5 rounded">路径不存在</span>}
                      {p.migratedLocal && <span className="text-[9px] text-green-400 bg-green-900/30 px-1.5 py-0.5 rounded">已迁移 · 可移动</span>}
                    </div>
                    <div className="text-[10px] text-gray-600 font-mono truncate mt-0.5">{p.path}</div>
                  </div>

                  {/* Stats */}
                  <div className="flex-shrink-0 text-right">
                    <div className="text-xs text-gray-400">{p.sessionCount} 会话</div>
                    <div className="text-[10px] text-gray-600">{formatDate(p.lastActive)}</div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Action bar */}
          <div className="mt-4 flex items-center gap-3">
            <button
              onClick={doProjectMigrate}
              disabled={projectMigrating || selectedProjects.size === 0}
              className="px-5 py-2 text-xs font-medium bg-blue-600 hover:bg-blue-500 disabled:opacity-30 disabled:cursor-not-allowed text-white rounded-lg transition-all shadow-sm"
            >
              {projectMigrating ? '迁移中...' : selectedProjects.size > 0 ? `迁移 ${selectedProjects.size} 个项目` : '选择项目后迁移'}
            </button>
            {projectResults && (
              <div className="text-xs space-y-0.5">
                {projectResults.ok.length > 0 && <div className="text-green-400">✓ {projectResults.ok.join(' · ')}</div>}
                {projectResults.fail.length > 0 && <div className="text-red-400">✕ {projectResults.fail.join(' · ')}</div>}
              </div>
            )}
          </div>
        </div>
      ) : (
        /* Settings sync tab */
        <div>
          <h2 className="text-sm font-semibold text-gray-200 mb-1">全局配置同步</h2>
          <p className="text-[11px] text-gray-500 mb-5">在 Claude 和 LegnaCode 的全局配置之间同步设置</p>

          {/* Direction */}
          <div className="flex items-center gap-3 mb-5 bg-gray-900/50 rounded-xl px-4 py-3 border border-gray-800 w-fit">
            <div className="text-center">
              <div className="text-[10px] text-gray-500 mb-1">源</div>
              <div className="px-3 py-1 bg-gray-800 rounded-lg text-xs text-gray-200 font-mono">~/.{from}/</div>
            </div>
            <button onClick={swap} className="w-8 h-8 flex items-center justify-center bg-gray-800 hover:bg-gray-700 rounded-full text-gray-400 hover:text-white transition-colors text-sm">
              ⇄
            </button>
            <div className="text-center">
              <div className="text-[10px] text-gray-500 mb-1">目标</div>
              <div className="px-3 py-1 bg-gray-800 rounded-lg text-xs text-gray-200 font-mono">~/.{to}/</div>
            </div>
          </div>

          {/* Fields */}
          <div className="mb-5">
            <div className="text-[10px] text-gray-500 mb-2">选择要同步的字段（留空 = 全量同步）</div>
            <div className="flex flex-wrap gap-2">
              {FIELD_GROUPS.map(g => (
                <button
                  key={g.key}
                  onClick={() => toggleField(g.key)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-lg border transition-all ${
                    selected.includes(g.key)
                      ? 'bg-blue-600/20 text-blue-400 border-blue-500/30 shadow-sm'
                      : 'bg-gray-800/50 text-gray-400 border-gray-700/50 hover:border-gray-600'
                  }`}
                >
                  <span>{g.icon}</span>
                  <span>{g.label}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Preview */}
          <div className="mb-5">
            <button onClick={() => setShowJson(!showJson)} className="text-[10px] text-gray-500 hover:text-gray-400 underline mb-2">
              {showJson ? '隐藏' : '预览'} JSON 对比
            </button>
            {showJson && (
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <div className="text-[9px] text-gray-600 mb-1">源 (~/.{from}/settings.json)</div>
                  <pre className="text-[10px] bg-gray-950 border border-gray-800 p-3 rounded-lg overflow-auto max-h-40 text-gray-400 leading-relaxed">
                    {JSON.stringify(fromData, null, 2) || '{}'}
                  </pre>
                </div>
                <div>
                  <div className="text-[9px] text-gray-600 mb-1">目标 (~/.{to}/settings.json)</div>
                  <pre className="text-[10px] bg-gray-950 border border-gray-800 p-3 rounded-lg overflow-auto max-h-40 text-gray-400 leading-relaxed">
                    {JSON.stringify(toData, null, 2) || '{}'}
                  </pre>
                </div>
              </div>
            )}
          </div>

          {/* Action */}
          <div className="flex items-center gap-3">
            <button
              onClick={doSettingsMigrate}
              disabled={migrating}
              className="px-5 py-2 text-xs font-medium bg-orange-600 hover:bg-orange-500 disabled:opacity-50 text-white rounded-lg transition-all shadow-sm"
            >
              {migrating ? '同步中...' : selected.length > 0 ? `同步 ${selected.length} 个字段` : '全量同步'}
            </button>
            {result && (
              <span className={`text-xs ${result.startsWith('迁移成功') ? 'text-green-400' : 'text-red-400'}`}>{result}</span>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
