export const dynamic = 'force-dynamic'
import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { checkProAccess, PLANS, type PlanId } from '@/lib/subscription'
import { randomUUID } from 'crypto'

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    const userId = (session?.user as any)?.id
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { planId } = await request.json() as { planId: PlanId }
    const plan = PLANS.find(p => p.id === planId)
    if (!plan) return NextResponse.json({ error: 'Paket tidak valid' }, { status: 400 })

    // Hitung expiredAt — perpanjang dari expiredAt lama jika masih aktif
    const current = await checkProAccess(userId)
    const baseDate = (current.hasAccess && !current.isAdmin && current.expiredAt)
      ? new Date(current.expiredAt)
      : new Date()
    const expiredAt = new Date(baseDate)
    expiredAt.setMonth(expiredAt.getMonth() + plan.months)

    const subId   = randomUUID()
    const payId   = randomUUID()
    const orderId = `INV-${userId.slice(0, 8)}-${Date.now()}`
    const now     = new Date().toISOString()

    // Buat subscription dengan status PENDING (akan diaktifkan setelah pembayaran)
    await prisma.$executeRawUnsafe(
      `INSERT INTO "subscriptions" ("id","userId","plan","status","startedAt","expiredAt","createdAt","updatedAt")
       VALUES ($1,$2,$3,'PENDING',$4,$5,$6,$7)`,
      subId, userId, planId, now, expiredAt.toISOString(), now, now
    )

    await prisma.$executeRawUnsafe(
      `INSERT INTO "payments" ("id","userId","subscriptionId","orderId","amount","status","createdAt","updatedAt")
       VALUES ($1,$2,$3,$4,$5,'PENDING',$6,$7)`,
      payId, userId, subId, orderId, plan.price, now, now
    )

    // TODO: Midtrans Snap token akan ditambahkan di sini setelah integrasi
    return NextResponse.json({
      orderId,
      amount: plan.price,
      plan: plan.label,
      expiredAt: expiredAt.toISOString(),
      snapToken: null, // akan diisi setelah Midtrans terhubung
    }, { status: 201 })
  } catch (error) {
    console.error('subscription/create error:', error)
    return NextResponse.json({ error: String(error) }, { status: 500 })
  }
}
