import { NextRequest, NextResponse } from 'next/server'
import { requireRole } from '@/lib/auth'

const OPENVIKING_API_URL = process.env.OPENVIKING_API_URL || process.env.MNEMONIC_API_URL || 'http://localhost:1933'

export async function GET(request: NextRequest) {
  const auth = requireRole(request, 'viewer')
  if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: auth.status })

  try {
    // Get memory stats
    const statsRes = await fetch(`${OPENVIKING_API_URL}/api/v1/stats/memories`, { cache: 'no-store' })
    const statsOk = statsRes.ok
    const statsData = statsOk ? (await statsRes.json()).result || {} : {}
    
    // Get resource count from tree
    const resourcesRes = await fetch(`${OPENVIKING_API_URL}/api/v1/fs/tree?uri=viking://resources&depth=1`, { cache: 'no-store' })
    let resourceCount = 0
    let categoryCounts: Record<string, number> = {}
    if (resourcesRes.ok) {
      const resourcesData = await resourcesRes.json()
      const entries = resourcesData.result || []
      resourceCount = entries.length
      // Count by top-level resource category
      for (const entry of entries) {
        const name = (entry.rel_path || '').replace('resources/', '').split('/')[0].replace('.md', '')
        if (name) categoryCounts[name] = (categoryCounts[name] || 0) + 1
      }
    }
    
    // Merge categories from both sources
    const mergedCategories = { ...categoryCounts, ...(statsData.by_category || {}) }
    const memCount = statsData.total_memories || 0
    
    const result = {
      total_memories: memCount + resourceCount,
      categories: mergedCategories,
      by_source: {
        openviking_resources: resourceCount,
        openviking_memories: memCount
      },
      importance_distribution: statsData.hotness_distribution || {},
      recent_24h: 0,
      recent_7d: resourceCount,
      average_importance: 0.5
    }
    
    return NextResponse.json(result)
  } catch {
    return NextResponse.json({ error: 'Failed to reach OpenViking API' }, { status: 502 })
  }
}
