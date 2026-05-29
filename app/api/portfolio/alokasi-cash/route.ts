export const dynamic = 'force-dynamic'
import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

interface CashSnapshot {
  keterangan: string
  saldo: number
  catatan: string | null
}

function parseCashSnapshot(detailStr: string): CashSnapshot[] {
  try {
    const p = JSON.parse(detailStr)
    if (Array.isArray(p)) return []
    return (p.cashSnapshot ?? []) as CashSnapshot[]
  } catch {
    return []
  }
}

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    const userId  = (session?.user as any)?.id
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const year = parseInt(new URL(request.url).searchParams.get('year') ?? '') || new Date().getFullYear()

    const journals = await prisma.$queryRawUnsafe<{
      id: string; journalDate: string; detail: string; totalNilaiPasar: number
    }[]>(
      `SELECT "id", "journalDate", "detail", "totalNilaiPasar"
       FROM "portfolio_journals"
       WHERE "userId" = $1 AND "journalDate" LIKE $2
       ORDER BY "journalDate" DESC LIMIT 1`,
      userId, `${year}-%`
    )

    const empty = { snapshot_date: null, year, total_cash: 0, total_nilai_pasar: 0, jumlah_akun: 0, data: [] }
    if (!journals.length) return NextResponse.json(empty)

    const journal         = journals[0]
    const cashSnapshot    = parseCashSnapshot(journal.detail)
    const totalNilaiPasar = Number(journal.totalNilaiPasar ?? 0)

    const positive = cashSnapshot.filter(c => c.saldo > 0)
    if (positive.length === 0) return NextResponse.json({ ...empty, total_nilai_pasar: totalNilaiPasar })

    const total = positive.reduce((s, c) => s + c.saldo, 0)

    const data = positive
      .map(c => ({
        keterangan:  c.keterangan,
        saldo:       c.saldo,
        porsi_persen: parseFloat(((c.saldo / total) * 100).toFixed(2)),
      }))
      .sort((a, b) => b.saldo - a.saldo)

    return NextResponse.json({
      snapshot_date:    journal.journalDate,
      year,
      total_cash:       total,
      total_nilai_pasar: totalNilaiPasar,
      jumlah_akun:      data.length,
      data,
    })
  } catch (error) {
    console.error('GET alokasi-cash error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
