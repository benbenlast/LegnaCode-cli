import { useState, useEffect } from 'react'

interface Project {
  id: string
  name: string
  path: string
  exists: boolean
}

interface MemoryFile {
  path: string
  relativePath: string
  size: number
  lastModified: string
  isDir: boolean
}

interface MemoryData {
  content: string
  path: string | null
  lastModified: string | null
  size: number
}

export function MemoryPanel() {
  const [projects, setProjects] = useState<Project[]>([])
  const [selected, setSelected] = useState<string | null>(null)
  const [files, setFiles] = useState<MemoryFile[]>([])
  const [selectedFile, setSelectedFile] = useState<string | null>(null)
  const [memory, setMemory] = useState<MemoryData | null>(null)
  const [editing, setEditing] = useState('')
  const [saving, setSaving] = useState(false)
  const [filter, setFilter] = useState('')
  const [dirty, setDirty] = useState(false)
  const [expanded, setExpanded] = useState<Set<string>>(new Set())

  useEffect(() => {
    fetch('/api/projects').then(r => r.json()).then((ps: Project[]) => {
      setProjects(ps)
      if (ps.length > 0 && !selected) setSelected(ps[0]!.id)
    }).catch(() => {})
  }, [])

  // Load file tree when project changes
  useEffect(() => {
    if (!selected) return
    setFiles([])
    setSelectedFile(null)
    setMemory(null)
    fetch(`/api/projects/${selected}/memory`)
      .then(r => r.json())
      .then((d: { files: MemoryFile[] }) => {
        setFiles(d.files || [])
        // Auto-select MEMORY.md if exists
        const mem = d.files?.find((f: MemoryFile) => f.relativePath === 'MEMORY.md')
        if (mem) { setSelectedFile(mem.relativePath); setExpanded(new Set()) }
      })
      .catch(() => {})
  }, [selected])

  // Load file content when file selected
  useEffect(() => {
    if (!selected || !selectedFile) { setMemory(null); return }
    fetch(`/api/projects/${selected}/memory/${selectedFile}`)
      .then(r => r.json())
      .then((d: MemoryData) => { setMemory(d); setEditing(d.content); setDirty(false) })
      .catch(() => {})
  }, [selected, selectedFile])

  const save = async () => {
    if (!selected || !selectedFile) return
    setSaving(true)
    try {
      await fetch(`/api/projects/${selected}/memory/${selectedFile}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: editing }),
      })
      setDirty(false)
    } catch {}
    setSaving(false)
  }

  const toggleExpand = (dir: string) => {
    setExpanded(prev => { const n = new Set(prev); n.has(dir) ? n.delete(dir) : n.add(dir); return n })
  }

  const filtered = projects.filter(p =>
    p.name.toLowerCase().includes(filter.toLowerCase()) ||
    p.path.toLowerCase().includes(filter.toLowerCase())
  )

  // Build tree structure from flat file list
  const buildTree = (items: MemoryFile[]) => {
    const dirs = items.filter(f => f.isDir).map(f => f.relativePath)
    const filesByDir = new Map<string, MemoryFile[]>()
    filesByDir.set('', []) // root

    for (const f of items) {
      if (f.isDir) continue
      const parts = f.relativePath.split('/')
      const dir = parts.length > 1 ? parts.slice(0, -1).join('/') : ''
      if (!filesByDir.has(dir)) filesByDir.set(dir, [])
      filesByDir.get(dir)!.push(f)
    }

    return { dirs, filesByDir }
  }

  const { dirs, filesByDir } = buildTree(files)
  const rootFiles = filesByDir.get('') || []

  const renderFileItem = (f: MemoryFile) => (
    <button
      key={f.relativePath}
      onClick={() => { if (dirty && !confirm('有未保存的修改，确定切换？')) return; setSelectedFile(f.relativePath) }}
      className={`w-full text-left px-2 py-1.5 rounded text-xs transition-colors ${
        selectedFile === f.relativePath
          ? 'bg-blue-600/20 text-blue-400'
          : 'text-gray-400 hover:bg-gray-800'
      }`}
    >
      <span className="truncate block">{f.relativePath.split('/').pop()}</span>
      <span className="text-[9px] text-gray-600">{(f.size / 1024).toFixed(1)}KB</span>
    </button>
  )

  const renderDir = (dir: string) => {
    const dirFiles = filesByDir.get(dir) || []
    const isOpen = expanded.has(dir)
    const dirName = dir.split('/').pop() || dir
    return (
      <div key={dir}>
        <button
          onClick={() => toggleExpand(dir)}
          className="w-full text-left px-2 py-1.5 rounded text-xs text-gray-300 hover:bg-gray-800 flex items-center gap-1"
        >
          <span className="text-[10px] text-gray-500">{isOpen ? '▼' : '▶'}</span>
          <span className="font-medium">{dirName}/</span>
          <span className="text-[9px] text-gray-600 ml-auto">{dirFiles.length}</span>
        </button>
        {isOpen && (
          <div className="ml-3 border-l border-gray-800 pl-1">
            {dirFiles.map(renderFileItem)}
          </div>
        )}
      </div>
    )
  }

  return (
    <div>
      <div className="mb-4 px-3 py-2 bg-amber-950/30 border border-amber-800/30 rounded-lg">
        <p className="text-xs text-amber-400/80">
          记忆是 AI 的建议性笔记，随项目演进自动更新。内容仅供参考，不代表绝对事实。你可以随时编辑、补充或删除。
        </p>
      </div>

      <div className="flex gap-4" style={{ height: 'calc(100vh - 280px)' }}>
        {/* Left: project list */}
        <div className="w-56 flex-shrink-0 flex flex-col">
          <input
            type="text"
            placeholder="搜索项目..."
            value={filter}
            onChange={e => setFilter(e.target.value)}
            className="mb-2 px-2.5 py-1.5 bg-gray-800 border border-gray-700 rounded text-xs text-gray-200 placeholder-gray-500 focus:outline-none focus:border-blue-500"
          />
          <div className="flex-1 overflow-y-auto space-y-0.5">
            {filtered.map(p => (
              <button
                key={p.id}
                onClick={() => { if (dirty && !confirm('有未保存的修改，确定切换？')) return; setSelected(p.id) }}
                className={`w-full text-left px-2.5 py-2 rounded text-xs transition-colors ${
                  selected === p.id
                    ? 'bg-blue-600/20 text-blue-400 border border-blue-600/30'
                    : 'text-gray-400 hover:bg-gray-800 border border-transparent'
                }`}
              >
                <div className="font-medium truncate">{p.name}</div>
                <div className="text-[10px] text-gray-600 truncate">{p.path}</div>
              </button>
            ))}
          </div>
        </div>

        {/* Middle: file tree */}
        <div className="w-48 flex-shrink-0 flex flex-col border-l border-r border-gray-800 px-2">
          <div className="text-[10px] text-gray-500 mb-2 font-medium">记忆文件</div>
          <div className="flex-1 overflow-y-auto space-y-0.5">
            {files.length === 0 ? (
              <div className="text-[10px] text-gray-600 text-center py-4">暂无记忆文件</div>
            ) : (
              <>
                {rootFiles.map(renderFileItem)}
                {dirs.map(renderDir)}
              </>
            )}
          </div>
        </div>

        {/* Right: editor */}
        <div className="flex-1 flex flex-col min-w-0">
          {selected && selectedFile && memory ? (
            <>
              <div className="flex items-center justify-between mb-2">
                <div className="text-xs text-gray-500 truncate">
                  <span className="font-mono">{selectedFile}</span>
                  {memory.lastModified && <span className="ml-2">· {new Date(memory.lastModified).toLocaleString('zh-CN')}</span>}
                  {memory.size > 0 && <span className="ml-2">· {(memory.size / 1024).toFixed(1)}KB</span>}
                </div>
                <div className="flex gap-2 flex-shrink-0">
                  {dirty && <span className="text-xs text-amber-400">未保存</span>}
                  <button
                    onClick={save}
                    disabled={saving || !dirty}
                    className="px-3 py-1 text-xs bg-blue-600 hover:bg-blue-500 text-white rounded disabled:opacity-40 transition-colors"
                  >
                    {saving ? '保存中...' : '保存'}
                  </button>
                </div>
              </div>
              <textarea
                value={editing}
                onChange={e => { setEditing(e.target.value); setDirty(true) }}
                className="flex-1 w-full px-3 py-2 bg-gray-900 border border-gray-700 rounded-lg text-sm text-gray-200 font-mono resize-none focus:outline-none focus:border-blue-500 leading-relaxed"
                placeholder="暂无内容..."
              />
            </>
          ) : selected ? (
            <div className="flex-1 flex items-center justify-center text-gray-600 text-sm">
              {files.length > 0 ? '选择一个文件查看' : '该项目暂无记忆文件'}
            </div>
          ) : (
            <div className="flex-1 flex items-center justify-center text-gray-600 text-sm">
              选择一个项目
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
