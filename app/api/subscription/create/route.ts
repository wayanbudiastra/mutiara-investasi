export const dynamic = 'force-dynamic'
import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { checkProAccess, PLANS, type PlanId } from '@/lib/subscription'
import { getSnapClient } from '@/lib/midtrans'
import { randomUUID } from 'crypto'

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    const userId = (session?.user as any)?.id
    const userEmail = session?.user?.email ?? ''
    const userName  = session?.user?.name  ?? ''
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

    // Buat subscription PENDING
    await prisma.$executeRawUnsafe(
      `INSERT INTO "subscriptions" ("id","userId","plan","status","startedAt","expiredAt","createdAt","updatedAt")
       VALUES ($1,$2,$3,'PENDING',$4,$5,$6,$7)`,
      subId, userId, planId, now, expiredAt.toISOString(), now, now
    )

    // Request Snap token ke Midtrans
    const snap = getSnapClient()
    const transaction = await snap.createTransaction({
      transaction_details: {
        order_id: orderId,
        gross_amount: plan.price,
      },
      item_details: [{
        id: plan.id,
        price: plan.price,
        quantity: 1,
        name: `Mutiara Investasi Pro — ${plan.label}`,
      }],
      customer_details: {
        email: userEmail,
        first_name: userName,
      },
      callbacks: {
        finish: `${process.env.NEXTAUTH_URL}/subscription?status=finish`,
      },
    })

    const snapToken = transaction.token

    // Simpan payment dengan snap token
    await prisma.$executeRawUnsafe(
      `INSERT INTO "payments" ("id","userId","subscriptionId","orderId","amount","status","midtransToken","createdAt","updatedAt")
       VALUES ($1,$2,$3,$4,$5,'PENDING',$6,$7,$8)`,
      payId, userId, subId, orderId, plan.price, snapToken, now, now
    )

    return NextResponse.json({ snapToken, orderId, amount: plan.price, plan: plan.label }, { status: 201 })
  } catch (error) {
    console.error('subscription/create error:', error)
    return NextResponse.json({ error: String(error) }, { status: 500 })
  }
}
