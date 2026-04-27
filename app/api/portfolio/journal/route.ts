export const dynamic = 'force-dynamic'
import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { randomUUID } from 'crypto'

async function ensureTable() {
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "portfolio_journals" (
      "id"              TEXT NOT NULL PRIMARY KEY,
      "userId"          TEXT NOT NULL,
      "journalDate"     TEXT NOT NULL,
      "totalModal"      DOUBLE PRECISION NOT NULL,
      "totalNilaiPasar" DOUBLE PRECISION NOT NULL,
      "totalFloatRp"    DOUBLE PRECISION NOT NULL,
      "totalFloatPct"   DOUBLE PRECISION NOT NULL,
      "detail"          TEXT NOT NULL,
      "createdAt"       TEXT NOT NULL,
      UNIQUE("userId", "journalDate")
    )
  `)
}

// Tanggal WIB (UTC+7)
function todayWIB() {
  return new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Jakarta' })
}

// GET — ambil jurnal user (default YTD)
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    const userId = (session?.user as any)?.id
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    await ensureTable()

    const { searchParams } = new URL(request.url)
    const year = searchParams.get('year') ?? new Date().getFullYear().toString()

    const rows = await prisma.$queryRawUnsafe<{
      id: string
      journalDate: string
      totalModal: number
      totalNilaiPasar: number
      totalFloatRp: number
      totalFloatPct: number
      detail: string
      createdAt: string
    }[]>(
      `SELECT * FROM "portfolio_journals"
       WHERE "userId" = $1
         AND "journalDate" LIKE $2
       ORDER BY "journalDate" ASC`,
      userId, `${year}-%`
    )

    return NextResponse.json(rows)
  } catch (error) {
    console.error('GET journal error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// POST — buat jurnal baru (1x per hari)
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    const userId = (session?.user as any)?.id
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    await ensureTable()

    const body = await request.json()
    const { totalModal, totalNilaiPasar, totalFloatRp, totalFloatPct, detail } = body

    const journalDate = todayWIB()

    // Cek apakah jurnal hari ini sudah ada
    const existing = await prisma.$queryRawUnsafe<{ id: string }[]>(
      `SELECT "id" FROM "portfolio_journals" WHERE "userId" = $1 AND "journalDate" = $2 LIMIT 1`,
      userId, journalDate
    )
    if (existing.length > 0) {
      return NextResponse.json(
        { error: 'Jurnal hari ini sudah dibuat', journalDate },
        { status: 409 }
      )
    }

    const id  = randomUUID()
    const now = new Date().toISOString()

    await prisma.$executeRawUnsafe(
      `INSERT INTO "portfolio_journals"
         ("id","userId","journalDate","totalModal","totalNilaiPasar","totalFloatRp","totalFloatPct","detail","createdAt")
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
      id, userId, journalDate,
      Number(totalModal), Number(totalNilaiPasar),
      Number(totalFloatRp), Number(totalFloatPct),
      JSON.stringify(detail),
      now
    )

    return NextResponse.json({ id, journalDate }, { status: 201 })
  } catch (error) {
    console.error('POST journal error:', error)
    return NextResponse.json({ error: String(error) }, { status: 500 })
  }
}
