import { NextRequest, NextResponse } from 'next/server'
import { requireRole } from '@/lib/auth'
import { deriveCategoryFromUri } from '@/lib/openviking-utils'

const OPENVIKING_API_URL = process.env.OPENVIKING_API_URL || process.env.MNEMONIC_API_URL || 'http://localhost:1933'

export async function GET(request: NextRequest) {
  const auth = requireRole(request, 'viewer')
  if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: auth.status })

  const { searchParams } = new URL(request.url)
  const limit = parseInt(searchParams.get('limit') || '100', 10)
  const category = searchParams.get('category')

  try {
    const res = await fetch(`${OPENVIKING_API_URL}/api/v1/fs/tree?uri=viking://resources&depth=3`, { cache: 'no-store' })
    if (!res.ok) {
      return NextResponse.json({ error: 'OpenViking API error' }, { status: res.status })
    }
    
    const raw = await res.json()
    // OpenViking tree returns flat array in result
    const treeEntries: any[] = raw.result || raw.children || []
    const entries: any[] = []
    
    for (const entry of treeEntries) {
      if (!entry.uri) continue
      const entryCategory = deriveCategoryFromUri(entry.uri)
      
      // Filter by category if provided
      if (category && entryCategory !== category) continue
      
      entries.push({
        memory: entry.abstract || entry.rel_path || entry.uri,
        category: entryCategory,
        importance: 0.5,
        created_at: entry.modTime || new Date().toISOString()
      })
    }
    
    // Sort by modTime descending and apply limit
    entries.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
    const limitedEntries = entries.slice(0, limit)
    
    return NextResponse.json({ entries: limitedEntries })
  } catch {
    return NextResponse.json({ error: 'Failed to reach OpenViking API' }, { status: 502 })
  }
}
