export const dynamic = 'force-dynamic'
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { sendResetPasswordEmail } from '@/lib/mail'
import { randomBytes, createHash } from 'crypto'
import { randomUUID } from 'crypto'

async function ensureTable() {
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "password_reset_tokens" (
      "id"        TEXT NOT NULL PRIMARY KEY,
      "userId"    TEXT NOT NULL,
      "token"     TEXT NOT NULL UNIQUE,
      "expiredAt" TEXT NOT NULL,
      "usedAt"    TEXT,
      "createdAt" TEXT NOT NULL
    )
  `)
}

export async function POST(request: NextRequest) {
  try {
    await ensureTable()

    const { email } = await request.json()
    if (!email) return NextResponse.json({ error: 'Email wajib diisi' }, { status: 400 })

    // Selalu return 200 — anti user enumeration
    const successMsg = { message: 'Jika email terdaftar, link reset akan dikirim.' }

    const users = await prisma.user.findUnique({ where: { email: email.toLowerCase().trim() } })
    if (!users) return NextResponse.json(successMsg)

    // Invalidate token lama yang belum dipakai
    const now = new Date().toISOString()
    await prisma.$executeRawUnsafe(
      `UPDATE "password_reset_tokens" SET "usedAt"=$1 WHERE "userId"=$2 AND "usedAt" IS NULL`,
      now, users.id
    )

    // Generate token baru
    const rawToken  = randomBytes(32).toString('hex')
    const hashToken = createHash('sha256').update(rawToken).digest('hex')
    const expiredAt = new Date(Date.now() + 60 * 60 * 1000).toISOString() // 1 jam

    await prisma.$executeRawUnsafe(
      `INSERT INTO "password_reset_tokens" ("id","userId","token","expiredAt","createdAt")
       VALUES ($1,$2,$3,$4,$5)`,
      randomUUID(), users.id, hashToken, expiredAt, now
    )

    const baseUrl  = process.env.NEXTAUTH_URL ?? 'http://localhost:3000'
    const resetUrl = `${baseUrl}/reset-password?token=${rawToken}`

    await sendResetPasswordEmail(users.email, users.name ?? '', resetUrl)

    return NextResponse.json(successMsg)
  } catch (error) {
    console.error('forgot-password error:', error)
    return NextResponse.json({ message: 'Jika email terdaftar, link reset akan dikirim.' })
  }
}
