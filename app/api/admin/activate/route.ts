export const dynamic = 'force-dynamic'
import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

const ADMIN_IDS = (process.env.ADMIN_USER_IDS ?? '')
  .split(',').map(s => s.trim()).filter(Boolean)

// GET — list semua payment PENDING milik semua user
export async function GET() {
  try {
    const session = await getServerSession(authOptions)
    const userId = (session?.user as any)?.id
    if (!userId || !ADMIN_IDS.includes(userId)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const rows = await prisma.$queryRawUnsafe(`
      SELECT p."id", p."orderId", p."amount", p."status", p."createdAt",
             p."userId", p."subscriptionId",
             s."plan", s."expiredAt", s."status" as "subStatus",
             u."email", u."name"
      FROM "payments" p
      LEFT JOIN "subscriptions" s ON s."id" = p."subscriptionId"
      LEFT JOIN "users" u ON u."id" = p."userId"
      WHERE p."status" = 'PENDING'
      ORDER BY p."createdAt" DESC
    `)
    return NextResponse.json(rows)
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 })
  }
}

// POST — aktivasi manual subscription berdasarkan orderId
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    const userId = (session?.user as any)?.id
    if (!userId || !ADMIN_IDS.includes(userId)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const { orderId } = await request.json()
    if (!orderId) return NextResponse.json({ error: 'orderId wajib diisi' }, { status: 400 })

    const payments = await prisma.$queryRawUnsafe<{
      id: string; userId: string; subscriptionId: string; amount: number; status: string
    }[]>(
      `SELECT * FROM "payments" WHERE "orderId" = $1 LIMIT 1`, orderId
    )

    if (!payments.length) {
      return NextResponse.json({ error: `Order ${orderId} tidak ditemukan` }, { status: 404 })
    }

    const payment = payments[0]
    if (payment.status === 'PAID') {
      return NextResponse.json({ error: 'Order ini sudah berstatus PAID' }, { status: 400 })
    }

    const now = new Date().toISOString()

    // Update payment → PAID
    await prisma.$executeRawUnsafe(
      `UPDATE "payments" SET "status"='PAID', "midtransTxId"='MANUAL-ADMIN', "updatedAt"=$1 WHERE "orderId"=$2`,
      now, orderId
    )

    // Ambil subscription
    const subs = await prisma.$queryRawUnsafe<{ expiredAt: string }[]>(
      `SELECT * FROM "subscriptions" WHERE "id" = $1 LIMIT 1`, payment.subscriptionId
    )

    if (subs.length) {
      const expiredAt = subs[0].expiredAt
      // Aktifkan subscription
      await prisma.$executeRawUnsafe(
        `UPDATE "subscriptions" SET "status"='ACTIVE', "startedAt"=$1, "expiredAt"=$2, "updatedAt"=$3 WHERE "id"=$4`,
        now, expiredAt, now, payment.subscriptionId
      )
      // Expire subscription lama
      await prisma.$executeRawUnsafe(
        `UPDATE "subscriptions" SET "status"='EXPIRED', "updatedAt"=$1
         WHERE "userId"=$2 AND "id"!=$3 AND "status"='ACTIVE' AND "expiredAt" < $4`,
        now, payment.userId, payment.subscriptionId, expiredAt
      )
    }

    return NextResponse.json({
      ok: true,
      message: `Order ${orderId} berhasil diaktifkan`,
      expiredAt: subs[0]?.expiredAt,
    })
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 })
  }
}
