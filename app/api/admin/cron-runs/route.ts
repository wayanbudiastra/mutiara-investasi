export const dynamic = 'force-dynamic'
import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

const ADMIN_IDS = (process.env.ADMIN_USER_IDS ?? '')
  .split(',').map(s => s.trim()).filter(Boolean)

interface CronRun {
  id: string
  journalDate: string
  ranAt: string
  durationMs: number
  status: 'success' | 'partial' | 'failed' | 'unauthorized'
  createdCount: number
  skippedCount: number
  errorCount: number
  staleCount: number
  result: string
}

// GET — 30 eksekusi terakhir cron auto-jurnal (tabel dibuat oleh /api/cron/auto-journal)
export async function GET() {
  try {
    const session = await getServerSession(authOptions)
    const adminId = (session?.user as any)?.id
    if (!adminId || !ADMIN_IDS.includes(adminId)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    try {
      const rows = await prisma.$queryRawUnsafe<CronRun[]>(
        `SELECT "id","journalDate","ranAt","durationMs","status",
                "createdCount","skippedCount","errorCount","staleCount","result"
         FROM "cron_runs" WHERE "job" = 'auto-journal'
         ORDER BY "ranAt" DESC LIMIT 30`
      )
      return NextResponse.json(rows)
    } catch {
      // Tabel belum ada — cron belum pernah jalan sejak fitur pencatatan di-deploy
      return NextResponse.json([])
    }
  } catch (error) {
    console.error('admin/cron-runs error:', error)
    return NextResponse.json({ error: String(error) }, { status: 500 })
  }
}
