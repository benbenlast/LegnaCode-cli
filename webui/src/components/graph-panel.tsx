import { useState, useEffect, useRef, useCallback } from 'react'

interface GraphNode {
  id: string
  name: string
  path: string
  exists: boolean
  sessionCount: number
  lastActive: string | null
  // layout
  x: number
  y: number
  vx: number
  vy: number
  radius: number
  color: string
  pinned: boolean
}

interface GraphEdge {
  source: string
  target: string
  weight: number
}

interface GraphData {
  nodes: GraphNode[]
  edges: GraphEdge[]
}

const COLORS = {
  today: '#22c55e',
  week: '#3b82f6',
  month: '#a855f7',
  old: '#6b7280',
  missing: '#4b5563',
}

function getColor(n: { exists: boolean; lastActive: string | null }) {
  if (!n.exists) return COLORS.missing
  if (!n.lastActive) return COLORS.old
  const days = (Date.now() - new Date(n.lastActive).getTime()) / 86400000
  if (days < 1) return COLORS.today
  if (days < 7) return COLORS.week
  if (days < 30) return COLORS.month
  return COLORS.old
}

export function GraphPanel() {
  const [data, setData] = useState<GraphData | null>(null)
  const [loading, setLoading] = useState(true)
  const [hovered, setHovered] = useState<GraphNode | null>(null)
  const [dragging, setDragging] = useState<GraphNode | null>(null)
  const svgRef = useRef<SVGSVGElement>(null)
  const animRef = useRef<number>(0)
  const nodesRef = useRef<GraphNode[]>([])
  const edgesRef = useRef<GraphEdge[]>([])
  const [, forceRender] = useState(0)

  const W = 900, H = 550

  useEffect(() => {
    fetch('/api/graph')
      .then(r => r.json())
      .then((d: { nodes: any[]; edges: GraphEdge[] }) => {
        const maxS = Math.max(...d.nodes.map((n: any) => n.sessionCount), 1)
        const nodes: GraphNode[] = d.nodes.map((n: any, i: number) => {
          const angle = (2 * Math.PI * i) / d.nodes.length
          const r = Math.min(W, H) * 0.3
          return {
            ...n,
            x: W / 2 + r * Math.cos(angle),
            y: H / 2 + r * Math.sin(angle),
            vx: 0, vy: 0,
            radius: 10 + (n.sessionCount / maxS) * 25,
            color: getColor(n),
            pinned: false,
          }
        })
        nodesRef.current = nodes
        edgesRef.current = d.edges
        setData({ nodes, edges: d.edges })
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }, [])

  // Force simulation
  const simulate = useCallback(() => {
    const nodes = nodesRef.current
    const edges = edgesRef.current
    if (nodes.length === 0) return

    const nodeMap = new Map(nodes.map(n => [n.id, n]))

    // Repulsion between all nodes
    for (let i = 0; i < nodes.length; i++) {
      for (let j = i + 1; j < nodes.length; j++) {
        const a = nodes[i]!, b = nodes[j]!
        let dx = b.x - a.x, dy = b.y - a.y
        let dist = Math.sqrt(dx * dx + dy * dy) || 1
        const force = 800 / (dist * dist)
        const fx = (dx / dist) * force, fy = (dy / dist) * force
        if (!a.pinned) { a.vx -= fx; a.vy -= fy }
        if (!b.pinned) { b.vx += fx; b.vy += fy }
      }
    }

    // Attraction along edges
    for (const e of edges) {
      const a = nodeMap.get(e.source), b = nodeMap.get(e.target)
      if (!a || !b) continue
      let dx = b.x - a.x, dy = b.y - a.y
      let dist = Math.sqrt(dx * dx + dy * dy) || 1
      const force = (dist - 120) * 0.005 * e.weight
      const fx = (dx / dist) * force, fy = (dy / dist) * force
      if (!a.pinned) { a.vx += fx; a.vy += fy }
      if (!b.pinned) { b.vx -= fx; b.vy -= fy }
    }

    // Center gravity
    for (const n of nodes) {
      if (n.pinned) continue
      n.vx += (W / 2 - n.x) * 0.001
      n.vy += (H / 2 - n.y) * 0.001
    }

    // Apply velocity with damping
    for (const n of nodes) {
      if (n.pinned) continue
      n.vx *= 0.85; n.vy *= 0.85
      n.x += n.vx; n.y += n.vy
      // Bounds
      n.x = Math.max(n.radius, Math.min(W - n.radius, n.x))
      n.y = Math.max(n.radius, Math.min(H - n.radius, n.y))
    }

    forceRender(c => c + 1)
    animRef.current = requestAnimationFrame(simulate)
  }, [])

  useEffect(() => {
    if (data && data.nodes.length > 0) {
      animRef.current = requestAnimationFrame(simulate)
    }
    return () => cancelAnimationFrame(animRef.current)
  }, [data, simulate])

  // Drag handlers
  const onMouseDown = (n: GraphNode, e: React.MouseEvent) => {
    e.preventDefault()
    n.pinned = true
    setDragging(n)
  }

  const onMouseMove = useCallback((e: React.MouseEvent<SVGSVGElement>) => {
    if (!dragging || !svgRef.current) return
    const rect = svgRef.current.getBoundingClientRect()
    dragging.x = ((e.clientX - rect.left) / rect.width) * W
    dragging.y = ((e.clientY - rect.top) / rect.height) * H
    dragging.vx = 0; dragging.vy = 0
  }, [dragging])

  const onMouseUp = useCallback(() => {
    if (dragging) { dragging.pinned = false; setDragging(null) }
  }, [dragging])

  if (loading) return <div className="text-gray-400 text-center py-12">加载中...</div>
  if (!data || data.nodes.length === 0) return <div className="text-gray-500 text-center py-12">暂无项目数据</div>

  const nodes = nodesRef.current
  const nodeMap = new Map(nodes.map(n => [n.id, n]))

  return (
    <div>
      <div className="flex items-center gap-4 mb-3">
        <div className="flex gap-3 text-[10px] text-gray-400">
          <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full inline-block" style={{ background: COLORS.today }} /> 今天</span>
          <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full inline-block" style={{ background: COLORS.week }} /> 本周</span>
          <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full inline-block" style={{ background: COLORS.month }} /> 本月</span>
          <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full inline-block" style={{ background: COLORS.old }} /> 更早</span>
        </div>
        <span className="text-[10px] text-gray-600">节点大小 = 会话数 · 连线 = 同日活跃 · 可拖拽</span>
      </div>

      <div className="relative bg-gray-900/50 rounded-xl border border-gray-800 overflow-hidden">
        <svg
          ref={svgRef}
          width={W} height={H}
          className="w-full select-none"
          viewBox={`0 0 ${W} ${H}`}
          onMouseMove={onMouseMove}
          onMouseUp={onMouseUp}
          onMouseLeave={onMouseUp}
        >
          {/* Edges */}
          {edgesRef.current.map((e, i) => {
            const s = nodeMap.get(e.source), t = nodeMap.get(e.target)
            if (!s || !t) return null
            return (
              <line key={i}
                x1={s.x} y1={s.y} x2={t.x} y2={t.y}
                stroke="#475569" strokeWidth={Math.min(e.weight * 1.5, 5)}
                strokeOpacity={0.5}
              />
            )
          })}

          {/* Edge labels */}
          {edgesRef.current.map((e, i) => {
            const s = nodeMap.get(e.source), t = nodeMap.get(e.target)
            if (!s || !t || e.weight < 2) return null
            return (
              <text key={`el${i}`}
                x={(s.x + t.x) / 2} y={(s.y + t.y) / 2 - 4}
                textAnchor="middle" fill="#64748b" fontSize={9}
              >
                {e.weight}天
              </text>
            )
          })}

          {/* Nodes */}
          {nodes.map(n => (
            <g key={n.id}
              onMouseDown={e => onMouseDown(n, e)}
              onMouseEnter={() => setHovered(n)}
              onMouseLeave={() => setHovered(null)}
              style={{ cursor: dragging === n ? 'grabbing' : 'grab' }}
            >
              <circle
                cx={n.x} cy={n.y} r={n.radius}
                fill={n.color} fillOpacity={0.6}
                stroke={hovered?.id === n.id ? '#fff' : n.color}
                strokeWidth={hovered?.id === n.id ? 2.5 : 1}
                strokeOpacity={0.8}
                strokeDasharray={n.exists ? 'none' : '4 2'}
              />
              <text
                x={n.x} y={n.y + n.radius + 14}
                textAnchor="middle" fill="#9ca3af" fontSize={11} fontWeight={500}
              >
                {n.name}
              </text>
              <text
                x={n.x} y={n.y + 4}
                textAnchor="middle" fill="#fff" fontSize={10} fontWeight={600}
              >
                {n.sessionCount}
              </text>
            </g>
          ))}
        </svg>

        {/* Tooltip */}
        {hovered && !dragging && (
          <div className="absolute top-3 right-3 bg-gray-800/95 backdrop-blur border border-gray-700 rounded-xl px-4 py-3 shadow-2xl max-w-[280px]">
            <div className="text-sm font-semibold text-gray-100 mb-1">{hovered.name}</div>
            <div className="text-[10px] text-gray-500 font-mono mb-2 truncate">{hovered.path}</div>
            <div className="flex gap-4 text-xs text-gray-400">
              <span>{hovered.sessionCount} 个会话</span>
              {hovered.lastActive && (
                <span>{new Date(hovered.lastActive).toLocaleDateString('zh-CN')}</span>
              )}
            </div>
            {!hovered.exists && (
              <div className="mt-2 text-[10px] text-red-400 bg-red-900/20 px-2 py-1 rounded">⚠ 项目路径不存在</div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
