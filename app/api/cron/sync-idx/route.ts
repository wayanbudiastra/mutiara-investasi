export const dynamic = 'force-dynamic'
export const maxDuration = 60

import { NextRequest, NextResponse } from 'next/server'
import { toIdxDate } from '@/lib/idx-client'
import { runIdxSync } from '@/lib/syncIdx'

function checkAuth(request: NextRequest): boolean {
  const expected = process.env.IDX_SYNC_BEARER_TOKEN
  if (!expected) return false
  const auth = request.headers.get('authorization') ?? ''
  const token = auth.replace(/^Bearer\s+/i, '')
  return token === expected
}

export async function GET(request: NextRequest) {
  if (!checkAuth(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const { searchParams } = new URL(request.url)
    const now = new Date()
    const date = searchParams.get('date') ?? toIdxDate(now)
    const year = parseInt(searchParams.get('year') ?? '') || now.getFullYear()
    const month = parseInt(searchParams.get('month') ?? '') || now.getMonth() + 1

    const { broker, foreign, domestic, stock, paramsUsed } = await runIdxSync({ date, year, month })

    const results = { broker, foreign, domestic, stock }
    for (const [name, r] of Object.entries(results)) {
      if (r.success) {
        console.log(`[sync-idx] ${name}: ${r.count} baris, ${r.durationMs}ms`)
      } else {
        console.error(`[sync-idx] ${name} GAGAL: ${r.error}`)
      }
    }

    return NextResponse.json({
      ranAt: now.toISOString(),
      params: paramsUsed,
      results,
    })
  } catch (error) {
    console.error('sync-idx error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
