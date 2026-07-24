export const dynamic = 'force-dynamic'
import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { checkProAccess } from '@/lib/subscription'
import { getStockForeignHistory } from '@/lib/cache/stockForeign'

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    const userId = (session?.user as any)?.id
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const pro = await checkProAccess(userId)
    if (!pro.hasAccess) return NextResponse.json({ error: 'Pro access required' }, { status: 403 })

    const { searchParams } = new URL(request.url)
    const stockCode = (searchParams.get('kode') ?? '').toUpperCase()
    if (!stockCode) return NextResponse.json({ error: 'Parameter kode wajib diisi' }, { status: 400 })

    const days = Math.min(Math.max(parseInt(searchParams.get('days') ?? '30') || 30, 1), 90)

    const data = await getStockForeignHistory(stockCode, days)
    return NextResponse.json({ kode: stockCode, data })
  } catch (error) {
    console.error('GET stock-foreign/history error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
