import { unstable_cache } from 'next/cache'
import { prisma } from '@/lib/prisma'

export interface StockForeignResult {
  date: string
  stockCode: string
  stockName: string | null
  close: number
  volume: number
  value: number
  foreignBuy: number
  foreignSell: number
  netForeignVolume: number
  /** Estimasi — net volume asing × harga penutupan, BUKAN nilai transaksi asing presisi. */
  estimatedNetForeignValue: number
}

async function fetchStockForeign(date: string, stockCode: string): Promise<StockForeignResult | null> {
  const rows = await prisma.$queryRawUnsafe<{
    stockName: string; close: number; volume: number; value: number
    foreignBuy: number; foreignSell: number
  }[]>(
    `SELECT "stockName","close"::float8 AS close,"volume"::float8 AS volume,"value"::float8 AS value,
            "foreignBuy"::float8 AS "foreignBuy","foreignSell"::float8 AS "foreignSell"
     FROM "stock_summaries" WHERE "date" = $1 AND "stockCode" = $2`,
    date, stockCode,
  )
  if (rows.length === 0) return null

  const r = rows[0]
  const netForeignVolume = r.foreignBuy - r.foreignSell
  return {
    date,
    stockCode,
    stockName: r.stockName,
    close: r.close,
    volume: r.volume,
    value: r.value,
    foreignBuy: r.foreignBuy,
    foreignSell: r.foreignSell,
    netForeignVolume,
    estimatedNetForeignValue: netForeignVolume * r.close,
  }
}

/** Cache per (date, stockCode) — data immutable setelah hari itu selesai sinkron. */
export function getCachedStockForeign(date: string, stockCode: string) {
  return unstable_cache(
    () => fetchStockForeign(date, stockCode),
    [`stock-foreign:${date}:${stockCode}`],
    { tags: [`stock-foreign:${date}`], revalidate: false },
  )()
}
