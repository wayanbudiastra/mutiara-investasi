export const dynamic = 'force-dynamic'
import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getServerSession(authOptions)
    const userId = (session?.user as any)?.id
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { id } = await params
    const body   = await request.json()
    const saldo  = Number(body.saldo)
    const catatan = body.catatan ? String(body.catatan).trim() : null
    const now    = new Date().toISOString()

    if (isNaN(saldo) || saldo < 0) {
      return NextResponse.json({ error: 'Saldo tidak valid' }, { status: 400 })
    }

    await prisma.$executeRawUnsafe(
      `UPDATE "portfolio_cash" SET "saldo"=$1, "catatan"=$2, "updatedAt"=$3
       WHERE "id"=$4 AND "userId"=$5`,
      saldo, catatan, now, id, userId
    )
    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error('PUT portfolio/cash error:', error)
    return NextResponse.json({ error: String(error) }, { status: 400 })
  }
}

export async function DELETE(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getServerSession(authOptions)
    const userId = (session?.user as any)?.id
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { id } = await params

    await prisma.$executeRawUnsafe(
      `DELETE FROM "portfolio_cash" WHERE "id"=$1 AND "userId"=$2`,
      id, userId
    )
    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error('DELETE portfolio/cash error:', error)
    return NextResponse.json({ error: String(error) }, { status: 400 })
  }
}
