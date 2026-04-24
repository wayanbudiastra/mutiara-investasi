export const dynamic = 'force-dynamic'
import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions)
    const userId = (session?.user as any)?.id
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = await params

    const rows = await prisma.$queryRawUnsafe(
      `SELECT * FROM "calculations" WHERE "id" = $1 AND "userId" = $2`,
      id, userId
    ) as unknown[]

    if (!rows.length) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 })
    }

    return NextResponse.json(rows[0])
  } catch (error) {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions)
    const userId = (session?.user as any)?.id
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = await params

    const existing = await prisma.$queryRawUnsafe(
      `SELECT "id" FROM "calculations" WHERE "id" = $1 AND "userId" = $2`,
      id, userId
    ) as unknown[]

    if (!existing.length) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 })
    }

    await prisma.$executeRawUnsafe(
      `DELETE FROM "calculations" WHERE "id" = $1 AND "userId" = $2`,
      id, userId
    )

    return NextResponse.json({ message: 'Deleted' })
  } catch (error) {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
