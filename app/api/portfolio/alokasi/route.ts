export const dynamic = 'force-dynamic'
import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

interface StockDetail {
  saham: string
  nilaiPasar: number | null
  hargaTerakhir: number | null
  lot: number
  hargaRata: number
}

function parseDetail(detailStr: string): StockDetail[] {
  try {
    const p = JSON.parse(detailStr)
    const stocks = Array.isArray(p) ? p : (p.stocks ?? [])
    return stocks as StockDetail[]
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

    // Jurnal terakhir pada tahun yang dipilih
    const journals = await prisma.$queryRawUnsafe<{
      id: string; journalDate: string; detail: string
    }[]>(
      `SELECT "id", "journalDate", "detail"
       FROM "portfolio_journals"
       WHERE "userId" = $1 AND "journalDate" LIKE $2
       ORDER BY "journalDate" DESC LIMIT 1`,
      userId, `${year}-%`
    )

    const empty = { snapshot_date: null, year, total_nilai_pasar: 0, jumlah_emiten: 0, data: [] }
    if (!journals.length) return NextResponse.json(empty)

    const journal     = journals[0]
    const stocks      = parseDetail(journal.detail)

    // Agregasi nilaiPasar per saham (tanpa akun sekuritas)
    const aggregated: Record<string, number> = {}
    for (const s of stocks) {
      const nilai = s.nilaiPasar ?? (s.hargaTerakhir != null ? s.hargaTerakhir * s.lot * 100 : null)
      if (nilai != null && nilai > 0) {
        aggregated[s.saham] = (aggregated[s.saham] ?? 0) + nilai
      }
    }

    if (Object.keys(aggregated).length === 0) return NextResponse.json(empty)

    const total = Object.values(aggregated).reduce((s, v) => s + v, 0)

    const data = Object.entries(aggregated)
      .map(([kode_saham, nilai_pasar]) => ({
        kode_saham,
        nilai_pasar,
        porsi_persen: parseFloat(((nilai_pasar / total) * 100).toFixed(2)),
      }))
      .sort((a, b) => b.nilai_pasar - a.nilai_pasar)

    return NextResponse.json({
      snapshot_date:     journal.journalDate,
      year,
      total_nilai_pasar: total,
      jumlah_emiten:     data.length,
      data,
    })
  } catch (error) {
    console.error('GET alokasi error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
