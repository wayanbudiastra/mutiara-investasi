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
    const body = await request.json()
    const now  = new Date().toISOString()

    await prisma.$executeRawUnsafe(
      `UPDATE "portfolios"
       SET "keterangan"=$1, "saham"=$2, "hargaRata"=$3, "lot"=$4, "updatedAt"=$5
       WHERE "id"=$6 AND "userId"=$7`,
      String(body.keterangan).toUpperCase().trim(),
      String(body.saham).toUpperCase().trim(),
      Number(body.hargaRata),
      Number(body.lot),
      now,
      id, userId
    )
    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error('PUT portfolio error:', error)
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
      `DELETE FROM "portfolios" WHERE "id"=$1 AND "userId"=$2`,
      id, userId
    )
    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error('DELETE portfolio error:', error)
    return NextResponse.json({ error: String(error) }, { status: 400 })
  }
}
