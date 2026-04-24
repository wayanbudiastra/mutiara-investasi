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
}

export async function GET() {
  try {
    const session = await getServerSession(authOptions)
    const userId = (session?.user as any)?.id
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    await ensureTable()

    const rows = await prisma.$queryRawUnsafe(
      `SELECT * FROM "portfolios" WHERE "userId" = $1 ORDER BY "keterangan" ASC, "saham" ASC`,
      userId
    )
    return NextResponse.json(rows)
  } catch (error) {
    console.error('GET portfolio error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    const userId = (session?.user as any)?.id
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    await ensureTable()

    const body = await request.json()
    const id  = randomUUID()
    const now = new Date().toISOString()

    await prisma.$executeRawUnsafe(
      `INSERT INTO "portfolios" ("id","userId","keterangan","saham","hargaRata","lot","createdAt","updatedAt")
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
      id, userId,
      String(body.keterangan).toUpperCase().trim(),
      String(body.saham).toUpperCase().trim(),
      Number(body.hargaRata),
      Number(body.lot),
      now, now
    )
    return NextResponse.json({ id }, { status: 201 })
  } catch (error) {
    console.error('POST portfolio error:', error)
    return NextResponse.json({ error: String(error) }, { status: 400 })
  }
}
