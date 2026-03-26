import { NextRequest, NextResponse } from 'next/server'
import { requireRole } from '@/lib/auth'

const MNEMONIC_API_URL = process.env.MNEMONIC_API_URL || 'http://localhost:8765'

export async function GET(request: NextRequest) {
  const auth = requireRole(request, 'viewer')
  if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: auth.status })

  const { searchParams } = new URL(request.url)
  const user_id = searchParams.get('user_id') || 'omar'

  const params = new URLSearchParams({ user_id })

  try {
    const res = await fetch(`${MNEMONIC_API_URL}/categories?${params}`, { cache: 'no-store' })
    if (!res.ok) {
      return NextResponse.json({ error: 'Mnemonic API error' }, { status: res.status })
    }
    const data = await res.json()
    return NextResponse.json(data)
  } catch {
    return NextResponse.json({ error: 'Failed to reach Mnemonic API' }, { status: 502 })
  }
}
