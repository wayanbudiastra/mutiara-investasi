export const dynamic = 'force-dynamic'
import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { checkProAccess } from '@/lib/subscription'

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

interface DividendYearRow {
  tahun: number
  dividenPerLembar: number
  jumlahEvent: number
}

/**
 * Prefill untuk form Strategi Average Down (prd/strategi_avg_down.md §5.2, §6.3, F4, F7, F10):
 * - posisi awal (harga rata-rata tertimbang + total lot) dari portfolio user, agregat semua akun
 * - harga saat ini dari Yahoo Finance
 * - estimasi dividen/lembar tahun terakhir dari riwayat Rekap Dividen milik user (status DONE),
 *   dipakai frontend untuk memproyeksikan estimasi total dividen dari hasil simulasi average down
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

    const [positionRows, dividendYearRows, priceResult] = await Promise.all([
      prisma.$queryRawUnsafe<{ hargaRata: number; lot: number }[]>(
        `SELECT "hargaRata","lot" FROM "portfolios" WHERE "userId" = $1 AND "saham" = $2`,
        userId, kode,
      ).catch(() => []),
      prisma.$queryRawUnsafe<DividendYearRow[]>(
        `SELECT "tahun", SUM("dividen")::float8 AS "dividenPerLembar", COUNT(*)::int AS "jumlahEvent"
         FROM "dividends" WHERE "userId" = $1 AND "saham" = $2 AND "status" = 'DONE'
         GROUP BY "tahun" ORDER BY "tahun" DESC`,
        userId, kode,
      ).catch(() => []),
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

    // Pilih tahun terakhir YANG SUDAH LEWAT PENUH (currentYear - 1) sebagai basis estimasi supaya
    // tidak underestimate dari tahun berjalan yang datanya mungkin belum lengkap. Jika tidak ada
    // data untuk tahun itu, fallback ke tahun terbaru yang tersedia (termasuk tahun berjalan).
    const currentYear = new Date().getFullYear()
    let dividendEstimate: { yearUsed: number; dividenPerLembar: number; isFallbackYear: boolean; jumlahEvent: number } | null = null
    if (dividendYearRows.length > 0) {
      const lastFullYearRow = dividendYearRows.find(r => r.tahun === currentYear - 1)
      const chosen = lastFullYearRow ?? dividendYearRows[0]
      dividendEstimate = {
        yearUsed: chosen.tahun,
        dividenPerLembar: chosen.dividenPerLembar,
        isFallbackYear: chosen.tahun !== currentYear - 1,
        jumlahEvent: chosen.jumlahEvent,
      }
    }

    return NextResponse.json({
      kode,
      currentPrice: priceResult,
      initialAvgPrice,
      initialLot,
      dividendEstimate,
    })
  } catch (error) {
    console.error('GET avg-down/prefill error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
