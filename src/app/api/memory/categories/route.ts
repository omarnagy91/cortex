import { NextRequest, NextResponse } from 'next/server'
import { requireRole } from '@/lib/auth'
import { deriveCategoryFromUri } from '@/lib/openviking-utils'

const OPENVIKING_API_URL = process.env.OPENVIKING_API_URL || process.env.MNEMONIC_API_URL || 'http://localhost:1933'

export async function GET(request: NextRequest) {
  const auth = requireRole(request, 'viewer')
  if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: auth.status })

  try {
    const categoryCount: Record<string, number> = {}
    
    // Get categories from memory stats
    const statsRes = await fetch(`${OPENVIKING_API_URL}/api/v1/stats/memories`, { cache: 'no-store' })
    if (statsRes.ok) {
      const statsData = await statsRes.json()
      if (statsData.by_category) {
        Object.assign(categoryCount, statsData.by_category)
      }
    }
    
    // Also scan filesystem categories
    const fsRes = await fetch(`${OPENVIKING_API_URL}/api/v1/fs/tree?uri=viking://resources/memories&depth=1`, { cache: 'no-store' })
    if (fsRes.ok) {
      const fsData = await fsRes.json()
      if (fsData.children) {
        for (const child of fsData.children) {
          if (child.uri) {
            const category = deriveCategoryFromUri(child.uri)
            categoryCount[category] = (categoryCount[category] || 0) + 1
          }
        }
      }
    }
    
    // Transform to expected format
    const categories = Object.entries(categoryCount).map(([name, count]) => ({ name, count }))
    
    return NextResponse.json({ categories })
  } catch {
    return NextResponse.json({ error: 'Failed to reach OpenViking API' }, { status: 502 })
  }
}
