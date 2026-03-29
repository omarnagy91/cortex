import { NextRequest, NextResponse } from 'next/server'
import { requireRole } from '@/lib/auth'
import { deriveCategoryFromUri } from '@/lib/openviking-utils'

const OPENVIKING_API_URL = process.env.OPENVIKING_API_URL || process.env.MNEMONIC_API_URL || 'http://localhost:1933'

export async function POST(request: NextRequest) {
  const auth = requireRole(request, 'viewer')
  if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: auth.status })

  try {
    const body = await request.json()
    const { query, limit } = body
    
    const res = await fetch(`${OPENVIKING_API_URL}/api/v1/search/search`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query, limit }),
      cache: 'no-store',
    })
    
    if (!res.ok) {
      return NextResponse.json({ error: 'OpenViking API error' }, { status: res.status })
    }
    
    const raw = await res.json()
    const data = raw.result || raw
    
    // Transform response: merge memories + resources + skills arrays into flat results
    const memories = data.memories || []
    const resources = data.resources || []
    const skills = data.skills || []
    
    const results = [...memories, ...resources, ...skills].map((item: any) => ({
      memory: item.abstract || item.uri,
      category: deriveCategoryFromUri(item.uri),
      importance: item.score || 0.5,
      created_at: new Date().toISOString(),
      score: item.score || 0
    }))
    
    return NextResponse.json({ results })
  } catch {
    return NextResponse.json({ error: 'Failed to reach OpenViking API' }, { status: 502 })
  }
}
