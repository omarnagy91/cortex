'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useTranslations } from 'next-intl'
import { GraphCanvas, GraphCanvasRef, type Theme, type GraphNode as ReagraphNode, type GraphEdge as ReagraphEdge, type InternalGraphNode } from 'reagraph'

// --- Mnemonic data interfaces ---

interface VikingNode {
  id: string
  memory: string
  category: string
  importance: number
  created_at: string
}

interface VikingEdge {
  from: string
  to: string
  similarity: number
  weight: number
}

interface VikingGraphData {
  nodes: VikingNode[]
  edges: VikingEdge[]
  categories: string[]
  total_memories: number
}

type CategoryName = 
  | 'personal' | 'business' | 'technical' | 'decision' | 'relationship' | 'temporal' | 'uncategorized'
  | 'profile' | 'preferences' | 'entities' | 'events' | 'cases' | 'patterns' | 'tools' | 'skills'
  | 'agent' | 'resources' | 'user' | 'session'

const CATEGORY_COLORS: Record<CategoryName, string> = {
  // Legacy Mnemonic categories
  personal: '#4CAF50',
  business: '#2196F3',
  technical: '#FF9800',
  decision: '#9C27B0',
  relationship: '#E91E63',
  temporal: '#607D8B',
  uncategorized: '#795548',
  // OpenViking categories
  profile: '#00BCD4',
  preferences: '#8BC34A',
  entities: '#3F51B5',
  events: '#FF5722',
  cases: '#009688',
  patterns: '#CDDC39',
  tools: '#FFC107',
  skills: '#673AB7',
  // Scope categories
  agent: '#1E88E5',
  resources: '#43A047',
  user: '#FB8C00',
  session: '#8E24AA'
}

function getCategoryColor(cat: string): string {
  return CATEGORY_COLORS[cat as CategoryName] ?? '#795548'
}

// --- Obsidian-inspired theme ---

const obsidianTheme: Theme = {
  canvas: {
    background: '#11111b',
    fog: '#11111b',
  },
  node: {
    fill: '#6c7086',
    activeFill: '#cba6f7',
    opacity: 1,
    selectedOpacity: 1,
    inactiveOpacity: 0.1,
    label: {
      color: '#cdd6f4',
      stroke: '#11111b',
      activeColor: '#f5f5f7',
    },
  },
  ring: {
    fill: '#6c7086',
    activeFill: '#cba6f7',
  },
  edge: {
    fill: '#45475a',
    activeFill: '#cba6f7',
    opacity: 0.25,
    selectedOpacity: 0.6,
    inactiveOpacity: 0.05,
    label: {
      color: '#6c7086',
      activeColor: '#cdd6f4',
    },
  },
  arrow: {
    fill: '#45475a',
    activeFill: '#cba6f7',
  },
  lasso: {
    background: 'rgba(203, 166, 247, 0.08)',
    border: 'rgba(203, 166, 247, 0.25)',
  },
}

// --- Component ---

export function MemoryGraph() {
  const t = useTranslations('memoryGraph')
  const [data, setData] = useState<VikingGraphData | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [categoryFilter, setCategoryFilter] = useState<string>('')
  const [selectedNode, setSelectedNode] = useState<VikingNode | null>(null)
  const [actives, setActives] = useState<string[]>([])
  const [hoveredNode, setHoveredNode] = useState<{ label: string; sub?: string } | null>(null)

  const graphRef = useRef<GraphCanvasRef | null>(null)

  const fetchData = useCallback(async () => {
    setIsLoading(true)
    setError(null)
    try {
      const params = new URLSearchParams({ user_id: 'omar', max_nodes: '80' })
      if (categoryFilter) params.set('category', categoryFilter)
      const res = await fetch(`/api/memory/graph?${params}`)
      if (!res.ok) {
        const d = await res.json().catch(() => ({}))
        throw new Error(d.error || `HTTP ${res.status}`)
      }
      const d = await res.json()
      setData(d)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to load')
    } finally {
      setIsLoading(false)
    }
  }, [categoryFilter])

  useEffect(() => { fetchData() }, [fetchData])

  // Build reagraph nodes/edges from Mnemonic data
  const { graphNodes, graphEdges } = useMemo(() => {
    if (!data?.nodes?.length) return { graphNodes: [], graphEdges: [] }

    const nodes: ReagraphNode[] = data.nodes.map(n => ({
      id: n.id,
      label: n.memory.slice(0, 40) + (n.memory.length > 40 ? '…' : ''),
      fill: getCategoryColor(n.category),
      size: Math.max(2, Math.min(10, 2 + n.importance * 0.7)),
      data: n,
    }))

    const nodeIds = new Set(data.nodes.map(n => n.id))
    const edges: ReagraphEdge[] = (data.edges || [])
      .filter(e => nodeIds.has(e.from) && nodeIds.has(e.to))
      .map((e, i) => ({
        id: `edge-${i}`,
        source: e.from,
        target: e.to,
        label: e.similarity ? e.similarity.toFixed(2) : undefined,
      }))

    return { graphNodes: nodes, graphEdges: edges }
  }, [data])

  // Auto-fit after layout settles
  useEffect(() => {
    if (!graphNodes.length) return
    const t1 = setTimeout(() => graphRef.current?.fitNodesInView(undefined, { animated: false }), 800)
    const t2 = setTimeout(() => graphRef.current?.fitNodesInView(undefined, { animated: false }), 2500)
    return () => { clearTimeout(t1); clearTimeout(t2) }
  }, [graphNodes.length, categoryFilter])

  const handleNodeClick = useCallback((node: InternalGraphNode) => {
    if (node.data) {
      setSelectedNode(node.data as VikingNode)
    }
  }, [])

  const handleNodeHover = useCallback((node: InternalGraphNode) => {
    setActives([node.id])
    if (node.data) {
      const d = node.data as VikingNode
      setHoveredNode({
        label: d.memory.slice(0, 80) + (d.memory.length > 80 ? '…' : ''),
        sub: `${d.category} · imp: ${d.importance}`,
      })
    }
  }, [])

  const handleNodeUnhover = useCallback(() => {
    setActives([])
    setHoveredNode(null)
  }, [])

  const handleCanvasClick = useCallback(() => {
    setActives([])
    setSelectedNode(null)
    setHoveredNode(null)
  }, [])

  // Connected memories for selected node
  const connectedMemories = useMemo(() => {
    if (!selectedNode || !data) return []
    const edges = data.edges || []
    return edges
      .filter(e => e.from === selectedNode.id || e.to === selectedNode.id)
      .map(e => {
        const otherId = e.from === selectedNode.id ? e.to : e.from
        const other = data.nodes.find(n => n.id === otherId)
        return other ? { node: other, similarity: e.similarity } : null
      })
      .filter(Boolean)
      .slice(0, 5) as { node: VikingNode; similarity: number }[]
  }, [selectedNode, data])

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full" style={{ background: '#11111b' }}>
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 rounded-full border-2 border-[#cba6f7]/30 border-t-[#cba6f7] animate-spin" />
          <span className="text-[#6c7086] text-sm font-mono">{t('loading')}</span>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-3" style={{ background: '#11111b' }}>
        <span className="text-[#f38ba8] text-sm">{error}</span>
        <button onClick={fetchData} className="px-3 py-1.5 text-xs rounded-md bg-[#1e1e2e] border border-[#45475a] text-[#cdd6f4] hover:border-[#cba6f7]/50 transition-colors">
          {t('retry')}
        </button>
      </div>
    )
  }

  if (!data?.nodes?.length) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-2" style={{ background: '#11111b' }}>
        <span className="text-[#6c7086] text-sm">{t('noMemoryDatabases')}</span>
        <span className="text-[#45475a] text-xs">{t('noMemoryDatabasesHint')}</span>
      </div>
    )
  }

  const categories = data.categories || []

  return (
    <div className="relative h-full w-full overflow-hidden" style={{ background: '#11111b' }}>
      <GraphCanvas
        ref={graphRef}
        nodes={graphNodes}
        edges={graphEdges}
        theme={obsidianTheme}
        layoutType="forceDirected2d"
        layoutOverrides={{ linkDistance: 80, nodeStrength: -60 }}
        labelType="auto"
        edgeArrowPosition="none"
        animated={true}
        draggable={true}
        defaultNodeSize={4}
        minNodeSize={2}
        maxNodeSize={10}
        cameraMode="pan"
        actives={actives}
        onNodeClick={handleNodeClick}
        onNodePointerOver={handleNodeHover}
        onNodePointerOut={handleNodeUnhover}
        onCanvasClick={handleCanvasClick}
      />

      {/* Category filter (top-left) */}
      <div className="absolute top-3 left-3 flex items-center gap-2 z-10">
        <select
          value={categoryFilter}
          onChange={e => setCategoryFilter(e.target.value)}
          className="px-2 py-1 text-[11px] font-mono rounded-md bg-[#1e1e2e]/90 backdrop-blur-xl border border-[#45475a]/50 text-[#cdd6f4] focus:outline-none focus:border-[#cba6f7]/40"
        >
          <option value="">All categories</option>
          {categories.map(c => (
            <option key={c} value={c}>{c}</option>
          ))}
        </select>
        <button onClick={fetchData} className="px-2 py-1 text-[11px] font-mono rounded-md bg-[#1e1e2e]/80 backdrop-blur-xl border border-[#45475a]/50 text-[#6c7086] hover:text-[#cdd6f4] transition-colors">
          ↺
        </button>
      </div>

      {/* Stats (top-right) */}
      <div className="absolute top-3 right-3 z-10">
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-md bg-[#1e1e2e]/80 backdrop-blur-xl border border-[#45475a]/30">
          <span className="text-[10px] font-mono">
            <span className="text-[#cdd6f4]">{data.nodes.length}</span>
            <span className="text-[#585b70] ml-1">nodes</span>
          </span>
          <span className="text-[#313244]">|</span>
          <span className="text-[10px] font-mono">
            <span className="text-[#cdd6f4]">{graphEdges.length}</span>
            <span className="text-[#585b70] ml-1">edges</span>
          </span>
          {data.total_memories > 0 && (
            <>
              <span className="text-[#313244]">|</span>
              <span className="text-[10px] font-mono">
                <span className="text-[#cdd6f4]">{data.total_memories}</span>
                <span className="text-[#585b70] ml-1">total</span>
              </span>
            </>
          )}
        </div>
      </div>

      {/* Hover tooltip (bottom-center) */}
      {hoveredNode && (
        <div className="absolute bottom-16 left-1/2 -translate-x-1/2 z-10 pointer-events-none">
          <div className="px-3 py-2 rounded-lg bg-[#1e1e2e]/90 backdrop-blur-xl border border-[#45475a]/40 shadow-2xl shadow-black/40 max-w-md">
            <div className="text-[11px] font-mono text-[#cdd6f4] truncate">{hoveredNode.label}</div>
            {hoveredNode.sub && (
              <div className="text-[10px] font-mono text-[#6c7086] mt-0.5">{hoveredNode.sub}</div>
            )}
          </div>
        </div>
      )}

      {/* Selected node detail panel (bottom-left) */}
      {selectedNode && (
        <div className="absolute bottom-3 left-3 z-10 max-w-xs">
          <div className="px-4 py-3 rounded-lg bg-[#1e1e2e]/95 backdrop-blur-xl border border-[#45475a]/40 shadow-2xl shadow-black/40">
            <div className="flex items-start justify-between gap-3 mb-2">
              <div className="flex items-center gap-1.5">
                <span
                  className="w-2 h-2 rounded-full shrink-0"
                  style={{ backgroundColor: getCategoryColor(selectedNode.category) }}
                />
                <span className="text-[10px] font-mono text-[#6c7086] capitalize">{selectedNode.category}</span>
                <span className="text-[10px] font-mono text-[#6c7086]">· imp: {selectedNode.importance}</span>
              </div>
              <button
                onClick={() => setSelectedNode(null)}
                className="text-[#6c7086] hover:text-[#cdd6f4] text-xs transition-colors shrink-0"
              >
                ×
              </button>
            </div>
            <p className="text-[11px] text-[#cdd6f4] mb-2 line-clamp-3">{selectedNode.memory}</p>
            {connectedMemories.length > 0 && (
              <div>
                <div className="text-[9px] font-mono text-[#585b70] uppercase mb-1.5">Connected</div>
                <div className="space-y-1">
                  {connectedMemories.map(({ node, similarity }, i) => (
                    <div key={i} className="flex gap-2 text-[10px]">
                      <span className="text-[#6c7086] font-mono shrink-0">{similarity.toFixed(2)}</span>
                      <span className="text-[#a6adc8] truncate">{node.memory.slice(0, 50)}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Category legend (bottom-right) */}
      <div className="absolute bottom-3 right-3 z-10">
        <div className="px-3 py-2 rounded-lg bg-[#1e1e2e]/80 backdrop-blur-xl border border-[#45475a]/30">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[9px] font-mono text-[#585b70] max-w-[280px]">
            {Object.entries(CATEGORY_COLORS).map(([cat, color]) => (
              <span key={cat} className="flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ backgroundColor: color }} />
                {cat}
              </span>
            ))}
          </div>
        </div>
      </div>

      {/* Keyboard hint */}
      <div className="absolute bottom-3 left-1/2 -translate-x-1/2 z-10 text-[9px] font-mono text-[#313244] pointer-events-none select-none">
        {t('keyboardHint')}
      </div>
    </div>
  )
}
