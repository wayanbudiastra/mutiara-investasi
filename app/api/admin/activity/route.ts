export const dynamic = 'force-dynamic'
import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

const ADMIN_IDS = (process.env.ADMIN_USER_IDS ?? '')
  .split(',').map(s => s.trim()).filter(Boolean)

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

    // UNION aktivitas dari semua tabel — max 20 terbaru
    const activities = await prisma.$queryRawUnsafe<{
      type: string
      description: string
      createdAt: string
    }[]>(`
      SELECT * FROM (

        SELECT 'Simulasi' AS type,
               CONCAT('Simulasi saham ', "stockSymbol", ' | Qty: ', "quantity") AS description,
               "createdAt"::text
        FROM "calculations"
        WHERE "userId" = $1

        UNION ALL

        SELECT 'Dividen' AS type,
               CONCAT('Dividen ', "saham", ' ', "bulan", ' ', "tahun"::text, ' | ', "status") AS description,
               "createdAt"
        FROM "dividends"
        WHERE "userId" = $1

        UNION ALL

        SELECT 'Portofolio' AS type,
               CONCAT('Portofolio ', "saham", ' | Akun: ', "keterangan", ' | ', "lot"::text, ' lot') AS description,
               "createdAt"
        FROM "portfolios"
        WHERE "userId" = $1

        UNION ALL

        SELECT 'Jurnal' AS type,
               CONCAT('Jurnal portofolio | Aset: Rp ', TO_CHAR("totalAset", 'FM999,999,999,999')) AS description,
               "createdAt"
        FROM "portfolio_journals"
        WHERE "userId" = $1

        UNION ALL

        SELECT 'Cash' AS type,
               CONCAT('Update cash ', "keterangan", ' | Rp ', TO_CHAR("saldo", 'FM999,999,999,999')) AS description,
               "createdAt"
        FROM "portfolio_cash"
        WHERE "userId" = $1

        UNION ALL

        SELECT 'Sekuritas' AS type,
               CONCAT('Tambah sekuritas ', "nama", ' (', "kode", ')') AS description,
               "createdAt"
        FROM "securities"
        WHERE "userId" = $1

      ) all_activities
      ORDER BY "createdAt" DESC
      LIMIT 20
    `, targetUserId)

    return NextResponse.json(activities)
  } catch (error) {
    console.error('admin/activity error:', error)
    return NextResponse.json({ error: String(error) }, { status: 500 })
  }
}
