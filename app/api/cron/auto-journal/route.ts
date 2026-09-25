export const dynamic = 'force-dynamic'
export const maxDuration = 60

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { checkProAccess } from '@/lib/subscription'
import { randomUUID } from 'crypto'

// Dipicu oleh Cron Job hosting (lihat README § Cron Job — Auto Jurnal Harian) setiap
// jam 22:00 WIB — setelah market tutup. Request harus menyertakan header
// "Authorization: Bearer $CRON_SECRET" yang cocok, atau ditolak.
function checkAuth(request: NextRequest): boolean {
  const expected = process.env.CRON_SECRET
  if (!expected) return false
  const auth = request.headers.get('authorization') ?? ''
  const token = auth.replace(/^Bearer\s+/i, '')
  return token === expected
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
  if (!checkAuth(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const journalDate = todayWIB()
  const ranAt = new Date().toISOString()
  const created: string[] = []
  const skipped: { userId: string; reason: string }[] = []
  const errors: { userId: string; error: string }[] = []

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
          }
        })

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
          JSON.stringify({ stocks: detail, cashSnapshot: cashRows }), ranAt
        )

        created.push(userId)
      } catch (err) {
        errors.push({ userId, error: String(err) })
      }
    }

    console.log(`[auto-journal] ${journalDate}: created=${created.length} skipped=${skipped.length} errors=${errors.length}`)

    return NextResponse.json({ ranAt, journalDate, created, skipped, errors })
  } catch (error) {
    console.error('cron auto-journal error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
