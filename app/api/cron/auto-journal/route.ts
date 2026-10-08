export const dynamic = 'force-dynamic'
export const maxDuration = 60

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { checkProAccess } from '@/lib/subscription'
import { randomUUID, timingSafeEqual } from 'crypto'

// Dipicu oleh Cron Job hosting (lihat README § Cron Job — Auto Jurnal Harian) setiap
// jam 22:00 WIB — setelah market tutup. Token CRON_SECRET bisa dikirim lewat:
//   - header "Authorization: Bearer <token>"
//   - header "x-cron-secret: <token>" — proxy LiteSpeed/Apache di shared hosting
//     (Hostinger) sering membuang header Authorization sebelum sampai ke Node.js
//   - query string "?secret=<token>" — fallback terakhir jika semua header dibuang
// Mengembalikan null jika valid, atau alasan penolakan (tanpa membocorkan token).
function checkAuth(request: NextRequest): string | null {
  const expected = process.env.CRON_SECRET?.trim().replace(/^["']|["']$/g, '')
  if (!expected) return 'CRON_SECRET belum diset di environment server'

  const bearer = (request.headers.get('authorization') ?? '').replace(/^Bearer\s+/i, '').trim()
  const token  = bearer
    || (request.headers.get('x-cron-secret') ?? '').trim()
    || (request.nextUrl.searchParams.get('secret') ?? '').trim()
  if (!token) return 'token tidak diterima (header Authorization kemungkinan dibuang proxy — pakai x-cron-secret atau ?secret=)'

  const a = Buffer.from(token)
  const b = Buffer.from(expected)
  if (a.length !== b.length || !timingSafeEqual(a, b)) return 'token tidak cocok dengan CRON_SECRET'
  return null
}

function todayWIB() {
  return new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Jakarta' })
}

async function ensureTables() {
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "portfolio_journals" (
      "id"              TEXT NOT NULL PRIMARY KEY,
      "userId"          TEXT NOT NULL,
      "journalDate"     TEXT NOT NULL,
      "totalModal"      DOUBLE PRECISION NOT NULL,
      "totalNilaiPasar" DOUBLE PRECISION NOT NULL,
      "totalFloatRp"    DOUBLE PRECISION NOT NULL,
      "totalFloatPct"   DOUBLE PRECISION NOT NULL,
      "detail"          TEXT NOT NULL,
      "createdAt"       TEXT NOT NULL,
      UNIQUE("userId", "journalDate")
    )
  `)
  await prisma.$executeRawUnsafe(
    `ALTER TABLE "portfolio_journals" ADD COLUMN IF NOT EXISTS "totalCash" DOUBLE PRECISION NOT NULL DEFAULT 0`
  )
  await prisma.$executeRawUnsafe(
    `ALTER TABLE "portfolio_journals" ADD COLUMN IF NOT EXISTS "totalAset" DOUBLE PRECISION NOT NULL DEFAULT 0`
  )
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "portfolio_cash" (
      "id"         TEXT NOT NULL PRIMARY KEY,
      "userId"     TEXT NOT NULL,
      "keterangan" TEXT NOT NULL,
      "saldo"      DOUBLE PRECISION NOT NULL,
      "catatan"    TEXT,
      "createdAt"  TEXT NOT NULL,
      "updatedAt"  TEXT NOT NULL,
      UNIQUE("userId", "keterangan")
    )
  `)
  // Riwayat eksekusi cron — dibaca halaman Admin untuk memantau apakah cron jalan tiap hari
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "cron_runs" (
      "id"           TEXT NOT NULL PRIMARY KEY,
      "job"          TEXT NOT NULL,
      "journalDate"  TEXT NOT NULL,
      "ranAt"        TEXT NOT NULL,
      "durationMs"   INTEGER NOT NULL,
      "status"       TEXT NOT NULL,
      "createdCount" INTEGER NOT NULL DEFAULT 0,
      "skippedCount" INTEGER NOT NULL DEFAULT 0,
      "errorCount"   INTEGER NOT NULL DEFAULT 0,
      "staleCount"   INTEGER NOT NULL DEFAULT 0,
      "result"       TEXT NOT NULL
    )
  `)
}

// Simpan ringkasan eksekusi; kegagalan mencatat tidak boleh menggagalkan respons cron
async function recordRun(run: {
  journalDate: string; ranAt: string; startedMs: number; status: 'success' | 'partial' | 'failed' | 'unauthorized'
  created: string[]; skipped: unknown[]; errors: unknown[]; stale: unknown[]; fatal?: string
}) {
  try {
    await prisma.$executeRawUnsafe(
      `INSERT INTO "cron_runs"
         ("id","job","journalDate","ranAt","durationMs","status",
          "createdCount","skippedCount","errorCount","staleCount","result")
       VALUES ($1,'auto-journal',$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
      randomUUID(), run.journalDate, run.ranAt, Date.now() - run.startedMs, run.status,
      run.created.length, run.skipped.length, run.errors.length, run.stale.length,
      JSON.stringify({ created: run.created, skipped: run.skipped, errors: run.errors, stale: run.stale, fatal: run.fatal })
    )
  } catch (err) {
    console.error('[auto-journal] gagal mencatat cron_runs:', err)
  }
}

// Catat request yang ditolak supaya admin bisa membedakan "cron tidak pernah memanggil"
// dari "cron memanggil tapi token salah/dibuang proxy". Dibatasi 1 catatan per 10 menit
// agar request acak ke URL publik ini tidak membanjiri tabel.
async function recordRejected(reason: string, startedMs: number) {
  try {
    await ensureTables()
    const since  = new Date(startedMs - 10 * 60 * 1000).toISOString()
    const recent = await prisma.$queryRawUnsafe<{ id: string }[]>(
      `SELECT "id" FROM "cron_runs" WHERE "job" = 'auto-journal' AND "status" = 'unauthorized' AND "ranAt" >= $1 LIMIT 1`,
      since
    )
    if (recent.length > 0) return
    await recordRun({
      journalDate: todayWIB(), ranAt: new Date(startedMs).toISOString(), startedMs, status: 'unauthorized',
      created: [], skipped: [], errors: [], stale: [], fatal: reason,
    })
  } catch (err) {
    console.error('[auto-journal] gagal mencatat request ditolak:', err)
  }
}

// Singleton yahoo-finance2 — pola sama dengan route portfolio lain
let _yf: { quote: (s: string) => Promise<{ regularMarketPrice?: number }> } | null = null
function getYF() {
  if (!_yf) {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const YFClass = require('yahoo-finance2').default
    _yf = new YFClass({ suppressNotices: ['yahooSurvey'] })
  }
  return _yf!
}

interface PortfolioRow {
  userId: string
  keterangan: string
  saham: string
  hargaRata: number
  lot: number
  lastPrice: number | null
}

export async function GET(request: NextRequest) {
  const authError = checkAuth(request)
  if (authError) {
    console.warn(`[auto-journal] ditolak: ${authError}`)
    await recordRejected(authError, Date.now())
    return NextResponse.json({ error: 'Unauthorized', reason: authError }, { status: 401 })
  }

  const startedMs   = Date.now()
  const journalDate = todayWIB()
  const ranAt = new Date(startedMs).toISOString()
  const created: string[] = []
  const skipped: { userId: string; reason: string }[] = []
  const errors: { userId: string; error: string }[] = []
  // Saham yang harganya gagal diambil dari Yahoo sehingga jurnal memakai cache lastPrice
  const stale: { userId: string; symbols: string[] }[] = []

  try {
    await ensureTables()

    const users = await prisma.$queryRawUnsafe<{ userId: string }[]>(
      `SELECT DISTINCT "userId" FROM "portfolios"`
    )

    const yf = getYF()

    for (const { userId } of users) {
      try {
        // Sudah ada jurnal hari ini (baik dibuat manual maupun oleh cron sebelumnya) — lewati
        const existing = await prisma.$queryRawUnsafe<{ id: string }[]>(
          `SELECT "id" FROM "portfolio_journals" WHERE "userId" = $1 AND "journalDate" = $2 LIMIT 1`,
          userId, journalDate
        )
        if (existing.length > 0) {
          skipped.push({ userId, reason: 'jurnal hari ini sudah ada' })
          continue
        }

        // Fitur jurnal adalah fitur Pro — hormati status akses yang sama seperti UI
        const access = await checkProAccess(userId)
        if (!access.hasAccess) {
          skipped.push({ userId, reason: 'tidak punya akses Pro' })
          continue
        }

        const rows = await prisma.$queryRawUnsafe<PortfolioRow[]>(
          `SELECT "userId","keterangan","saham","hargaRata","lot","lastPrice"
           FROM "portfolios" WHERE "userId" = $1`,
          userId
        )
        if (rows.length === 0) {
          skipped.push({ userId, reason: 'tidak ada posisi portofolio' })
          continue
        }

        // Ambil harga terkini per simbol unik — fallback ke cache lastPrice jika Yahoo gagal
        const symbols  = Array.from(new Set(rows.map(r => r.saham)))
        const priceMap: Record<string, number | null> = {}
        await Promise.all(symbols.map(async (sym) => {
          try {
            const quote = await yf.quote(`${sym}.JK`)
            const price = typeof quote?.regularMarketPrice === 'number' ? quote.regularMarketPrice : null
            priceMap[sym] = price
            if (price !== null) {
              await prisma.$executeRawUnsafe(
                `UPDATE "portfolios" SET "lastPrice"=$1,"lastPriceAt"=$2 WHERE "userId"=$3 AND "saham"=$4`,
                price, ranAt, userId, sym
              )
            }
          } catch {
            priceMap[sym] = null
          }
        }))

        const detail = rows.map(r => {
          const modal      = r.hargaRata * r.lot * 100
          const hargaAkhir = priceMap[r.saham] ?? r.lastPrice ?? null
          const nilaiPasar = hargaAkhir != null ? hargaAkhir * r.lot * 100 : null
          const floatRp    = nilaiPasar != null ? nilaiPasar - modal : null
          const floatPct   = floatRp != null && modal > 0 ? (floatRp / modal) * 100 : null
          return {
            keterangan: r.keterangan, saham: r.saham, hargaRata: r.hargaRata, lot: r.lot,
            modal, hargaTerakhir: hargaAkhir, nilaiPasar, floatRp, floatPct,
            hargaCadangan: priceMap[r.saham] == null,
          }
        })
        const staleSymbols = symbols.filter(sym => priceMap[sym] == null)

        const totalModal      = detail.reduce((s, d) => s + d.modal, 0)
        const totalNilaiPasar = detail.reduce((s, d) => s + (d.nilaiPasar ?? d.modal), 0)
        const totalFloatRp    = totalNilaiPasar - totalModal
        const totalFloatPct   = totalModal > 0 ? (totalFloatRp / totalModal) * 100 : 0

        const cashRows = await prisma.$queryRawUnsafe<{ keterangan: string; saldo: number; catatan: string | null }[]>(
          `SELECT "keterangan","saldo","catatan" FROM "portfolio_cash" WHERE "userId" = $1`,
          userId
        )
        const totalCash = cashRows.reduce((s, c) => s + Number(c.saldo), 0)
        const totalAset = totalNilaiPasar + totalCash

        const id = randomUUID()
        await prisma.$executeRawUnsafe(
          `INSERT INTO "portfolio_journals"
             ("id","userId","journalDate","totalModal","totalNilaiPasar","totalFloatRp","totalFloatPct",
              "totalCash","totalAset","detail","createdAt")
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)`,
          id, userId, journalDate,
          totalModal, totalNilaiPasar, totalFloatRp, totalFloatPct,
          totalCash, totalAset,
          JSON.stringify({ stocks: detail, cashSnapshot: cashRows, source: 'auto', staleSymbols }), ranAt
        )

        created.push(userId)
        if (staleSymbols.length > 0) stale.push({ userId, symbols: staleSymbols })
      } catch (err) {
        errors.push({ userId, error: String(err) })
      }
    }

    console.log(`[auto-journal] ${journalDate}: created=${created.length} skipped=${skipped.length} errors=${errors.length} stale=${stale.length}`)

    await recordRun({
      journalDate, ranAt, startedMs, status: errors.length > 0 ? 'partial' : 'success',
      created, skipped, errors, stale,
    })
    return NextResponse.json({ ranAt, journalDate, created, skipped, errors, stale })
  } catch (error) {
    console.error('cron auto-journal error:', error)
    await recordRun({
      journalDate, ranAt, startedMs, status: 'failed',
      created, skipped, errors, stale, fatal: String(error),
    })
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
