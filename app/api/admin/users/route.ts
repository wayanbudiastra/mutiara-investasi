export const dynamic = 'force-dynamic'
import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { ensureTables } from '@/lib/subscription'

const ADMIN_IDS = (process.env.ADMIN_USER_IDS ?? '')
  .split(',').map(s => s.trim()).filter(Boolean)

export async function GET() {
  try {
    const session = await getServerSession(authOptions)
    const userId = (session?.user as any)?.id
    if (!userId || !ADMIN_IDS.includes(userId)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    // Pastikan tabel subscriptions & payments ada
    await ensureTables()

    const now = new Date().toISOString()

    // Step 1: Ambil semua user (query sederhana tanpa JOIN ke payments dulu)
    const users = await prisma.$queryRawUnsafe<{
      id: string
      name: string | null
      email: string
      createdAt: string
      subscriptionId: string | null
      plan: string | null
      subStatus: string | null
      expiredAt: string | null
    }[]>(`
      SELECT
        u."id",
        u."name",
        u."email",
        u."createdAt"::text AS "createdAt",
        s."id"              AS "subscriptionId",
        s."plan",
        s."status"          AS "subStatus",
        s."expiredAt"
      FROM "users" u
      LEFT JOIN LATERAL (
        SELECT "id", "plan", "status", "expiredAt"
        FROM "subscriptions"
        WHERE "userId" = u."id"
          AND "status" = 'ACTIVE'
          AND "expiredAt" > $1
        ORDER BY "expiredAt" DESC
        LIMIT 1
      ) s ON true
      ORDER BY u."createdAt" DESC
    `, now)

    // Step 2: Ambil data payment per user (terpisah, dengan fallback)
    const paymentMap: Record<string, { totalPaid: number; paymentCount: number }> = {}
    try {
      const payments = await prisma.$queryRawUnsafe<{
        userId: string; totalPaid: number; paymentCount: number
      }[]>(`
        SELECT "userId",
               SUM("amount")::integer AS "totalPaid",
               COUNT(*)::integer      AS "paymentCount"
        FROM "payments"
        WHERE "status" = 'PAID'
        GROUP BY "userId"
      `)
      payments.forEach(p => { paymentMap[p.userId] = { totalPaid: Number(p.totalPaid), paymentCount: Number(p.paymentCount) } })
    } catch {
      // tabel payments belum ada — skip, tampilkan 0
    }

    // Step 3: Coba ambil grantNote (opsional, kolom mungkin belum ada)
    const grantNoteMap: Record<string, string | null> = {}
    const grantedSubIds = users.filter(u => u.plan === 'GRANTED' && u.subscriptionId).map(u => u.subscriptionId!)
    if (grantedSubIds.length > 0) {
      try {
        const notes = await prisma.$queryRawUnsafe<{ id: string; grantNote: string | null }[]>(
          `SELECT "id", "grantNote" FROM "subscriptions" WHERE "id" = ANY($1::text[])`,
          grantedSubIds
        )
        notes.forEach(n => { grantNoteMap[n.id] = n.grantNote })
      } catch {
        // kolom grantNote belum ada — skip
      }
    }

    // Step 4: Gabungkan semua data
    const result = users.map(u => ({
      ...u,
      isGranted: u.plan === 'GRANTED',
      grantNote: u.subscriptionId ? (grantNoteMap[u.subscriptionId] ?? null) : null,
      totalPaid: paymentMap[u.id]?.totalPaid ?? 0,
      paymentCount: paymentMap[u.id]?.paymentCount ?? 0,
    }))

    return NextResponse.json(result)
  } catch (error) {
    console.error('admin/users error:', error)
    return NextResponse.json({ error: String(error) }, { status: 500 })
  }
}
