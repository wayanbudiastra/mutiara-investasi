export const dynamic = 'force-dynamic'
import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

const ADMIN_IDS = (process.env.ADMIN_USER_IDS ?? '')
  .split(',').map(s => s.trim()).filter(Boolean)

export async function GET() {
  try {
    const session = await getServerSession(authOptions)
    const userId = (session?.user as any)?.id
    if (!userId || !ADMIN_IDS.includes(userId)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    // Semua user + subscription aktif + total pembayaran
    const users = await prisma.$queryRawUnsafe<{
      id: string
      name: string | null
      email: string
      createdAt: Date
      plan: string | null
      subStatus: string | null
      startedAt: string | null
      expiredAt: string | null
      totalPaid: number
      paymentCount: number
    }[]>(`
      SELECT
        u."id",
        u."name",
        u."email",
        u."createdAt",
        s."plan",
        s."status"       AS "subStatus",
        s."startedAt",
        s."expiredAt",
        COALESCE(p."totalPaid", 0)    AS "totalPaid",
        COALESCE(p."paymentCount", 0) AS "paymentCount"
      FROM "users" u
      LEFT JOIN LATERAL (
        SELECT "plan", "status", "startedAt", "expiredAt"
        FROM "subscriptions"
        WHERE "userId" = u."id"
          AND "status" = 'ACTIVE'
          AND "expiredAt" > NOW()::TEXT
        ORDER BY "expiredAt" DESC
        LIMIT 1
      ) s ON true
      LEFT JOIN LATERAL (
        SELECT
          SUM("amount") AS "totalPaid",
          COUNT(*)      AS "paymentCount"
        FROM "payments"
        WHERE "userId" = u."id" AND "status" = 'PAID'
      ) p ON true
      ORDER BY u."createdAt" DESC
    `)

    return NextResponse.json(users)
  } catch (error) {
    console.error('admin/users error:', error)
    return NextResponse.json({ error: String(error) }, { status: 500 })
  }
}
