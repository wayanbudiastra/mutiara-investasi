export const dynamic = 'force-dynamic'
import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { randomUUID } from 'crypto'

async function ensureTable() {
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "portfolio_cash" (
      "id"         TEXT NOT NULL PRIMARY KEY,
      "userId"     TEXT NOT NULL,
      "keterangan" TEXT NOT NULL,
      "saldo"      DOUBLE PRECISION NOT NULL,
      "catatan"    TEXT,
      "createdAt"  TEXT NOT NULL,
      "updatedAt"  TEXT NOT NULL,
      UNIQUE("userId", "keterangan")
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
      `SELECT * FROM "portfolio_cash" WHERE "userId" = $1 ORDER BY "keterangan" ASC`,
      userId
    )
    return NextResponse.json(rows)
  } catch (error) {
    console.error('GET portfolio/cash error:', error)
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
    const keterangan = String(body.keterangan).toUpperCase().trim()
    const saldo      = Number(body.saldo)
    const catatan    = body.catatan ? String(body.catatan).trim() : null

    if (!keterangan || isNaN(saldo) || saldo < 0) {
      return NextResponse.json({ error: 'Data tidak valid' }, { status: 400 })
    }

    // Cek duplikasi
    const existing = await prisma.$queryRawUnsafe<{ id: string }[]>(
      `SELECT "id" FROM "portfolio_cash" WHERE "userId"=$1 AND "keterangan"=$2 LIMIT 1`,
      userId, keterangan
    )
    if (existing.length > 0) {
      return NextResponse.json(
        { error: `Akun "${keterangan}" sudah memiliki catatan cash` },
        { status: 409 }
      )
    }

    const id  = randomUUID()
    const now = new Date().toISOString()

    await prisma.$executeRawUnsafe(
      `INSERT INTO "portfolio_cash" ("id","userId","keterangan","saldo","catatan","createdAt","updatedAt")
       VALUES ($1,$2,$3,$4,$5,$6,$7)`,
      id, userId, keterangan, saldo, catatan, now, now
    )
    return NextResponse.json({ id }, { status: 201 })
  } catch (error) {
    console.error('POST portfolio/cash error:', error)
    return NextResponse.json({ error: String(error) }, { status: 400 })
  }
}
