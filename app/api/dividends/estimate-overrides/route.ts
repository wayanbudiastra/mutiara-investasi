export const dynamic = 'force-dynamic'
import { NextRequest, NextResponse } from 'next/server'
import { randomUUID } from 'crypto'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

async function ensureTable() {
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "dividend_estimate_overrides" (
      "id"               TEXT NOT NULL PRIMARY KEY,
      "userId"           TEXT NOT NULL,
      "saham"            TEXT NOT NULL,
      "dividenPerLembar" DOUBLE PRECISION NOT NULL,
      "catatan"          TEXT,
      "createdAt"        TEXT NOT NULL,
      "updatedAt"        TEXT NOT NULL,
      UNIQUE ("userId", "saham")
    )
  `)
}

// GET — daftar override manual milik user untuk tab Estimasi Dividen
export async function GET() {
  try {
    const session = await getServerSession(authOptions)
    const userId = (session?.user as any)?.id
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    await ensureTable()

    const rows = await prisma.$queryRawUnsafe(
      `SELECT * FROM "dividend_estimate_overrides" WHERE "userId" = $1`,
      userId,
    )
    return NextResponse.json(rows, { headers: { 'Cache-Control': 'no-store, max-age=0' } })
  } catch (error) {
    console.error('GET dividends/estimate-overrides error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// PUT — simpan/ubah nilai dividen per lembar manual untuk satu saham (upsert per userId+saham).
// Dipakai saat user mengoreksi angka otomatis yang dianggap tidak akurat, atau mengisi estimasi
// untuk saham yang belum punya riwayat dividen DONE sama sekali.
export async function PUT(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    const userId = (session?.user as any)?.id
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    await ensureTable()

    const body = await request.json()
    const saham = String(body?.saham ?? '').trim().toUpperCase()
    const dividenPerLembar = Number(body?.dividenPerLembar)
    const catatan = body?.catatan ? String(body.catatan).trim().slice(0, 500) : null

    if (!saham) return NextResponse.json({ error: 'Parameter saham wajib diisi' }, { status: 400 })
    if (!Number.isFinite(dividenPerLembar) || dividenPerLembar < 0) {
      return NextResponse.json({ error: 'dividenPerLembar harus angka >= 0' }, { status: 400 })
    }

    const now = new Date().toISOString()
    await prisma.$executeRawUnsafe(
      `INSERT INTO "dividend_estimate_overrides" ("id","userId","saham","dividenPerLembar","catatan","createdAt","updatedAt")
       VALUES ($1, $2, $3, $4, $5, $6, $6)
       ON CONFLICT ("userId","saham") DO UPDATE SET
         "dividenPerLembar" = EXCLUDED."dividenPerLembar",
         "catatan"          = EXCLUDED."catatan",
         "updatedAt"        = EXCLUDED."updatedAt"`,
      randomUUID(), userId, saham, dividenPerLembar, catatan, now,
    )

    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error('PUT dividends/estimate-overrides error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// DELETE — hapus override, kembali ke nilai otomatis dari riwayat dividen (?saham=XXX)
export async function DELETE(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    const userId = (session?.user as any)?.id
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    await ensureTable()

    const saham = (new URL(request.url).searchParams.get('saham') ?? '').trim().toUpperCase()
    if (!saham) return NextResponse.json({ error: 'Parameter saham wajib diisi' }, { status: 400 })

    await prisma.$executeRawUnsafe(
      `DELETE FROM "dividend_estimate_overrides" WHERE "userId" = $1 AND "saham" = $2`,
      userId, saham,
    )
    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error('DELETE dividends/estimate-overrides error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
