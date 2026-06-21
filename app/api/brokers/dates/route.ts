export const dynamic = 'force-dynamic'
import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { checkProAccess } from '@/lib/subscription'

/** Tanggal yang tersedia di broker_summaries — dibatasi 30 hari terakhir (lihat prd/data_transaksi.md §10). */
export async function GET() {
  try {
    const session = await getServerSession(authOptions)
    const userId = (session?.user as any)?.id
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const pro = await checkProAccess(userId)
    if (!pro.hasAccess) return NextResponse.json({ error: 'Pro access required' }, { status: 403 })

    const rows = await prisma.$queryRawUnsafe<{ date: string }[]>(
      `SELECT DISTINCT "date" FROM "broker_summaries" ORDER BY "date" DESC LIMIT 30`,
    )
    return NextResponse.json({ dates: rows.map(r => r.date) })
  } catch (error) {
    console.error('GET brokers/dates error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
