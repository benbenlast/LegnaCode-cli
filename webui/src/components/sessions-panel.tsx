import { useState, useEffect } from 'react'
import type { Scope, Session } from '../api/client'
import { getSessions } from '../api/client'

interface Props { scope: Scope }

export function SessionsPanel({ scope }: Props) {
  const [sessions, setSessions] = useState<Session[]>([])
  const [loading, setLoading] = useState(true)
  const [copied, setCopied] = useState<string | null>(null)

  useEffect(() => {
    setLoading(true)
    getSessions(scope).then(setSessions).catch(() => setSessions([])).finally(() => setLoading(false))
  }, [scope])

  const copyCmd = (cmd: string, id: string) => {
    navigator.clipboard.writeText(cmd).then(() => {
      setCopied(id)
      setTimeout(() => setCopied(null), 1500)
    })
  }

  if (loading) return <div className="text-gray-500 text-sm">加载中...</div>

  if (sessions.length === 0) {
    return <div className="text-gray-500 text-sm">暂无会话记录</div>
  }

  return (
    <div className="space-y-2">
      <h2 className="text-sm font-medium text-gray-300 mb-3">会话记录 ({sessions.length})</h2>
      <div className="space-y-2 max-h-[600px] overflow-y-auto">
        {sessions.map(s => (
          <div key={s.id} className="flex items-center justify-between p-3 rounded-lg border border-gray-700 bg-gray-800/50">
            <div className="min-w-0 flex-1">
              <div className="text-sm text-gray-200 truncate">{s.cwd || s.project || '未知项目'}</div>
              <div className="text-xs text-gray-500 mt-0.5">
                {s.slug && <span className="mr-3 text-gray-400">{s.slug}</span>}
                {s.timestamp && <span className="mr-3">{new Date(s.timestamp).toLocaleString()}</span>}
                <span>{s.promptCount} prompts</span>
              </div>
            </div>
            <button
              onClick={() => copyCmd(s.resumeCommand, s.id)}
              className="ml-3 px-2 py-1 text-xs bg-gray-700 hover:bg-gray-600 text-gray-300 rounded transition-colors shrink-0"
            >
              {copied === s.id ? '已复制' : '复制 resume'}
            </button>
          </div>
        ))}
      </div>
    </div>
  )
}
