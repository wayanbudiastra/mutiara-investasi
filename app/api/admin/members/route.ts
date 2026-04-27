export const dynamic = 'force-dynamic'
import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { randomUUID } from 'crypto'

const ADMIN_IDS = (process.env.ADMIN_USER_IDS ?? '')
  .split(',').map(s => s.trim()).filter(Boolean)

function isAdmin(userId: string) { return ADMIN_IDS.includes(userId) }

// POST — grant akses ke user
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    const adminId = (session?.user as any)?.id
    if (!adminId || !isAdmin(adminId)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const { targetUserId, durationDays, note } = await request.json()
    if (!targetUserId || !durationDays || durationDays < 1) {
      return NextResponse.json({ error: 'targetUserId dan durationDays wajib diisi' }, { status: 400 })
    }

    const now       = new Date()
    const expiredAt = new Date(now)
    expiredAt.setDate(expiredAt.getDate() + Number(durationDays))
    const nowISO = now.toISOString()

    // Expire semua granted subscription aktif sebelumnya milik user ini
    await prisma.$executeRawUnsafe(
      `UPDATE "subscriptions" SET "status"='EXPIRED', "updatedAt"=$1
       WHERE "userId"=$2 AND "isGranted"=true AND "status"='ACTIVE'`,
      nowISO, targetUserId
    )

    // Buat subscription GRANTED baru
    await prisma.$executeRawUnsafe(
      `INSERT INTO "subscriptions"
         ("id","userId","plan","status","startedAt","expiredAt","grantedBy","grantNote","isGranted","createdAt","updatedAt")
       VALUES ($1,$2,'GRANTED','ACTIVE',$3,$4,$5,$6,true,$7,$8)`,
      randomUUID(), targetUserId,
      nowISO, expiredAt.toISOString(),
      adminId, note ?? null,
      nowISO, nowISO
    )

    return NextResponse.json({ ok: true, expiredAt: expiredAt.toISOString() })
  } catch (error) {
    console.error('grant error:', error)
    return NextResponse.json({ error: String(error) }, { status: 500 })
  }
}

// PUT — revoke atau extend (action dalam body)
export async function PUT(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    const adminId = (session?.user as any)?.id
    if (!adminId || !isAdmin(adminId)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const { action, subscriptionId, additionalDays } = await request.json()
    const now = new Date().toISOString()

    if (action === 'revoke') {
      await prisma.$executeRawUnsafe(
        `UPDATE "subscriptions" SET "status"='EXPIRED', "updatedAt"=$1 WHERE "id"=$2 AND "isGranted"=true`,
        now, subscriptionId
      )
      return NextResponse.json({ ok: true })
    }

    if (action === 'extend') {
      if (!additionalDays || additionalDays < 1) {
        return NextResponse.json({ error: 'additionalDays wajib diisi' }, { status: 400 })
      }
      // Perpanjang dari expiredAt saat ini
      const subs = await prisma.$queryRawUnsafe<{ expiredAt: string }[]>(
        `SELECT "expiredAt" FROM "subscriptions" WHERE "id"=$1 LIMIT 1`, subscriptionId
      )
      if (!subs.length) return NextResponse.json({ error: 'Subscription tidak ditemukan' }, { status: 404 })

      const base = new Date(subs[0].expiredAt)
      if (base < new Date()) base.setTime(Date.now()) // jika sudah expired, mulai dari sekarang
      base.setDate(base.getDate() + Number(additionalDays))

      await prisma.$executeRawUnsafe(
        `UPDATE "subscriptions" SET "status"='ACTIVE', "expiredAt"=$1, "updatedAt"=$2 WHERE "id"=$3`,
        base.toISOString(), now, subscriptionId
      )
      return NextResponse.json({ ok: true, expiredAt: base.toISOString() })
    }

    return NextResponse.json({ error: 'action tidak valid' }, { status: 400 })
  } catch (error) {
    console.error('members PUT error:', error)
    return NextResponse.json({ error: String(error) }, { status: 500 })
  }
}
