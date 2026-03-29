import { NextRequest, NextResponse } from 'next/server'
import { requireRole } from '@/lib/auth'

const OPENVIKING_API_URL = process.env.OPENVIKING_API_URL || process.env.MNEMONIC_API_URL || 'http://localhost:1933'

export async function GET(request: NextRequest) {
  const auth = requireRole(request, 'viewer')
  if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: auth.status })

  try {
    // Get memory stats
    const statsRes = await fetch(`${OPENVIKING_API_URL}/api/v1/stats/memories`, { cache: 'no-store' })
    if (!statsRes.ok) {
      return NextResponse.json({ error: 'OpenViking API error' }, { status: statsRes.status })
    }
    const statsData = await statsRes.json()
    
    // Get resource count
    const resourcesRes = await fetch(`${OPENVIKING_API_URL}/api/v1/fs/tree?uri=viking://resources&depth=1`, { cache: 'no-store' })
    let resourceCount = 0
    if (resourcesRes.ok) {
      const resourcesData = await resourcesRes.json()
      resourceCount = resourcesData.children?.length || 0
    }
    
    // Transform response to match old shape
    const result = {
      total_memories: statsData.total_memories + resourceCount,
      categories: statsData.by_category || {},
      by_source: {
        openviking: resourceCount,
        memories: statsData.total_memories
      },
      importance_distribution: statsData.hotness_distribution || {},
      recent_24h: statsData.staleness?.not_accessed_7d ? 0 : statsData.total_memories,
      recent_7d: statsData.total_memories - (statsData.staleness?.not_accessed_7d || 0),
      average_importance: 0.5
    }
    
    return NextResponse.json(result)
  } catch {
    return NextResponse.json({ error: 'Failed to reach OpenViking API' }, { status: 502 })
  }
}
