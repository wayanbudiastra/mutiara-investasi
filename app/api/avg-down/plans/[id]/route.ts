export const dynamic = 'force-dynamic'
import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { checkProAccess } from '@/lib/subscription'

async function ensureTable() {
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "avg_down_plans" (
      "id"               TEXT NOT NULL PRIMARY KEY,
      "userId"           TEXT NOT NULL,
      "namaRencana"      TEXT NOT NULL,
      "kode"             TEXT NOT NULL,
      "currentPrice"     DOUBLE PRECISION NOT NULL,
      "capital"          DOUBLE PRECISION NOT NULL,
      "timeframe"        TEXT NOT NULL,
      "allocationMethod" TEXT NOT NULL,
      "manualOverride"   BOOLEAN NOT NULL DEFAULT false,
      "stages"           INTEGER NOT NULL,
      "intervalPct"      DOUBLE PRECISION NOT NULL,
      "initialAvgPrice"  DOUBLE PRECISION,
      "initialLot"       INTEGER NOT NULL DEFAULT 0,
      "createdAt"        TEXT NOT NULL,
      "updatedAt"        TEXT NOT NULL
    )
  `)
}

interface PlanPayload {
  namaRencana: string
  kode: string
  currentPrice: number
  capital: number
  timeframe: string
  allocationMethod: string
  manualOverride: boolean
  stages: number
  intervalPct: number
  initialAvgPrice: number | null
  initialLot: number
}

function validatePayload(body: any): body is PlanPayload {
  return (
    typeof body?.namaRencana === 'string' && body.namaRencana.trim().length > 0 &&
    typeof body?.kode === 'string' && body.kode.trim().length > 0 &&
    typeof body?.currentPrice === 'number' && body.currentPrice > 0 &&
    typeof body?.capital === 'number' && body.capital > 0 &&
    typeof body?.timeframe === 'string' &&
    typeof body?.allocationMethod === 'string' &&
    typeof body?.stages === 'number' &&
    typeof body?.intervalPct === 'number'
  )
}

// GET — ambil satu rencana (harus milik user)
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getServerSession(authOptions)
    const userId = (session?.user as any)?.id
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const pro = await checkProAccess(userId)
    if (!pro.hasAccess) return NextResponse.json({ error: 'Pro access required' }, { status: 403 })

    await ensureTable()

    const { id } = await params
    const rows = await prisma.$queryRawUnsafe<any[]>(
      `SELECT * FROM "avg_down_plans" WHERE "id" = $1 AND "userId" = $2 LIMIT 1`,
      id, userId,
    )
    if (rows.length === 0) return NextResponse.json({ error: 'Rencana tidak ditemukan' }, { status: 404 })

    return NextResponse.json(rows[0])
  } catch (error) {
    console.error('GET avg-down/plans/[id] error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// PUT — perbarui rencana yang sudah ada (harus milik user)
export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getServerSession(authOptions)
    const userId = (session?.user as any)?.id
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const pro = await checkProAccess(userId)
    if (!pro.hasAccess) return NextResponse.json({ error: 'Pro access required' }, { status: 403 })

    await ensureTable()

    const { id } = await params
    const body = await request.json()
    if (!validatePayload(body)) {
      return NextResponse.json({ error: 'Data rencana tidak lengkap/valid' }, { status: 400 })
    }

    const now = new Date().toISOString()
    const result = await prisma.$executeRawUnsafe(
      `UPDATE "avg_down_plans" SET
         "namaRencana" = $1, "kode" = $2, "currentPrice" = $3, "capital" = $4,
         "timeframe" = $5, "allocationMethod" = $6, "manualOverride" = $7,
         "stages" = $8, "intervalPct" = $9, "initialAvgPrice" = $10, "initialLot" = $11,
         "updatedAt" = $12
       WHERE "id" = $13 AND "userId" = $14`,
      body.namaRencana.trim(), body.kode.trim().toUpperCase(), body.currentPrice, body.capital,
      body.timeframe, body.allocationMethod, body.manualOverride,
      body.stages, body.intervalPct, body.initialAvgPrice ?? null, body.initialLot ?? 0,
      now, id, userId,
    )

    if (result === 0) return NextResponse.json({ error: 'Rencana tidak ditemukan' }, { status: 404 })
    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error('PUT avg-down/plans/[id] error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// DELETE — hapus rencana (harus milik user)
export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getServerSession(authOptions)
    const userId = (session?.user as any)?.id
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const pro = await checkProAccess(userId)
    if (!pro.hasAccess) return NextResponse.json({ error: 'Pro access required' }, { status: 403 })

    await ensureTable()

    const { id } = await params
    const result = await prisma.$executeRawUnsafe(
      `DELETE FROM "avg_down_plans" WHERE "id" = $1 AND "userId" = $2`,
      id, userId,
    )
    if (result === 0) return NextResponse.json({ error: 'Rencana tidak ditemukan' }, { status: 404 })
    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error('DELETE avg-down/plans/[id] error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
