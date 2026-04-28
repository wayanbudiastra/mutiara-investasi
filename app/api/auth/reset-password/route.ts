export const dynamic = 'force-dynamic'
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { createHash } from 'crypto'
import { hashPassword } from '@/lib/password'

function hashToken(raw: string) {
  return createHash('sha256').update(raw).digest('hex')
}

async function findValidToken(raw: string) {
  const hash = hashToken(raw)
  const now  = new Date().toISOString()
  const rows = await prisma.$queryRawUnsafe<{ id: string; userId: string }[]>(
    `SELECT "id","userId" FROM "password_reset_tokens"
     WHERE "token"=$1 AND "usedAt" IS NULL AND "expiredAt" > $2 LIMIT 1`,
    hash, now
  )
  return rows[0] ?? null
}

// GET — validasi token sebelum tampil form
export async function GET(request: NextRequest) {
  const token = new URL(request.url).searchParams.get('token') ?? ''
  if (!token) return NextResponse.json({ valid: false, reason: 'invalid' })

  const row = await findValidToken(token)
  if (!row) return NextResponse.json({ valid: false, reason: 'expired' })

  return NextResponse.json({ valid: true })
}

// POST — proses reset password
export async function POST(request: NextRequest) {
  try {
    const { token, password, confirmPassword } = await request.json()

    if (!token) return NextResponse.json({ error: 'Token tidak valid' }, { status: 400 })
    if (!password || password.length < 8) {
      return NextResponse.json({ error: 'Password minimal 8 karakter' }, { status: 400 })
    }
    if (password !== confirmPassword) {
      return NextResponse.json({ error: 'Konfirmasi password tidak cocok' }, { status: 400 })
    }

    const row = await findValidToken(token)
    if (!row) {
      return NextResponse.json(
        { error: 'Token tidak valid atau sudah kedaluwarsa' }, { status: 400 }
      )
    }

    const hashed = await hashPassword(password)
    const now    = new Date().toISOString()

    // Update password user
    await prisma.user.update({
      where: { id: row.userId },
      data:  { password: hashed, updatedAt: new Date() },
    })

    // Invalidate token
    await prisma.$executeRawUnsafe(
      `UPDATE "password_reset_tokens" SET "usedAt"=$1 WHERE "id"=$2`,
      now, row.id
    )

    return NextResponse.json({ message: 'Password berhasil direset' })
  } catch (error) {
    console.error('reset-password error:', error)
    return NextResponse.json({ error: 'Terjadi kesalahan' }, { status: 500 })
  }
}
