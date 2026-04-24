export const dynamic = 'force-dynamic'
import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { randomUUID } from 'crypto'

async function ensureTable() {
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "dividends" (
      "id" TEXT NOT NULL PRIMARY KEY,
      "userId" TEXT NOT NULL,
      "bulan" TEXT NOT NULL,
      "tahun" INTEGER NOT NULL,
      "saham" TEXT NOT NULL,
      "dividen" DOUBLE PRECISION NOT NULL,
      "lot" INTEGER NOT NULL,
      "total" DOUBLE PRECISION NOT NULL,
      "keterangan" TEXT NOT NULL,
      "status" TEXT NOT NULL DEFAULT 'ESTIMASI',
      "createdAt" TEXT NOT NULL,
      "updatedAt" TEXT NOT NULL
    )
  `)
}

export async function GET(_request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    const userId = (session?.user as any)?.id
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    await ensureTable()

    // ESTIMASI: semua data tanpa limit (supaya filter selalu lengkap)
    // DONE: maksimal 500 data terbaru (cukup untuk keperluan rekap)
    const rows = await prisma.$queryRawUnsafe(
      `SELECT * FROM "dividends" WHERE "userId" = $1 AND "status" = 'ESTIMASI'
       UNION ALL
       SELECT * FROM (
         SELECT * FROM "dividends" WHERE "userId" = $1 AND "status" = 'DONE'
         ORDER BY "tahun" DESC, "createdAt" DESC LIMIT 500
       ) done_rows
       ORDER BY "tahun" DESC, "createdAt" DESC`,
      userId
    )
    return NextResponse.json(rows)
  } catch (error) {
    console.error('GET dividends error:', error)
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
    const id = randomUUID()
    const now = new Date().toISOString()

    await prisma.$executeRawUnsafe(
      `INSERT INTO "dividends" ("id","userId","bulan","tahun","saham","dividen","lot","total","keterangan","status","createdAt","updatedAt")
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)`,
      id, userId,
      body.bulan, Number(body.tahun), body.saham,
      Number(body.dividen), Number(body.lot), Number(body.total),
      body.keterangan, body.status,
      now, now
    )
    return NextResponse.json({ id }, { status: 201 })
  } catch (error) {
    console.error('POST dividends error:', error)
    return NextResponse.json({ error: String(error) }, { status: 400 })
  }
}
