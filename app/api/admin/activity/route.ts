export const dynamic = 'force-dynamic'
import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

const ADMIN_IDS = (process.env.ADMIN_USER_IDS ?? '')
  .split(',').map(s => s.trim()).filter(Boolean)

interface Activity {
  type: string
  description: string
  createdAt: string
}

async function safeQuery(sql: string, params: unknown[]): Promise<Activity[]> {
  try {
    return await prisma.$queryRawUnsafe<Activity[]>(sql, ...params)
  } catch {
    return []
  }
}

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    const adminId = (session?.user as any)?.id
    if (!adminId || !ADMIN_IDS.includes(adminId)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const targetUserId = new URL(request.url).searchParams.get('userId')
    if (!targetUserId) {
      return NextResponse.json({ error: 'userId wajib diisi' }, { status: 400 })
    }

    // Query per-tabel secara terpisah — satu gagal tidak mempengaruhi yang lain
    const [calc, div, port, jour, cash, sec] = await Promise.all([

      // Simulasi — Prisma managed, coba kedua variasi nama kolom
      safeQuery(`
        SELECT 'Simulasi' AS type,
               CONCAT('Simulasi saham ', "stockSymbol", ' | Qty: ', "quantity"::text, ' | ', "buyPricePerShare"::text) AS description,
               "createdAt"::text AS "createdAt"
        FROM "calculations"
        WHERE "userId" = $1
        ORDER BY "createdAt" DESC LIMIT 20`, [targetUserId]),

      // Dividen
      safeQuery(`
        SELECT 'Dividen' AS type,
               CONCAT('Dividen ', "saham", ' ', "bulan", ' ', "tahun"::text, ' | ', "status") AS description,
               "createdAt"
        FROM "dividends"
        WHERE "userId" = $1
        ORDER BY "createdAt" DESC LIMIT 20`, [targetUserId]),

      // Portofolio
      safeQuery(`
        SELECT 'Portofolio' AS type,
               CONCAT('Portofolio ', "saham", ' | Akun: ', "keterangan", ' | ', "lot"::text, ' lot @ Rp ', "hargaRata"::text) AS description,
               "createdAt"
        FROM "portfolios"
        WHERE "userId" = $1
        ORDER BY "updatedAt" DESC LIMIT 20`, [targetUserId]),

      // Jurnal
      safeQuery(`
        SELECT 'Jurnal' AS type,
               CONCAT('Jurnal ', "journalDate", ' | Nilai Pasar: Rp ',
                 TO_CHAR("totalNilaiPasar", 'FM999,999,999,999')) AS description,
               "createdAt"
        FROM "portfolio_journals"
        WHERE "userId" = $1
        ORDER BY "createdAt" DESC LIMIT 20`, [targetUserId]),

      // Cash
      safeQuery(`
        SELECT 'Cash' AS type,
               CONCAT('Update cash ', "keterangan", ' | Rp ', TO_CHAR("saldo", 'FM999,999,999,999')) AS description,
               "updatedAt" AS "createdAt"
        FROM "portfolio_cash"
        WHERE "userId" = $1
        ORDER BY "updatedAt" DESC LIMIT 20`, [targetUserId]),

      // Sekuritas
      safeQuery(`
        SELECT 'Sekuritas' AS type,
               CONCAT('Sekuritas ', "nama", ' (', "kode", ') — ', "status") AS description,
               "createdAt"
        FROM "securities"
        WHERE "userId" = $1
        ORDER BY "createdAt" DESC LIMIT 20`, [targetUserId]),
    ])

    // Gabung semua, sort by tanggal DESC, limit 20
    const all = [...calc, ...div, ...port, ...jour, ...cash, ...sec]
      .filter(a => a.createdAt)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      .slice(0, 20)

    return NextResponse.json(all)
  } catch (error) {
    console.error('admin/activity error:', error)
    return NextResponse.json({ error: String(error) }, { status: 500 })
  }
}
