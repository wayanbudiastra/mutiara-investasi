export const dynamic = 'force-dynamic'
import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function GET() {
  try {
    const session = await getServerSession(authOptions)
    const userId = (session?.user as any)?.id
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const rows = await prisma.$queryRawUnsafe<{
      orderId: string
      amount: number
      status: string
      midtransTxId: string | null
      createdAt: string
      plan: string
      expiredAt: string
    }[]>(
      `SELECT p."orderId", p."amount", p."status", p."midtransTxId", p."createdAt",
              s."plan", s."expiredAt"
       FROM "payments" p
       LEFT JOIN "subscriptions" s ON s."id" = p."subscriptionId"
       WHERE p."userId" = $1
       ORDER BY p."createdAt" DESC
       LIMIT 50`,
      userId
    )

    return NextResponse.json(rows)
  } catch (error) {
    console.error('payment/history error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
