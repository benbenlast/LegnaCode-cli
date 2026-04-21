import { useState, useEffect, useCallback, useRef } from 'react'
import type { Scope } from '../api/client'
import { getSessions, getSessionMessages } from '../api/client'

interface Session {
  id: string
  project: string
  projectPath: string
  timestamp: string
  promptCount: number
  slug?: string
}

interface ChatMessage {
  uuid: string
  type: string
  timestamp: string
  message?: { role?: string; content?: string | any[] }
  toolCall?: any
  thinking?: string
  toolResult?: any
}

// Live streaming message from SSE
interface LiveMessage {
  id: string
  role: 'user' | 'assistant' | 'thinking' | 'tool_use' | 'tool_result' | 'error' | 'status'
  content: string
  toolName?: string
  toolInput?: any
  toolResult?: string
  isError?: boolean
  isStreaming?: boolean
}

type Mode = 'chat' | 'history'

export function ChatPanel({ scope }: { scope: Scope }) {
  const [mode, setMode] = useState<Mode>('chat')
  const [sessions, setSessions] = useState<Session[]>([])
  const [selectedSession, setSelectedSession] = useState<string | null>(null)
  const [historyMessages, setHistoryMessages] = useState<ChatMessage[]>([])
  const [liveMessages, setLiveMessages] = useState<LiveMessage[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [streaming, setStreaming] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [sessionId, setSessionId] = useState<string | null>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const abortRef = useRef<AbortController | null>(null)

  // Load sessions for history sidebar
  useEffect(() => {
    getSessions(scope, 30).then(setSessions).catch(() => setSessions([]))
  }, [scope])

  // Auto-scroll
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [liveMessages, historyMessages])

  // Focus input on mount
  useEffect(() => { inputRef.current?.focus() }, [mode])

  // Load history session
  const loadHistory = useCallback(async (sid: string) => {
    setSelectedSession(sid)
    setMode('history')
    setLoading(true)
    setError(null)
    try {
      const msgs = await getSessionMessages(scope, sid)
      setHistoryMessages(msgs)
    } catch (e: any) {
      setError(e.message)
      setHistoryMessages([])
    } finally {
      setLoading(false)
    }
  }, [scope])

  // Send message via SSE
  const sendMessage = useCallback(async () => {
    const text = input.trim()
    if (!text || streaming) return
    setInput('')
    setMode('chat')
    setSelectedSession(null)

    // Add user message
    const userMsg: LiveMessage = {
      id: `user-${Date.now()}`,
      role: 'user',
      content: text,
    }
    setLiveMessages(prev => [...prev, userMsg])
    setStreaming(true)
    setError(null)

    // Create streaming assistant placeholder
    const assistantId = `assistant-${Date.now()}`
    setLiveMessages(prev => [...prev, {
      id: assistantId, role: 'assistant', content: '', isStreaming: true,
    }])

    const abort = new AbortController()
    abortRef.current = abort

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: text, sessionId }),
        signal: abort.signal,
      })

      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const reader = res.body?.getReader()
      if (!reader) throw new Error('No response body')

      const decoder = new TextDecoder()
      let buffer = ''
      let currentText = ''

      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        buffer += decoder.decode(value, { stream: true })

        const lines = buffer.split('\n')
        buffer = lines.pop() || ''

        let eventType = ''
        for (const line of lines) {
          if (line.startsWith('event: ')) {
            eventType = line.slice(7).trim()
          } else if (line.startsWith('data: ')) {
            const raw = line.slice(6)
            try {
              const data = JSON.parse(raw)
              if (eventType === 'partial') {
                // Streaming partial — replace entire assistant text with latest snapshot
                setLiveMessages(prev => prev.map(m =>
                  m.id === assistantId ? { ...m, content: data.content || '' } : m
                ))
              } else if (eventType === 'thinking_partial') {
                // Streaming thinking — update or create thinking block
                setLiveMessages(prev => {
                  const existing = prev.find(m => m.role === 'thinking' && m.isStreaming)
                  if (existing) {
                    return prev.map(m => m.id === existing.id ? { ...m, content: data.content || '' } : m)
                  }
                  return [...prev, {
                    id: `think-${Date.now()}`, role: 'thinking' as const,
                    content: data.content || '', isStreaming: true,
                  }]
                })
              } else if (eventType === 'text') {
                // Complete text — finalize assistant message
                setLiveMessages(prev => prev.map(m =>
                  m.id === assistantId ? { ...m, content: data.content || '', isStreaming: false } : m
                ))
                // Mark any streaming thinking as done
                setLiveMessages(prev => prev.map(m =>
                  m.role === 'thinking' && m.isStreaming ? { ...m, isStreaming: false } : m
                ))
              } else if (eventType === 'thinking') {
                // Complete thinking block
                setLiveMessages(prev => {
                  const existing = prev.find(m => m.role === 'thinking' && m.isStreaming)
                  if (existing) {
                    return prev.map(m => m.id === existing.id ? { ...m, content: data.content || '', isStreaming: false } : m)
                  }
                  return [...prev, {
                    id: `think-${Date.now()}`, role: 'thinking' as const,
                    content: data.content || '', isStreaming: false,
                  }]
                })
              } else if (eventType === 'tool_use') {
                setLiveMessages(prev => [...prev, {
                  id: `tool-${Date.now()}`, role: 'tool_use',
                  content: '', toolName: data.name,
                  toolInput: data.input, isStreaming: true,
                }])
              } else if (eventType === 'tool_result') {
                setLiveMessages(prev => {
                  const last = [...prev].reverse().find(m => m.role === 'tool_use' && m.isStreaming)
                  if (!last) return prev
                  return prev.map(m => m.id === last.id ? {
                    ...m, isStreaming: false,
                    toolResult: typeof data.content === 'string' ? data.content
                      : Array.isArray(data.content) ? data.content.map((b: any) => b.text || '').join('\n')
                      : JSON.stringify(data.content),
                    isError: data.is_error,
                  } : m)
                })
              } else if (eventType === 'result') {
                if (data.session_id) setSessionId(data.session_id)
              } else if (eventType === 'error') {
                setError(data.content)
              } else if (eventType === 'done') {
                // done
              }
            } catch {}
          }
        }
      }

      // Mark assistant done
      setLiveMessages(prev => prev.map(m =>
        m.id === assistantId ? { ...m, isStreaming: false } : m
      ))
    } catch (e: any) {
      if (e.name !== 'AbortError') setError(e.message)
    } finally {
      setStreaming(false)
      abortRef.current = null
    }
  }, [input, streaming, sessionId])

  const handleAbort = () => {
    abortRef.current?.abort()
    fetch('/api/chat/abort', { method: 'POST' }).catch(() => {})
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      sendMessage()
    }
  }

  // Extract helpers for history messages
  const getTextContent = (msg: ChatMessage): string => {
    if (!msg.message) return ''
    const c = msg.message.content
    if (typeof c === 'string') return c
    if (Array.isArray(c)) return c.filter((b: any) => b.type === 'text').map((b: any) => b.text).join('')
    return ''
  }
  const getThinking = (msg: ChatMessage): string | null => {
    if (msg.thinking) return msg.thinking
    if (!Array.isArray(msg.message?.content)) return null
    const t = msg.message!.content.find((b: any) => b.type === 'thinking')
    return t?.thinking || t?.text || null
  }
  const getToolUse = (msg: ChatMessage): any | null => {
    if (msg.toolCall) return msg.toolCall
    if (!Array.isArray(msg.message?.content)) return null
    return msg.message!.content.find((b: any) => b.type === 'tool_use') || null
  }

  return (
    <div className="flex h-[calc(100vh-120px)] gap-3">
      {/* Sidebar: mode toggle + sessions */}
      <div className="w-64 flex-shrink-0 bg-gray-900 rounded-lg overflow-hidden flex flex-col">
        <div className="flex border-b border-gray-800">
          <button onClick={() => { setMode('chat'); setSelectedSession(null) }}
            className={`flex-1 px-3 py-2 text-xs font-medium ${mode === 'chat' && !selectedSession ? 'text-blue-400 border-b-2 border-blue-400' : 'text-gray-400 hover:text-gray-300'}`}>
            New Chat
          </button>
          <button onClick={() => setMode('history')}
            className={`flex-1 px-3 py-2 text-xs font-medium ${mode === 'history' || selectedSession ? 'text-blue-400 border-b-2 border-blue-400' : 'text-gray-400 hover:text-gray-300'}`}>
            History
          </button>
        </div>
        {(mode === 'history' || selectedSession) && (
          <div className="overflow-y-auto flex-1">
            {sessions.map(s => (
              <button key={s.id} onClick={() => loadHistory(s.id)}
                className={`w-full text-left px-3 py-2 text-xs border-b border-gray-800/50 transition-colors ${
                  selectedSession === s.id ? 'bg-blue-600/20 text-blue-300' : 'text-gray-300 hover:bg-gray-800'
                }`}>
                <div className="truncate font-medium">{s.slug || s.project}</div>
                <div className="text-gray-500 mt-0.5">
                  {new Date(s.timestamp).toLocaleString()} · {s.promptCount} prompts
                </div>
              </button>
            ))}
            {sessions.length === 0 && (
              <div className="px-3 py-4 text-xs text-gray-500 text-center">No sessions</div>
            )}
          </div>
        )}
        {mode === 'chat' && !selectedSession && (
          <div className="flex-1 flex items-center justify-center px-4">
            <div className="text-center text-xs text-gray-500">
              <div className="text-2xl mb-2">💬</div>
              Type a message below to start a conversation
              {sessionId && <div className="mt-2 text-gray-600">Session: {sessionId.slice(0, 8)}...</div>}
            </div>
          </div>
        )}
      </div>

      {/* Main area */}
      <div className="flex-1 bg-gray-900 rounded-lg overflow-hidden flex flex-col">
        {/* Messages area */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {/* History mode */}
          {mode === 'history' && selectedSession && (
            loading ? (
              <div className="flex-1 flex items-center justify-center text-gray-400 text-sm h-full">Loading...</div>
            ) : error ? (
              <div className="flex-1 flex items-center justify-center text-red-400 text-sm h-full">{error}</div>
            ) : (
              historyMessages.map((msg, i) => {
                const text = getTextContent(msg)
                const thinking = getThinking(msg)
                const toolUse = getToolUse(msg)
                if (msg.type === 'tool_result') return null
                return (
                  <div key={msg.uuid || i}>
                    {thinking && <ThinkingBlock content={thinking} />}
                    {toolUse && <ToolCallBlock toolUse={toolUse} messages={historyMessages} msgIndex={i} />}
                    {text && !toolUse && (
                      msg.type === 'user'
                        ? <UserBubble text={text} />
                        : <AssistantBubble text={text} />
                    )}
                  </div>
                )
              })
            )
          )}

          {/* Live chat mode */}
          {mode === 'chat' && liveMessages.map(msg => (
            <div key={msg.id}>
              {msg.role === 'user' && <UserBubble text={msg.content} />}
              {msg.role === 'assistant' && (
                <div className="text-sm">
                  <AssistantBubble text={msg.content} />
                  {msg.isStreaming && <span className="inline-block w-2 h-4 bg-blue-400 animate-pulse ml-1" />}
                </div>
              )}
              {msg.role === 'thinking' && <ThinkingBlock content={msg.content} />}
              {msg.role === 'tool_use' && (
                <LiveToolBlock name={msg.toolName || ''} input={msg.toolInput}
                  result={msg.toolResult} isError={msg.isError} isStreaming={msg.isStreaming} />
              )}
              {msg.role === 'error' && (
                <div className="text-xs text-red-400 bg-red-950/30 rounded px-3 py-2">{msg.content}</div>
              )}
            </div>
          ))}

          {/* Empty state for chat mode */}
          {mode === 'chat' && liveMessages.length === 0 && (
            <div className="flex items-center justify-center h-full text-gray-500 text-sm">
              Start a conversation with LegnaCode
            </div>
          )}

          {error && mode === 'chat' && (
            <div className="text-xs text-red-400 bg-red-950/30 rounded px-3 py-2">{error}</div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Input bar — always visible in chat mode */}
        {(mode === 'chat' || !selectedSession) && (
          <div className="border-t border-gray-800 p-3">
            <div className="flex gap-2 items-end">
              <textarea
                ref={inputRef}
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Send a message... (Enter to send, Shift+Enter for newline)"
                rows={1}
                className="flex-1 bg-gray-800 text-gray-100 text-sm rounded-lg px-3 py-2 resize-none outline-none focus:ring-1 focus:ring-blue-500 placeholder-gray-500"
                style={{ minHeight: '38px', maxHeight: '120px' }}
                disabled={streaming}
              />
              {streaming ? (
                <button onClick={handleAbort}
                  className="px-3 py-2 bg-red-600 hover:bg-red-700 text-white text-xs rounded-lg font-medium">
                  Stop
                </button>
              ) : (
                <button onClick={sendMessage} disabled={!input.trim()}
                  className="px-3 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-700 disabled:text-gray-500 text-white text-xs rounded-lg font-medium">
                  Send
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

// ============================================================================
// Sub-components
// ============================================================================

function UserBubble({ text }: { text: string }) {
  return (
    <div className="flex justify-end">
      <div className="bg-blue-600/20 text-blue-100 rounded-lg px-3 py-2 max-w-[80%] text-sm whitespace-pre-wrap">
        {text}
      </div>
    </div>
  )
}

function AssistantBubble({ text }: { text: string }) {
  return (
    <div className="text-sm text-gray-200" dangerouslySetInnerHTML={{ __html: simpleMarkdown(text) }} />
  )
}

function ThinkingBlock({ content }: { content: string }) {
  const [expanded, setExpanded] = useState(false)
  return (
    <div className="mb-2">
      <button onClick={() => setExpanded(!expanded)}
        className="flex items-center gap-1 text-xs text-gray-400 hover:text-gray-300">
        <span>🧠 Thinking</span>
        <span className="text-[10px]">{expanded ? '▲' : '▼'}</span>
      </button>
      {expanded && (
        <div className="text-xs text-gray-400 mt-1 pl-3 border-l border-gray-700 whitespace-pre-wrap max-h-60 overflow-y-auto">
          {content}
        </div>
      )}
    </div>
  )
}

function LiveToolBlock({ name, input, result, isError, isStreaming }: {
  name: string; input?: any; result?: string; isError?: boolean; isStreaming?: boolean
}) {
  const [expanded, setExpanded] = useState(false)
  const summary = input?.command?.slice(0, 80) || input?.file_path || input?.pattern ? `/${input.pattern}/` : ''
  return (
    <div className={`rounded-md border text-xs mb-1 ${isError ? 'border-red-800/50 bg-red-950/20' : 'border-gray-700/50 bg-gray-800/30'}`}>
      <button onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center gap-2 px-3 py-1.5 text-left hover:bg-gray-800/50">
        <span className={`font-mono font-medium ${isError ? 'text-red-400' : 'text-blue-400'}`}>{name}</span>
        <span className="text-gray-500 truncate flex-1">{summary}</span>
        {isStreaming && <span className="w-2 h-2 bg-blue-400 rounded-full animate-pulse" />}
        <span className="text-[10px] text-gray-500">{expanded ? '▲' : '▼'}</span>
      </button>
      {expanded && (
        <div className="px-3 py-2 border-t border-gray-700/50 space-y-2">
          {input && (
            <div>
              <div className="text-gray-500 mb-1">Input:</div>
              <pre className="text-gray-300 bg-gray-900 rounded p-2 overflow-x-auto max-h-40 overflow-y-auto">
                {JSON.stringify(input, null, 2)}
              </pre>
            </div>
          )}
          {result && (
            <div>
              <div className={`mb-1 ${isError ? 'text-red-400' : 'text-gray-500'}`}>{isError ? 'Error:' : 'Output:'}</div>
              <pre className="text-gray-300 bg-gray-900 rounded p-2 overflow-x-auto max-h-60 overflow-y-auto">{result}</pre>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

function ToolCallBlock({ toolUse, messages, msgIndex }: { toolUse: any; messages: ChatMessage[]; msgIndex: number }) {
  const [expanded, setExpanded] = useState(false)
  const toolName = toolUse.name || toolUse.tool || 'Unknown'
  const input = toolUse.input || {}
  const result = messages.slice(msgIndex + 1).find(m => m.type === 'tool_result')
  const resultContent = result?.toolResult?.content
  const isError = result?.toolResult?.is_error
  const summary = input.command?.slice(0, 80) || input.file_path || (input.pattern ? `/${input.pattern}/` : JSON.stringify(input).slice(0, 60))

  return (
    <div className={`rounded-md border text-xs mb-1 ${isError ? 'border-red-800/50 bg-red-950/20' : 'border-gray-700/50 bg-gray-800/30'}`}>
      <button onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center gap-2 px-3 py-1.5 text-left hover:bg-gray-800/50">
        <span className={`font-mono font-medium ${isError ? 'text-red-400' : 'text-blue-400'}`}>{toolName}</span>
        <span className="text-gray-500 truncate flex-1">{summary}</span>
        <span className="text-[10px] text-gray-500">{expanded ? '▲' : '▼'}</span>
      </button>
      {expanded && (
        <div className="px-3 py-2 border-t border-gray-700/50 space-y-2">
          <div>
            <div className="text-gray-500 mb-1">Input:</div>
            <pre className="text-gray-300 bg-gray-900 rounded p-2 overflow-x-auto max-h-40 overflow-y-auto">
              {JSON.stringify(input, null, 2)}
            </pre>
          </div>
          {resultContent && (
            <div>
              <div className={`mb-1 ${isError ? 'text-red-400' : 'text-gray-500'}`}>{isError ? 'Error:' : 'Output:'}</div>
              <pre className="text-gray-300 bg-gray-900 rounded p-2 overflow-x-auto max-h-60 overflow-y-auto">
                {typeof resultContent === 'string' ? resultContent
                  : Array.isArray(resultContent) ? resultContent.map((b: any) => b.text || '').join('\n')
                  : JSON.stringify(resultContent, null, 2)}
              </pre>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

function simpleMarkdown(text: string): string {
  if (!text) return ''
  return text
    .replace(/```(\w*)\n([\s\S]*?)```/g, '<pre class="bg-gray-800 rounded p-2 my-2 overflow-x-auto text-xs"><code>$2</code></pre>')
    .replace(/`([^`]+)`/g, '<code class="bg-gray-800 px-1 rounded text-xs">$1</code>')
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
    .replace(/\n/g, '<br/>')
}