export const dynamic = 'force-dynamic'
import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { checkProAccess } from '@/lib/subscription'
import { getStockForeignHistory } from '@/lib/cache/stockForeign'

// Singleton yahoo-finance2 — pola sama dengan app/api/portfolio/price/route.ts
let _yf: { quote: (symbol: string) => Promise<{ regularMarketPrice?: number }> } | null = null
function getYF() {
  if (!_yf) {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const YFClass = require('yahoo-finance2').default
    _yf = new YFClass({ suppressNotices: ['yahooSurvey'] })
  }
  return _yf!
}

/**
 * Prefill untuk form Strategi Average Down (prd/strategi_avg_down.md §5.2, §6.3, F4, F7, F10):
 * - posisi awal (harga rata-rata tertimbang + total lot) dari portfolio user, agregat semua akun
 * - harga saat ini dari Yahoo Finance
 * - konteks net asing 5 hari terakhir dari stock_summaries (bukan sinyal, hanya info)
 */
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    const userId = (session?.user as any)?.id
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const pro = await checkProAccess(userId)
    if (!pro.hasAccess) return NextResponse.json({ error: 'Pro access required' }, { status: 403 })

    const kode = (new URL(request.url).searchParams.get('kode') ?? '').toUpperCase()
    if (!kode) return NextResponse.json({ error: 'Parameter kode wajib diisi' }, { status: 400 })

    const [positionRows, foreignHistory, priceResult] = await Promise.all([
      prisma.$queryRawUnsafe<{ hargaRata: number; lot: number }[]>(
        `SELECT "hargaRata","lot" FROM "portfolios" WHERE "userId" = $1 AND "saham" = $2`,
        userId, kode,
      ).catch(() => []),
      getStockForeignHistory(kode, 5).catch(() => []),
      (async () => {
        try {
          const yf = getYF()
          const quote = await yf.quote(`${kode}.JK`)
          return typeof quote?.regularMarketPrice === 'number' ? quote.regularMarketPrice : null
        } catch {
          return null
        }
      })(),
    ])

    // Kolom "lot" di tabel portfolios menyimpan JUMLAH LOT (1 lot = 100 lembar) — lihat
    // konsisten di app/portfolio/page.tsx: `modal = hargaRata * lot * 100`. Jangan dibagi 100 lagi.
    let initialAvgPrice: number | null = null
    let initialLot = 0
    if (positionRows.length > 0) {
      const totalLots = positionRows.reduce((s, r) => s + r.lot, 0)
      const totalCost = positionRows.reduce((s, r) => s + r.lot * r.hargaRata, 0) // *100 batal di rasio
      initialLot = totalLots
      initialAvgPrice = totalLots > 0 ? totalCost / totalLots : null
    }

    return NextResponse.json({
      kode,
      currentPrice: priceResult,
      initialAvgPrice,
      initialLot,
      foreignContext: foreignHistory.map(r => ({
        date: r.date,
        netForeignVolume: r.netForeignVolume,
        estimatedNetForeignValue: r.estimatedNetForeignValue,
        highNonRegular: r.highNonRegular,
      })),
    })
  } catch (error) {
    console.error('GET avg-down/prefill error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
