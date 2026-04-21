import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions)
    const userId = (session?.user as any)?.id
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { id } = await params
    const body = await request.json()
    const now = new Date().toISOString()

    await prisma.$executeRawUnsafe(
      `UPDATE "dividends"
       SET "bulan"=$1,"tahun"=$2,"saham"=$3,"dividen"=$4,"lot"=$5,"total"=$6,"keterangan"=$7,"status"=$8,"updatedAt"=$9
       WHERE "id"=$10 AND "userId"=$11`,
      body.bulan, Number(body.tahun), body.saham,
      Number(body.dividen), Number(body.lot), Number(body.total),
      body.keterangan, body.status,
      now, id, userId
    )
    return NextResponse.json({ ok: true })
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 400 })
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions)
    const userId = (session?.user as any)?.id
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { id } = await params
    await prisma.$executeRawUnsafe(
      `DELETE FROM "dividends" WHERE "id"=$1 AND "userId"=$2`,
      id, userId
    )
    return NextResponse.json({ ok: true })
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 400 })
  }
}
