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
    
    const nodes: VikingNode[] = []
    const edges: VikingEdge[] = []
    const categories = new Set<string>()
    
    // Transform tree entries into graph nodes
    function processEntry(entry: any, parentUri?: string) {
      if (entry.uri && entry.abstract) {
        const category = deriveCategoryFromUri(entry.uri)
        categories.add(category)
        
        nodes.push({
          id: entry.uri,
          memory: entry.abstract,
          category,
          importance: 0.5,
          created_at: entry.modTime || new Date().toISOString()
        })
        
        // Create edge to parent
        if (parentUri) {
          edges.push({
            source: parentUri,
            target: entry.uri
          })
        }
      }
      
      // Process children
      if (entry.children) {
        for (const child of entry.children) {
          processEntry(child, entry.uri)
        }
      }
    }
    
    if (data.children) {
      for (const child of data.children) {
        processEntry(child)
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
