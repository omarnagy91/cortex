import { NextRequest, NextResponse } from 'next/server'
import { requireRole } from '@/lib/auth'
import { deriveCategoryFromUri } from '@/lib/openviking-utils'

const OPENVIKING_API_URL = process.env.OPENVIKING_API_URL || process.env.MNEMONIC_API_URL || 'http://localhost:1933'

interface VikingNode {
  id: string
  memory: string
  category: string
  importance: number
  created_at: string
}

interface VikingEdge {
  source: string
  target: string
}

interface VikingGraphData {
  nodes: VikingNode[]
  edges: VikingEdge[]
  categories: string[]
  total_memories: number
}

export async function GET(request: NextRequest) {
  const auth = requireRole(request, 'viewer')
  if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: auth.status })

  const { searchParams } = new URL(request.url)
  const max_nodes = parseInt(searchParams.get('max_nodes') || '80', 10)

  try {
    const res = await fetch(`${OPENVIKING_API_URL}/api/v1/fs/tree?uri=viking://&depth=2`, { cache: 'no-store' })
    if (!res.ok) {
      return NextResponse.json({ error: 'OpenViking API error' }, { status: res.status })
    }
    const data = await res.json()
    // OpenViking returns {status: "ok", result: [...flat array of entries...]}
    const entries: any[] = data.result || data.children || []
    
    const nodes: VikingNode[] = []
    const edges: VikingEdge[] = []
    const categories = new Set<string>()
    
    // Build URI set for parent-child edge detection
    const uriSet = new Set(entries.map((e: any) => e.uri))
    
    for (const entry of entries) {
      if (!entry.uri) continue
      const category = deriveCategoryFromUri(entry.uri)
      categories.add(category)
      
      nodes.push({
        id: entry.uri,
        memory: entry.abstract || entry.rel_path || entry.uri,
        category,
        importance: 0.5,
        created_at: entry.modTime || new Date().toISOString()
      })
      
      // Derive parent URI and create edge
      const parts = entry.uri.replace('viking://', '').split('/')
      if (parts.length > 1) {
        const parentPath = parts.slice(0, -1).join('/')
        const parentUri = 'viking://' + parentPath
        if (uriSet.has(parentUri)) {
          edges.push({ source: parentUri, target: entry.uri })
        }
      }
    }
    
    // Apply max_nodes limit
    const limitedNodes = nodes.slice(0, max_nodes)
    const nodeIds = new Set(limitedNodes.map(n => n.id))
    const filteredEdges = edges.filter(e => nodeIds.has(e.source) && nodeIds.has(e.target))
    
    const result: VikingGraphData = {
      nodes: limitedNodes,
      edges: filteredEdges,
      categories: Array.from(categories).sort(),
      total_memories: limitedNodes.length
    }
    
    return NextResponse.json(result)
  } catch {
    return NextResponse.json({ error: 'Failed to reach OpenViking API' }, { status: 502 })
  }
}
