export const dynamic = 'force-dynamic'
export const maxDuration = 60

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { filterProUsers } from '@/lib/subscription'
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
interface YFQuote { symbol?: string; regularMarketPrice?: number }
let _yf: { quote: (s: string | string[]) => Promise<YFQuote | YFQuote[]> } | null = null
function getYF() {
  if (!_yf) {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const YFClass = require('yahoo-finance2').default
    _yf = new YFClass({ suppressNotices: ['yahooSurvey'] })
  }
  return _yf!
}

// Jalankan fn untuk tiap item dengan paralelisme terbatas — agar Yahoo / database tidak dibanjiri
async function mapLimit<T>(items: T[], limit: number, fn: (item: T) => Promise<void>) {
  for (let i = 0; i < items.length; i += limit) {
    await Promise.all(items.slice(i, i + limit).map(fn))
  }
}

// Ambil harga semua simbol unik sekaligus (satu request Yahoo per 50 simbol).
// Jika satu batch gagal, coba per simbol supaya satu simbol bermasalah tidak menggagalkan semuanya.
// Simbol yang tetap gagal bernilai null → jurnal memakai cache lastPrice (harga cadangan).
async function fetchPrices(symbols: string[]): Promise<Map<string, number | null>> {
  const yf = getYF()
  const prices = new Map<string, number | null>(symbols.map(s => [s, null]))
  const toPrice = (q?: YFQuote) => typeof q?.regularMarketPrice === 'number' ? q.regularMarketPrice : null

  const BATCH = 50
  for (let i = 0; i < symbols.length; i += BATCH) {
    const chunk = symbols.slice(i, i + BATCH)
    try {
      const res    = await yf.quote(chunk.map(s => `${s}.JK`))
      const quotes = Array.isArray(res) ? res : [res]
      for (const q of quotes) {
        const sym = q?.symbol?.replace(/\.JK$/i, '')
        if (sym && prices.has(sym)) prices.set(sym, toPrice(q))
      }
    } catch {
      await mapLimit(chunk, 5, async (sym) => {
        try {
          const q = await yf.quote(`${sym}.JK`)
          prices.set(sym, toPrice(Array.isArray(q) ? q[0] : q))
        } catch { /* tetap null → harga cadangan */ }
      })
    }
  }
  return prices
}

interface PortfolioRow {
  userId: string
  keterangan: string
  saham: string
  hargaRata: number
  lot: number
  lastPrice: number | null
}

interface CashRow {
  userId: string
  keterangan: string
  saldo: number
  catatan: string | null
}

// Alur dibuat batch supaya tetap cepat untuk ratusan member (cron-job.org timeout ±30 detik):
// semua data dibaca dengan beberapa query besar, harga tiap simbol unik diambil sekali untuk
// semua user, lalu jurnal disimpan paralel terbatas.
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

    // 1. Tentukan user yang perlu dibuatkan jurnal
    const allRows = await prisma.$queryRawUnsafe<PortfolioRow[]>(
      `SELECT "userId","keterangan","saham","hargaRata","lot","lastPrice" FROM "portfolios"`
    )
    const rowsByUser = new Map<string, PortfolioRow[]>()
    for (const r of allRows) {
      const list = rowsByUser.get(r.userId) ?? []
      list.push(r)
      rowsByUser.set(r.userId, list)
    }
    const userIds = Array.from(rowsByUser.keys())

    // Sudah ada jurnal hari ini (dibuat manual maupun oleh cron sebelumnya) — lewati
    const existing = new Set((await prisma.$queryRawUnsafe<{ userId: string }[]>(
      `SELECT "userId" FROM "portfolio_journals" WHERE "journalDate" = $1`, journalDate
    )).map(r => r.userId))

    // Fitur jurnal adalah fitur Pro — aturan akses sama dengan UI (checkProAccess)
    const proUsers = await filterProUsers(userIds.filter(id => !existing.has(id)))

    const targets: string[] = []
    for (const userId of userIds) {
      if (existing.has(userId))       skipped.push({ userId, reason: 'jurnal hari ini sudah ada' })
      else if (!proUsers.has(userId)) skipped.push({ userId, reason: 'tidak punya akses Pro' })
      else targets.push(userId)
    }

    if (targets.length > 0) {
      // 2. Harga: satu kali per simbol unik untuk semua user target
      const symbols = Array.from(new Set(targets.flatMap(id => rowsByUser.get(id)!.map(r => r.saham))))
      const prices  = await fetchPrices(symbols)

      // Perbarui cache lastPrice untuk semua posisi pada simbol yang berhasil diambil
      const fresh = symbols.filter(s => prices.get(s) != null)
      if (fresh.length > 0) {
        await prisma.$executeRawUnsafe(
          `UPDATE "portfolios" AS p SET "lastPrice" = v.price, "lastPriceAt" = $1
           FROM UNNEST($2::text[], $3::float8[]) AS v(saham, price)
           WHERE p."saham" = v.saham`,
          ranAt, fresh, fresh.map(s => prices.get(s)!)
        )
      }

      // 3. Cash semua user target dalam satu query
      const cashByUser = new Map<string, Omit<CashRow, 'userId'>[]>()
      const cashRows = await prisma.$queryRawUnsafe<CashRow[]>(
        `SELECT "userId","keterangan","saldo","catatan" FROM "portfolio_cash" WHERE "userId" = ANY($1::text[])`,
        targets
      )
      for (const { userId, ...c } of cashRows) {
        const list = cashByUser.get(userId) ?? []
        list.push(c)
        cashByUser.set(userId, list)
      }

      // 4. Susun & simpan jurnal per user, paralel terbatas
      await mapLimit(targets, 10, async (userId) => {
        try {
          const rows = rowsByUser.get(userId)!
          const detail = rows.map(r => {
            const live       = prices.get(r.saham) ?? null
            const modal      = r.hargaRata * r.lot * 100
            const hargaAkhir = live ?? r.lastPrice ?? null
            const nilaiPasar = hargaAkhir != null ? hargaAkhir * r.lot * 100 : null
            const floatRp    = nilaiPasar != null ? nilaiPasar - modal : null
            const floatPct   = floatRp != null && modal > 0 ? (floatRp / modal) * 100 : null
            return {
              keterangan: r.keterangan, saham: r.saham, hargaRata: r.hargaRata, lot: r.lot,
              modal, hargaTerakhir: hargaAkhir, nilaiPasar, floatRp, floatPct,
              hargaCadangan: live == null,
            }
          })
          const staleSymbols = Array.from(new Set(rows.map(r => r.saham))).filter(s => prices.get(s) == null)

          const totalModal      = detail.reduce((s, d) => s + d.modal, 0)
          const totalNilaiPasar = detail.reduce((s, d) => s + (d.nilaiPasar ?? d.modal), 0)
          const totalFloatRp    = totalNilaiPasar - totalModal
          const totalFloatPct   = totalModal > 0 ? (totalFloatRp / totalModal) * 100 : 0

          const cash      = cashByUser.get(userId) ?? []
          const totalCash = cash.reduce((s, c) => s + Number(c.saldo), 0)
          const totalAset = totalNilaiPasar + totalCash

          // ON CONFLICT: user bisa saja membuat jurnal manual di sela proses cron — jangan error, lewati
          const inserted = await prisma.$executeRawUnsafe(
            `INSERT INTO "portfolio_journals"
               ("id","userId","journalDate","totalModal","totalNilaiPasar","totalFloatRp","totalFloatPct",
                "totalCash","totalAset","detail","createdAt")
             VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
             ON CONFLICT ("userId","journalDate") DO NOTHING`,
            randomUUID(), userId, journalDate,
            totalModal, totalNilaiPasar, totalFloatRp, totalFloatPct,
            totalCash, totalAset,
            JSON.stringify({ stocks: detail, cashSnapshot: cash, source: 'auto', staleSymbols }), ranAt
          )
          if (inserted === 0) {
            skipped.push({ userId, reason: 'jurnal hari ini sudah ada' })
            return
          }

          created.push(userId)
          if (staleSymbols.length > 0) stale.push({ userId, symbols: staleSymbols })
        } catch (err) {
          errors.push({ userId, error: String(err) })
        }
      })
    }

    console.log(`[auto-journal] ${journalDate}: created=${created.length} skipped=${skipped.length} errors=${errors.length} stale=${stale.length} in ${Date.now() - startedMs}ms`)

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
