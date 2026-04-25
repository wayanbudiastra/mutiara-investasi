export const dynamic = 'force-dynamic'
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { hashPassword } from '@/lib/password'
import { registerSchema } from '@/lib/validators'
import { ensureTables } from '@/lib/subscription'
import { randomUUID } from 'crypto'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { name, email, password } = registerSchema.parse(body)

    const existingUser = await prisma.user.findUnique({
      where: { email },
    })

    if (existingUser) {
      return NextResponse.json(
        { error: 'User already exists' },
        { status: 400 }
      )
    }

    const hashedPassword = await hashPassword(password)

    const user = await prisma.user.create({
      data: { name, email, password: hashedPassword },
    })

    // Beri Free Trial 30 hari otomatis untuk user baru
    const now       = new Date()
    const expiredAt = new Date(now)
    expiredAt.setDate(expiredAt.getDate() + 30)

    await ensureTables()
    await prisma.$executeRawUnsafe(
      `INSERT INTO "subscriptions" ("id","userId","plan","status","startedAt","expiredAt","createdAt","updatedAt")
       VALUES ($1,$2,'FREE_TRIAL','ACTIVE',$3,$4,$5,$6)`,
      randomUUID(), user.id,
      now.toISOString(), expiredAt.toISOString(),
      now.toISOString(), now.toISOString()
    )

    return NextResponse.json(
      { message: 'User created successfully', user: { id: user.id, email: user.email, name: user.name } },
      { status: 201 }
    )
  } catch (error) {
    return NextResponse.json(
      { error: 'Invalid input' },
      { status: 400 }
    )
  }
}