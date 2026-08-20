export const dynamic = 'force-dynamic'
import { NextRequest, NextResponse } from 'next/server'
import { randomUUID } from 'crypto'
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

// GET — daftar rencana milik user, terbaru dulu
export async function GET() {
  try {
    const session = await getServerSession(authOptions)
    const userId = (session?.user as any)?.id
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const pro = await checkProAccess(userId)
    if (!pro.hasAccess) return NextResponse.json({ error: 'Pro access required' }, { status: 403 })

    await ensureTable()

    const rows = await prisma.$queryRawUnsafe(
      `SELECT * FROM "avg_down_plans" WHERE "userId" = $1 ORDER BY "updatedAt" DESC`,
      userId,
    )
    return NextResponse.json(rows)
  } catch (error) {
    console.error('GET avg-down/plans error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// POST — simpan rencana baru
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    const userId = (session?.user as any)?.id
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const pro = await checkProAccess(userId)
    if (!pro.hasAccess) return NextResponse.json({ error: 'Pro access required' }, { status: 403 })

    await ensureTable()

    const body = await request.json()
    if (!validatePayload(body)) {
      return NextResponse.json({ error: 'Data rencana tidak lengkap/valid' }, { status: 400 })
    }

    const id = randomUUID()
    const now = new Date().toISOString()

    await prisma.$executeRawUnsafe(
      `INSERT INTO "avg_down_plans"
         ("id","userId","namaRencana","kode","currentPrice","capital","timeframe","allocationMethod",
          "manualOverride","stages","intervalPct","initialAvgPrice","initialLot","createdAt","updatedAt")
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$14)`,
      id, userId, body.namaRencana.trim(), body.kode.trim().toUpperCase(),
      body.currentPrice, body.capital, body.timeframe, body.allocationMethod,
      body.manualOverride, body.stages, body.intervalPct,
      body.initialAvgPrice ?? null, body.initialLot ?? 0, now,
    )

    return NextResponse.json({ id }, { status: 201 })
  } catch (error) {
    console.error('POST avg-down/plans error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
