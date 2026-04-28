export const dynamic = 'force-dynamic'
import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { randomUUID } from 'crypto'

async function ensureTable() {
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "portfolios" (
      "id"         TEXT NOT NULL PRIMARY KEY,
      "userId"     TEXT NOT NULL,
      "keterangan" TEXT NOT NULL,
      "saham"      TEXT NOT NULL,
      "hargaRata"  DOUBLE PRECISION NOT NULL,
      "lot"        INTEGER NOT NULL,
      "createdAt"  TEXT NOT NULL,
      "updatedAt"  TEXT NOT NULL
    )
  `)
  // Tambah kolom cache harga otomatis — aman jika sudah ada
  await prisma.$executeRawUnsafe(
    `ALTER TABLE "portfolios" ADD COLUMN IF NOT EXISTS "lastPrice" DOUBLE PRECISION`
  )
  await prisma.$executeRawUnsafe(
    `ALTER TABLE "portfolios" ADD COLUMN IF NOT EXISTS "lastPriceAt" TEXT`
  )
}

// Singleton yahoo-finance2 — shared dengan price route
let _yf: { quote: (s: string) => Promise<{ regularMarketPrice?: number }> } | null = null
function getYF() {
  if (!_yf) {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const YFClass = require('yahoo-finance2').default
    _yf = new YFClass({ suppressNotices: ['yahooSurvey'] })
  }
  return _yf!
}

// GET — return rows + lastPrice & lastPriceAt (tidak hit Yahoo Finance)
export async function GET() {
  try {
    const session = await getServerSession(authOptions)
    const userId = (session?.user as any)?.id
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    await ensureTable()

    // ensureTable() sudah memastikan kolom lastPrice & lastPriceAt ada
    const rows = await prisma.$queryRawUnsafe<{
      id: string; keterangan: string; saham: string
      hargaRata: number; lot: number
      lastPrice: number | null; lastPriceAt: string | null
    }[]>(
      `SELECT "id","userId","keterangan","saham","hargaRata","lot",
              "createdAt","updatedAt","lastPrice","lastPriceAt"
       FROM "portfolios"
       WHERE "userId" = $1
       ORDER BY "keterangan" ASC, "saham" ASC`,
      userId
    )
    return NextResponse.json(rows)
  } catch (error) {
    console.error('GET portfolio error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// POST — simpan posisi baru + langsung fetch harga saham baru dari Yahoo Finance
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    const userId = (session?.user as any)?.id
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    await ensureTable()

    const body   = await request.json()
    const id     = randomUUID()
    const now    = new Date().toISOString()
    const saham  = String(body.saham).toUpperCase().trim()

    await prisma.$executeRawUnsafe(
      `INSERT INTO "portfolios" ("id","userId","keterangan","saham","hargaRata","lot","createdAt","updatedAt")
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
      id, userId,
      String(body.keterangan).toUpperCase().trim(),
      saham,
      Number(body.hargaRata),
      Number(body.lot),
      now, now
    )

    // Fetch harga saham baru dari Yahoo Finance — fire & store (tidak blocking response)
    let lastPrice: number | null = null
    let lastPriceAt: string | null = null
    try {
      const yf    = getYF()
      const quote = await yf.quote(`${saham}.JK`)
      const price = typeof quote?.regularMarketPrice === 'number' ? quote.regularMarketPrice : null
      if (price !== null) {
        lastPrice    = price
        lastPriceAt  = new Date().toISOString()
        await prisma.$executeRawUnsafe(
          `UPDATE "portfolios" SET "lastPrice"=$1,"lastPriceAt"=$2 WHERE "id"=$3`,
          lastPrice, lastPriceAt, id
        )
      }
    } catch { /* skip jika Yahoo Finance gagal */ }

    return NextResponse.json({ id, lastPrice, lastPriceAt }, { status: 201 })
  } catch (error) {
    console.error('POST portfolio error:', error)
    return NextResponse.json({ error: String(error) }, { status: 400 })
  }
}
