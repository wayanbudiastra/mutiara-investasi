import { randomUUID } from 'crypto'
import { prisma } from '@/lib/prisma'
import {
  getBrokerSummary, getForeignTradingFlow, getDomesticTradingFlow, getStockSummary,
  type StockSummaryItem,
} from '@/lib/idx-client'

export async function ensureIdxTables() {
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "broker_summaries" (
      "id"         TEXT NOT NULL PRIMARY KEY,
      "date"       TEXT NOT NULL,
      "brokerCode" TEXT NOT NULL,
      "brokerName" TEXT NOT NULL,
      "volume"     BIGINT NOT NULL,
      "value"      BIGINT NOT NULL,
      "frequency"  INTEGER NOT NULL,
      "createdAt"  TEXT NOT NULL,
      "updatedAt"  TEXT NOT NULL,
      UNIQUE("date", "brokerCode")
    )
  `)
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "investor_flows" (
      "id"            TEXT NOT NULL PRIMARY KEY,
      "date"          TEXT NOT NULL,
      "investorType"  TEXT NOT NULL,
      "buyVolume"     BIGINT NOT NULL,
      "buyValue"      BIGINT NOT NULL,
      "buyFrequency"  BIGINT NOT NULL,
      "sellVolume"    BIGINT NOT NULL,
      "sellValue"     BIGINT NOT NULL,
      "sellFrequency" BIGINT NOT NULL,
      "createdAt"     TEXT NOT NULL,
      "updatedAt"     TEXT NOT NULL,
      UNIQUE("date", "investorType")
    )
  `)
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "stock_summaries" (
      "id"          TEXT NOT NULL PRIMARY KEY,
      "date"        TEXT NOT NULL,
      "stockCode"   TEXT NOT NULL,
      "stockName"   TEXT NOT NULL,
      "close"       DOUBLE PRECISION NOT NULL,
      "volume"      BIGINT NOT NULL,
      "value"       BIGINT NOT NULL,
      "foreignBuy"  BIGINT NOT NULL,
      "foreignSell" BIGINT NOT NULL,
      "createdAt"   TEXT NOT NULL,
      "updatedAt"   TEXT NOT NULL,
      UNIQUE("date", "stockCode")
    )
  `)
  // Kolom baru — aman dijalankan berulang untuk tabel yang sudah ada sebelumnya
  await prisma.$executeRawUnsafe(
    `ALTER TABLE "stock_summaries" ADD COLUMN IF NOT EXISTS "frequency" INTEGER NOT NULL DEFAULT 0`
  )
  await prisma.$executeRawUnsafe(
    `ALTER TABLE "stock_summaries" ADD COLUMN IF NOT EXISTS "nonRegularVolume" BIGINT NOT NULL DEFAULT 0`
  )
}

export interface SourceResult {
  success: boolean
  count: number
  durationMs: number
  error?: string
}

async function runBrokerSummary(date: string): Promise<SourceResult> {
  const start = Date.now()
  try {
    const items = await getBrokerSummary(date)
    const now = new Date().toISOString()
    for (const item of items) {
      await prisma.$executeRawUnsafe(
        `INSERT INTO "broker_summaries"
           ("id","date","brokerCode","brokerName","volume","value","frequency","createdAt","updatedAt")
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$8)
         ON CONFLICT ("date","brokerCode") DO UPDATE SET
           "brokerName" = EXCLUDED."brokerName",
           "volume"     = EXCLUDED."volume",
           "value"      = EXCLUDED."value",
           "frequency"  = EXCLUDED."frequency",
           "updatedAt"  = EXCLUDED."updatedAt"`,
        randomUUID(), item.date, item.brokerCode, item.brokerName,
        item.volume, item.value, item.frequency, now,
      )
    }
    return { success: true, count: items.length, durationMs: Date.now() - start }
  } catch (error) {
    return { success: false, count: 0, durationMs: Date.now() - start, error: (error as Error).message }
  }
}

async function runInvestorFlow(
  source: 'foreign' | 'domestic', year: number, month: number,
): Promise<SourceResult> {
  const start = Date.now()
  try {
    const items = source === 'foreign'
      ? await getForeignTradingFlow(year, month)
      : await getDomesticTradingFlow(year, month)
    const now = new Date().toISOString()
    for (const item of items) {
      await prisma.$executeRawUnsafe(
        `INSERT INTO "investor_flows"
           ("id","date","investorType","buyVolume","buyValue","buyFrequency",
            "sellVolume","sellValue","sellFrequency","createdAt","updatedAt")
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$10)
         ON CONFLICT ("date","investorType") DO UPDATE SET
           "buyVolume"     = EXCLUDED."buyVolume",
           "buyValue"      = EXCLUDED."buyValue",
           "buyFrequency"  = EXCLUDED."buyFrequency",
           "sellVolume"    = EXCLUDED."sellVolume",
           "sellValue"     = EXCLUDED."sellValue",
           "sellFrequency" = EXCLUDED."sellFrequency",
           "updatedAt"     = EXCLUDED."updatedAt"`,
        randomUUID(), item.date, item.investorType,
        item.buyVolume, item.buyValue, item.buyFrequency,
        item.sellVolume, item.sellValue, item.sellFrequency, now,
      )
    }
    return { success: true, count: items.length, durationMs: Date.now() - start }
  } catch (error) {
    return { success: false, count: 0, durationMs: Date.now() - start, error: (error as Error).message }
  }
}

async function upsertStockSummaryItem(item: StockSummaryItem, now: string) {
  await prisma.$executeRawUnsafe(
    `INSERT INTO "stock_summaries"
       ("id","date","stockCode","stockName","close","volume","value","frequency","foreignBuy","foreignSell","nonRegularVolume","createdAt","updatedAt")
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$12)
     ON CONFLICT ("date","stockCode") DO UPDATE SET
       "stockName"        = EXCLUDED."stockName",
       "close"            = EXCLUDED."close",
       "volume"           = EXCLUDED."volume",
       "value"            = EXCLUDED."value",
       "frequency"        = EXCLUDED."frequency",
       "foreignBuy"       = EXCLUDED."foreignBuy",
       "foreignSell"      = EXCLUDED."foreignSell",
       "nonRegularVolume" = EXCLUDED."nonRegularVolume",
       "updatedAt"        = EXCLUDED."updatedAt"`,
    randomUUID(), item.date, item.stockCode, item.stockName,
    item.close, item.volume, item.value, item.frequency, item.foreignBuy, item.foreignSell,
    item.nonRegularVolume, now,
  )
}

async function runStockSummary(date: string): Promise<SourceResult> {
  const start = Date.now()
  try {
    const items = await getStockSummary(date)
    const now = new Date().toISOString()
    for (const item of items) {
      await upsertStockSummaryItem(item, now)
    }
    return { success: true, count: items.length, durationMs: Date.now() - start }
  } catch (error) {
    return { success: false, count: 0, durationMs: Date.now() - start, error: (error as Error).message }
  }
}

/**
 * Versi ringan runStockSummary — IDX tidak mendukung filter per saham di endpoint
 * GetStockSummary (parameter code/search diabaikan, selalu kembalikan seluruh ~959 saham),
 * jadi fetch tetap mengambil semua data, TAPI hanya 1 baris yang di-upsert ke DB.
 * Ini menghindari loop upsert 959 baris satu-per-satu yang lambat (~40-50 detik) ketika
 * user hanya ingin memperbarui data saham yang sedang dia lihat.
 */
export async function runStockSummaryForCode(date: string, stockCode: string): Promise<SourceResult> {
  const start = Date.now()
  try {
    const items = await getStockSummary(date)
    const item = items.find(i => i.stockCode === stockCode)
    if (!item) return { success: true, count: 0, durationMs: Date.now() - start }
    await upsertStockSummaryItem(item, new Date().toISOString())
    return { success: true, count: 1, durationMs: Date.now() - start }
  } catch (error) {
    return { success: false, count: 0, durationMs: Date.now() - start, error: (error as Error).message }
  }
}

export interface SyncIdxResult {
  broker: SourceResult
  foreign: SourceResult
  domestic: SourceResult
  stock: SourceResult
  paramsUsed: { date: string; year: number; month: number }
}

/**
 * Jalankan keempat sumber IDX (broker, foreign/domestic flow, stock summary) — independen,
 * satu gagal tidak menjalar ke yang lain (lihat prd/testing_koneksi_idx.md F6).
 * Foreign/domestic flow bulan berjalan sering belum dipublikasikan IDX — fallback otomatis
 * ke bulan sebelumnya jika hasil bulan berjalan kosong (lihat prd/testing_koneksi_idx_report.md §3.1).
 */
export async function runIdxSync(params: { date: string; year: number; month: number }): Promise<SyncIdxResult> {
  await ensureIdxTables()
  const { date } = params
  let { year, month } = params

  const [broker, stock, initialForeign, initialDomestic] = await Promise.all([
    runBrokerSummary(date),
    runStockSummary(date),
    runInvestorFlow('foreign', year, month),
    runInvestorFlow('domestic', year, month),
  ])

  let foreign = initialForeign
  let domestic = initialDomestic

  if (foreign.success && domestic.success && foreign.count === 0 && domestic.count === 0) {
    const prevMonthDate = new Date(year, month - 2, 1)
    const prevYear = prevMonthDate.getFullYear()
    const prevMonth = prevMonthDate.getMonth() + 1
    const [foreign2, domestic2] = await Promise.all([
      runInvestorFlow('foreign', prevYear, prevMonth),
      runInvestorFlow('domestic', prevYear, prevMonth),
    ])
    if (foreign2.count > 0 || domestic2.count > 0) {
      foreign = foreign2
      domestic = domestic2
      year = prevYear
      month = prevMonth
    }
  }

  return { broker, foreign, domestic, stock, paramsUsed: { date, year, month } }
}
