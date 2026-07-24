export const dynamic = 'force-dynamic'
export const maxDuration = 60

import { NextRequest, NextResponse } from 'next/server'
import { revalidateTag } from 'next/cache'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { checkProAccess } from '@/lib/subscription'
import { toIdxDate } from '@/lib/idx-client'
import { runIdxSync, runStockSummaryForCode, ensureIdxTables } from '@/lib/syncIdx'

/**
 * Trigger sync IDX untuk hari terbaru.
 * - Tanpa parameter ?kode= : sync penuh (broker, foreign/domestic flow, semua saham) —
 *   dipakai tombol "Perbarui Data" di menu Data Index.
 * - Dengan ?kode=XXX : hanya upsert 1 baris stock_summaries untuk saham itu (ringan, ~1-2 detik
 *   alih-alih ~40-50 detik) — dipakai tombol di halaman detail Data Transaksi per saham.
 */
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    const userId = (session?.user as any)?.id
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const pro = await checkProAccess(userId)
    if (!pro.hasAccess) return NextResponse.json({ error: 'Pro access required' }, { status: 403 })

    const now = new Date()
    const date = toIdxDate(now)
    const isoDate = `${date.slice(0, 4)}-${date.slice(4, 6)}-${date.slice(6, 8)}`

    const kode = new URL(request.url).searchParams.get('kode')?.toUpperCase()

    if (kode) {
      await ensureIdxTables()
      const stock = await runStockSummaryForCode(date, kode)

      // @ts-ignore
      revalidateTag(`stock-foreign:${isoDate}`)

      if (stock.success) {
        console.log(`[data-transaksi/refresh] stock(${kode}): ${stock.count} baris, ${stock.durationMs}ms`)
      } else {
        console.error(`[data-transaksi/refresh] stock(${kode}) GAGAL: ${stock.error}`)
      }

      return NextResponse.json({
        ranAt: now.toISOString(),
        params: { date, kode },
        results: { stock },
      })
    }

    const year = now.getFullYear()
    const month = now.getMonth() + 1

    const { broker, foreign, domestic, stock, paramsUsed } = await runIdxSync({ date, year, month })

    // @ts-ignore
    revalidateTag(`brokers-top:${isoDate}`)
    // @ts-ignore
    revalidateTag(`investor-flow:${isoDate}`)
    // @ts-ignore
    revalidateTag(`stock-foreign:${isoDate}`)
    // @ts-ignore
    revalidateTag(`top-foreign-buy:${isoDate}`)

    const results = { broker, foreign, domestic, stock }
    for (const [name, r] of Object.entries(results)) {
      if (r.success) {
        console.log(`[data-transaksi/refresh] ${name}: ${r.count} baris, ${r.durationMs}ms`)
      } else {
        console.error(`[data-transaksi/refresh] ${name} GAGAL: ${r.error}`)
      }
    }

    return NextResponse.json({
      ranAt: now.toISOString(),
      params: paramsUsed,
      results,
    })
  } catch (error) {
    console.error('data-transaksi/refresh error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
