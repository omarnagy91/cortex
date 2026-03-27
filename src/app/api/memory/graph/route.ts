import { NextRequest, NextResponse } from 'next/server'
import { requireRole } from '@/lib/auth'

const MNEMONIC_API_URL = process.env.MNEMONIC_API_URL || 'http://localhost:8765'

export async function GET(request: NextRequest) {
  const auth = requireRole(request, 'viewer')
  if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: auth.status })

  const { searchParams } = new URL(request.url)
  const user_id = searchParams.get('user_id') || 'omar'
  const max_nodes = searchParams.get('max_nodes') || '80'
  const category = searchParams.get('category')
  const similarity_threshold = searchParams.get('similarity_threshold') || '0.55'

  const params = new URLSearchParams({ user_id, max_nodes, similarity_threshold })
  if (category) params.set('category', category)

  try {
    const res = await fetch(`${MNEMONIC_API_URL}/graph?${params}`, { cache: 'no-store' })
    if (!res.ok) {
      return NextResponse.json({ error: 'Mnemonic API error' }, { status: res.status })
    }
    const data = await res.json()
    
    // Fix categories — extract from nodes if API returns incomplete list
    if (data.nodes?.length) {
      const catSet = new Set<string>()
      for (const node of data.nodes) {
        if (node.category) catSet.add(node.category)
      }
      data.categories = Array.from(catSet).sort()
    }
    
    return NextResponse.json(data)
  } catch {
    return NextResponse.json({ error: 'Failed to reach Mnemonic API' }, { status: 502 })
  }
}
