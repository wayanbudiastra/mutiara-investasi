export const dynamic = 'force-dynamic'
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { verifyMidtransSignature } from '@/lib/midtrans'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()

    const {
      order_id,
      status_code,
      gross_amount,
      signature_key,
      transaction_status,
      fraud_status,
      payment_type,
      transaction_id,
    } = body

    // Log semua request masuk untuk debugging
    console.log('Webhook received:', JSON.stringify({
      order_id, status_code, gross_amount, transaction_status, fraud_status, payment_type
    }))

    // Validasi signature key
    const serverKey = process.env.MIDTRANS_SERVER_KEY ?? ''
    const isValid = verifyMidtransSignature(
      order_id, status_code, gross_amount, serverKey, signature_key
    )
    if (!isValid) {
      console.error('Webhook: signature tidak valid', {
        order_id,
        computed: require('crypto').createHash('sha512')
          .update(order_id + status_code + gross_amount + serverKey).digest('hex'),
        received: signature_key,
      })
      return NextResponse.json({ error: 'Invalid signature' }, { status: 403 })
    }

    // Cari payment berdasarkan orderId
    const payments = await prisma.$queryRawUnsafe<{
      id: string; userId: string; subscriptionId: string; amount: number
    }[]>(
      `SELECT * FROM "payments" WHERE "orderId" = $1 LIMIT 1`,
      order_id
    )
    if (!payments.length) {
      return NextResponse.json({ error: 'Order tidak ditemukan' }, { status: 404 })
    }
    const payment = payments[0]
    const now = new Date().toISOString()

    // Tentukan status berdasarkan respons Midtrans
    const isSuccess =
      (transaction_status === 'settlement') ||
      (transaction_status === 'capture' && fraud_status === 'accept')
    const isFailed =
      transaction_status === 'cancel' ||
      transaction_status === 'deny' ||
      transaction_status === 'expire'

    if (isSuccess) {
      // Update payment → PAID
      await prisma.$executeRawUnsafe(
        `UPDATE "payments" SET "status"='PAID', "midtransTxId"=$1, "updatedAt"=$2 WHERE "orderId"=$3`,
        transaction_id, now, order_id
      )

      // Ambil data subscription untuk hitung tanggal
      const subs = await prisma.$queryRawUnsafe<{
        plan: string; expiredAt: string
      }[]>(
        `SELECT * FROM "subscriptions" WHERE "id" = $1 LIMIT 1`,
        payment.subscriptionId
      )

      if (subs.length) {
        const startedAt = now
        const expiredAt = subs[0].expiredAt

        // Aktifkan subscription
        await prisma.$executeRawUnsafe(
          `UPDATE "subscriptions" SET "status"='ACTIVE', "startedAt"=$1, "expiredAt"=$2, "updatedAt"=$3 WHERE "id"=$4`,
          startedAt, expiredAt, now, payment.subscriptionId
        )

        // Expire semua subscription ACTIVE lain milik user yang lebih lama
        await prisma.$executeRawUnsafe(
          `UPDATE "subscriptions" SET "status"='EXPIRED', "updatedAt"=$1
           WHERE "userId"=$2 AND "id"!=$3 AND "status"='ACTIVE' AND "expiredAt" < $4`,
          now, payment.userId, payment.subscriptionId, expiredAt
        )
      }

      console.log(`Webhook: pembayaran sukses — ${order_id}, userId: ${payment.userId}`)
    } else if (isFailed) {
      // Update payment → FAILED
      await prisma.$executeRawUnsafe(
        `UPDATE "payments" SET "status"='FAILED', "midtransTxId"=$1, "updatedAt"=$2 WHERE "orderId"=$3`,
        transaction_id ?? '', now, order_id
      )
      await prisma.$executeRawUnsafe(
        `UPDATE "subscriptions" SET "status"='EXPIRED', "updatedAt"=$1 WHERE "id"=$2`,
        now, payment.subscriptionId
      )
      console.log(`Webhook: pembayaran gagal — ${order_id}`)
    }
    // status 'pending' tidak perlu action

    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error('Webhook error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
