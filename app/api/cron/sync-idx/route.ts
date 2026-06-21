export const dynamic = 'force-dynamic'
export const maxDuration = 60

import { NextRequest, NextResponse } from 'next/server'
import { randomUUID } from 'crypto'
import { prisma } from '@/lib/prisma'
import {
  getBrokerSummary, getForeignTradingFlow, getDomesticTradingFlow, getStockSummary, toIdxDate,
} from '@/lib/idx-client'

async function ensureTables() {
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
}

function checkAuth(request: NextRequest): boolean {
  const expected = process.env.IDX_SYNC_BEARER_TOKEN
  if (!expected) return false
  const auth = request.headers.get('authorization') ?? ''
  const token = auth.replace(/^Bearer\s+/i, '')
  return token === expected
}

interface SourceResult {
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

async function runStockSummary(date: string): Promise<SourceResult> {
  const start = Date.now()
  try {
    const items = await getStockSummary(date)
    const now = new Date().toISOString()
    for (const item of items) {
      await prisma.$executeRawUnsafe(
        `INSERT INTO "stock_summaries"
           ("id","date","stockCode","stockName","close","volume","value","foreignBuy","foreignSell","createdAt","updatedAt")
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$10)
         ON CONFLICT ("date","stockCode") DO UPDATE SET
           "stockName"   = EXCLUDED."stockName",
           "close"       = EXCLUDED."close",
           "volume"      = EXCLUDED."volume",
           "value"       = EXCLUDED."value",
           "foreignBuy"  = EXCLUDED."foreignBuy",
           "foreignSell" = EXCLUDED."foreignSell",
           "updatedAt"   = EXCLUDED."updatedAt"`,
        randomUUID(), item.date, item.stockCode, item.stockName,
        item.close, item.volume, item.value, item.foreignBuy, item.foreignSell, now,
      )
    }
    return { success: true, count: items.length, durationMs: Date.now() - start }
  } catch (error) {
    return { success: false, count: 0, durationMs: Date.now() - start, error: (error as Error).message }
  }
}

export async function GET(request: NextRequest) {
  if (!checkAuth(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    await ensureTables()

    const { searchParams } = new URL(request.url)
    const now = new Date()
    const date = searchParams.get('date') ?? toIdxDate(now)
    const year = parseInt(searchParams.get('year') ?? '') || now.getFullYear()
    const month = parseInt(searchParams.get('month') ?? '') || now.getMonth() + 1

    // F6 — empat sumber berjalan independen, satu gagal tidak menjalar ke yang lain
    const [broker, foreign, domestic, stock] = await Promise.all([
      runBrokerSummary(date),
      runInvestorFlow('foreign', year, month),
      runInvestorFlow('domestic', year, month),
      runStockSummary(date),
    ])

    const results = { broker, foreign, domestic, stock }
    for (const [name, r] of Object.entries(results)) {
      if (r.success) {
        console.log(`[sync-idx] ${name}: ${r.count} baris, ${r.durationMs}ms`)
      } else {
        console.error(`[sync-idx] ${name} GAGAL: ${r.error}`)
      }
    }

    return NextResponse.json({
      ranAt: now.toISOString(),
      params: { date, year, month },
      results,
    })
  } catch (error) {
    console.error('sync-idx error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
