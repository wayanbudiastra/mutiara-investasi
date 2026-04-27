export const dynamic = 'force-dynamic'
import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

// Singleton yahoo-finance2 instance
let _yf: { quote: (symbol: string) => Promise<{ regularMarketPrice?: number }> } | null = null

function getYF() {
  if (!_yf) {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const YFClass = require('yahoo-finance2').default
    _yf = new YFClass({ suppressNotices: ['yahooSurvey'] })
  }
  return _yf!
}

interface PriceResult {
  price: number | null
  isCache: boolean
  lastPriceAt: string | null
}

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    const userId = (session?.user as any)?.id
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { searchParams } = new URL(request.url)
    const symbols = (searchParams.get('symbols') ?? '')
      .split(',').map(s => s.trim().toUpperCase()).filter(Boolean)

    if (symbols.length === 0) return NextResponse.json({})

    // Ambil cache yang tersimpan di DB untuk semua simbol
    let cacheMap: Record<string, { lastPrice: number | null; lastPriceAt: string | null }> = {}
    try {
      const cached = await prisma.$queryRawUnsafe<{
        saham: string; lastPrice: number | null; lastPriceAt: string | null
      }[]>(
        `SELECT "saham", "lastPrice", "lastPriceAt"
         FROM "portfolios"
         WHERE "userId" = $1 AND "saham" = ANY($2::text[])`,
        userId, symbols
      )
      cached.forEach(r => {
        cacheMap[r.saham] = { lastPrice: r.lastPrice, lastPriceAt: r.lastPriceAt }
      })
    } catch {
      // kolom belum ada (sebelum migrasi) — skip cache
    }

    const yf = getYF()
    const result: Record<string, PriceResult> = {}
    const now = new Date().toISOString()

    await Promise.all(
      symbols.map(async (sym) => {
        try {
          const quote = await yf.quote(`${sym}.JK`)
          const price = typeof quote?.regularMarketPrice === 'number'
            ? quote.regularMarketPrice
            : null

          if (price !== null) {
            // Berhasil — simpan ke cache DB
            result[sym] = { price, isCache: false, lastPriceAt: now }
            try {
              await prisma.$executeRawUnsafe(
                `UPDATE "portfolios"
                 SET "lastPrice"=$1, "lastPriceAt"=$2
                 WHERE "userId"=$3 AND "saham"=$4`,
                price, now, userId, sym
              )
            } catch { /* skip jika kolom belum ada */ }
          } else {
            // Harga null dari Yahoo — gunakan cache jika ada
            const cache = cacheMap[sym]
            result[sym] = {
              price: cache?.lastPrice ?? null,
              isCache: cache?.lastPrice != null,
              lastPriceAt: cache?.lastPriceAt ?? null,
            }
          }
        } catch {
          // Yahoo Finance error — gunakan cache
          const cache = cacheMap[sym]
          result[sym] = {
            price: cache?.lastPrice ?? null,
            isCache: cache?.lastPrice != null,
            lastPriceAt: cache?.lastPriceAt ?? null,
          }
        }
      })
    )

    return NextResponse.json(result)
  } catch (error) {
    console.error('GET portfolio/price error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
