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

    const now = new Date().toISOString()

    // Semua user + subscription aktif + total pembayaran
    // isGranted dideteksi dari plan = 'GRANTED' (tidak butuh kolom isGranted di DB)
    const users = await prisma.$queryRawUnsafe<{
      id: string
      name: string | null
      email: string
      createdAt: Date
      subscriptionId: string | null
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
        s."id"     AS "subscriptionId",
        s."plan",
        s."status" AS "subStatus",
        s."startedAt",
        s."expiredAt",
        COALESCE(p."totalPaid", 0)    AS "totalPaid",
        COALESCE(p."paymentCount", 0) AS "paymentCount"
      FROM "users" u
      LEFT JOIN LATERAL (
        SELECT "id", "plan", "status", "startedAt", "expiredAt"
        FROM "subscriptions"
        WHERE "userId" = u."id"
          AND "status" = 'ACTIVE'
          AND "expiredAt" > $1
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
    `, now)

    // Derive isGranted dan grantNote dari kolom yang sudah ada
    // isGranted = true jika plan = 'GRANTED'
    // grantNote diambil terpisah jika kolom sudah ada (opsional)
    const result = users.map(u => ({
      ...u,
      isGranted: u.plan === 'GRANTED',
      grantNote: null as string | null,
    }))

    // Coba ambil grantNote jika kolom sudah ada (tidak error jika belum ada)
    if (result.some(u => u.isGranted)) {
      try {
        const grantedIds = result
          .filter(u => u.isGranted && u.subscriptionId)
          .map(u => u.subscriptionId!)

        if (grantedIds.length > 0) {
          const notes = await prisma.$queryRawUnsafe<{ id: string; grantNote: string | null }[]>(
            `SELECT "id", "grantNote" FROM "subscriptions" WHERE "id" = ANY($1::text[])`,
            grantedIds
          )
          const noteMap = Object.fromEntries(notes.map(n => [n.id, n.grantNote]))
          result.forEach(u => {
            if (u.subscriptionId && noteMap[u.subscriptionId] !== undefined) {
              u.grantNote = noteMap[u.subscriptionId]
            }
          })
        }
      } catch {
        // grantNote kolom belum ada — skip, tidak error
      }
    }

    return NextResponse.json(result)
  } catch (error) {
    console.error('admin/users error:', error)
    return NextResponse.json({ error: String(error) }, { status: 500 })
  }
}
