export const dynamic = 'force-dynamic'
import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { advancedCalculationSchema } from '@/lib/validators'
import { randomUUID } from 'crypto'

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    const userId = (session?.user as any)?.id
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const page = Math.max(1, parseInt(searchParams.get('page') || '1'))
    const limit = Math.max(1, Math.min(100, parseInt(searchParams.get('limit') || '10')))
    const search = searchParams.get('search')?.toUpperCase() || ''
    const offset = (page - 1) * limit

    const whereClause = search
      ? `WHERE "userId" = $1 AND "stockSymbol" LIKE $2`
      : `WHERE "userId" = $1`
    const baseParams: unknown[] = search ? [userId, `%${search}%`] : [userId]

    const countResult = await prisma.$queryRawUnsafe(
      `SELECT COUNT(*) as count FROM "calculations" ${whereClause}`,
      ...baseParams
    ) as { count: bigint | number }[]

    const total = parseInt(String(countResult[0]?.count ?? 0))

    const limitParam = baseParams.length + 1
    const offsetParam = baseParams.length + 2

    const calculations = await prisma.$queryRawUnsafe(
      `SELECT * FROM "calculations" ${whereClause} ORDER BY "createdAt" DESC LIMIT $${limitParam} OFFSET $${offsetParam}`,
      ...baseParams, limit, offset
    )

    return NextResponse.json({
      calculations,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    })
  } catch (error) {
    console.error('GET calculations error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    const userId = (session?.user as any)?.id
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const input = advancedCalculationSchema.parse(body)

    const id = randomUUID()
    const now = new Date()

    await prisma.$executeRawUnsafe(
      `INSERT INTO "calculations" (
        "id", "userId", "stockSymbol", "quantity",
        "buyPricePerShare", "buyPrice",
        "sellPricePerShare", "sellPrice",
        "feeBuyPercentage", "feeSellPercentage",
        "targetProfitPercentage", "cutLossPercentage",
        "modal", "feeBuyAmount",
        "profitNetto", "returnPercentage",
        "createdAt"
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17)`,
      id,
      userId,
      input.stockSymbol,
      input.quantity,
      input.buyPricePerShare,
      input.buyPricePerShare * input.quantity,
      input.sellPricePerShare ?? null,
      input.sellPricePerShare ?? null,
      input.feeBuyPercentage,
      input.feeSellPercentage,
      input.targetProfitPercentage ?? null,
      input.cutLossPercentage ?? null,
      input.modal,
      input.feeBuyAmount,
      input.profitNetto ?? null,
      input.returnPercentage ?? null,
      now
    )

    return NextResponse.json({ id, createdAt: now.toISOString() }, { status: 201 })
  } catch (error: any) {
    console.error('POST calculations error:', error)
    if (error?.message?.includes('FOREIGN KEY') || error?.message?.includes('foreign key')) {
      return NextResponse.json(
        { error: 'Sesi tidak valid. Silakan logout dan login kembali.' },
        { status: 401 }
      )
    }
    return NextResponse.json({ error: String(error) }, { status: 400 })
  }
}
