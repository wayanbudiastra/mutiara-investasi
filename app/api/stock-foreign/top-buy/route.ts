export const dynamic = 'force-dynamic'
import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { checkProAccess } from '@/lib/subscription'
import { getCachedTopForeignBuy } from '@/lib/cache/stockForeign'
import { getLatestBrokerDate } from '@/lib/cache/brokersTop'

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    const userId = (session?.user as any)?.id
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const pro = await checkProAccess(userId)
    if (!pro.hasAccess) return NextResponse.json({ error: 'Pro access required' }, { status: 403 })

    const { searchParams } = new URL(request.url)
    const limit = Math.min(Math.max(parseInt(searchParams.get('limit') ?? '10') || 10, 1), 50)
    const date = searchParams.get('date') ?? await getLatestBrokerDate()
    if (!date) return NextResponse.json({ date: null, data: [] })

    const data = await getCachedTopForeignBuy(date, limit)
    return NextResponse.json({ date, data })
  } catch (error) {
    console.error('GET stock-foreign/top-buy error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
