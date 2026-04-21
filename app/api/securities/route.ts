import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { randomUUID } from 'crypto'

async function ensureTable() {
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "securities" (
      "id" TEXT NOT NULL PRIMARY KEY,
      "userId" TEXT NOT NULL,
      "nama" TEXT NOT NULL,
      "kode" TEXT NOT NULL,
      "status" TEXT NOT NULL DEFAULT 'ACTIVE'
    )
  `)
}

export async function GET(request: NextRequest) {
  try {
    const url = new URL(request.url)
    const userId = url.searchParams.get('userId')
    if (!userId) return NextResponse.json({ error: 'Missing userId' }, { status: 400 })

    const page   = Math.max(1, parseInt(url.searchParams.get('page')  || '1'))
    const limit  = Math.max(1, Math.min(100, parseInt(url.searchParams.get('limit') || '10')))
    const search = url.searchParams.get('search')?.trim() ?? ''
    const offset = (page - 1) * limit

    await ensureTable()

    const whereClause = search
      ? `WHERE "userId" = $1 AND ("nama" ILIKE $2 OR "kode" ILIKE $2)`
      : `WHERE "userId" = $1`
    const baseParams: unknown[] = search ? [userId, `%${search}%`] : [userId]

    const countResult = await prisma.$queryRawUnsafe(
      `SELECT COUNT(*) as count FROM "securities" ${whereClause}`,
      ...baseParams
    ) as { count: bigint | number }[]

    const total = parseInt(String(countResult[0]?.count ?? 0))

    const limitParam  = baseParams.length + 1
    const offsetParam = baseParams.length + 2

    const rows = await prisma.$queryRawUnsafe(
      `SELECT * FROM "securities" ${whereClause} ORDER BY "nama" ASC LIMIT $${limitParam} OFFSET $${offsetParam}`,
      ...baseParams, limit, offset
    )

    return NextResponse.json({
      securities: rows,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    })
  } catch (error) {
    console.error('GET securities error:', error)
    return NextResponse.json({ error: String(error) }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const { userId, nama, kode, status } = await request.json()
    if (!userId || !nama || !kode) return NextResponse.json({ error: 'Missing fields' }, { status: 400 })

    await ensureTable()
    const id = randomUUID()
    const s = status ?? 'ACTIVE'
    await prisma.$executeRawUnsafe(
      `INSERT INTO "securities" ("id","userId","nama","kode","status") VALUES ($1,$2,$3,$4,$5)`,
      id, userId, nama, kode, s
    )
    return NextResponse.json({ id, userId, nama, kode, status: s })
  } catch (error) {
    console.error('POST securities error:', error)
    return NextResponse.json({ error: String(error) }, { status: 500 })
  }
}

export async function PUT(request: NextRequest) {
  try {
    const { id, userId, nama, kode, status } = await request.json()
    if (!id || !userId) return NextResponse.json({ error: 'Missing id or userId' }, { status: 400 })

    await ensureTable()
    await prisma.$executeRawUnsafe(
      `UPDATE "securities" SET "nama" = $1, "kode" = $2, "status" = $3 WHERE "id" = $4 AND "userId" = $5`,
      nama, kode, status, id, userId
    )
    return NextResponse.json({ id, userId, nama, kode, status })
  } catch (error) {
    console.error('PUT securities error:', error)
    return NextResponse.json({ error: String(error) }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const url = new URL(request.url)
    const id = url.searchParams.get('id')
    const userId = url.searchParams.get('userId')
    if (!id || !userId) return NextResponse.json({ error: 'Missing id or userId' }, { status: 400 })

    await ensureTable()
    await prisma.$executeRawUnsafe(
      `DELETE FROM "securities" WHERE "id" = $1 AND "userId" = $2`,
      id, userId
    )
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('DELETE securities error:', error)
    return NextResponse.json({ error: String(error) }, { status: 500 })
  }
}
