import { unstable_cache } from 'next/cache'
import { prisma } from '@/lib/prisma'

/** Jika nonRegularVolume melebihi rasio ini terhadap volume, estimasi net value dianggap kurang bisa diandalkan. */
const HIGH_NON_REGULAR_RATIO = 0.2

function isHighNonRegular(nonRegularVolume: number, volume: number): boolean {
  return volume > 0 && nonRegularVolume / volume > HIGH_NON_REGULAR_RATIO
}

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
  /** true jika nonRegularVolume (block trade/negosiasi) signifikan — estimasi di atas kurang bisa diandalkan. */
  highNonRegular: boolean
}

async function fetchStockForeign(date: string, stockCode: string): Promise<StockForeignResult | null> {
  const rows = await prisma.$queryRawUnsafe<{
    stockName: string; close: number; volume: number; value: number
    foreignBuy: number; foreignSell: number; nonRegularVolume: number
  }[]>(
    `SELECT "stockName","close"::float8 AS close,"volume"::float8 AS volume,"value"::float8 AS value,
            "foreignBuy"::float8 AS "foreignBuy","foreignSell"::float8 AS "foreignSell",
            "nonRegularVolume"::float8 AS "nonRegularVolume"
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
    highNonRegular: isHighNonRegular(r.nonRegularVolume, r.volume),
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

/** Riwayat net asing N hari terakhir (hari yang sudah tersinkron) untuk satu saham, terbaru dulu. */
export async function getStockForeignHistory(stockCode: string, days: number): Promise<StockForeignResult[]> {
  const rows = await prisma.$queryRawUnsafe<{
    date: string; stockName: string; close: number; volume: number; value: number
    foreignBuy: number; foreignSell: number; nonRegularVolume: number
  }[]>(
    `SELECT "date","stockName","close"::float8 AS close,"volume"::float8 AS volume,"value"::float8 AS value,
            "foreignBuy"::float8 AS "foreignBuy","foreignSell"::float8 AS "foreignSell",
            "nonRegularVolume"::float8 AS "nonRegularVolume"
     FROM "stock_summaries" WHERE "stockCode" = $1
     ORDER BY "date" DESC LIMIT $2`,
    stockCode, days,
  )

  return rows.map(r => {
    const netForeignVolume = r.foreignBuy - r.foreignSell
    return {
      date: r.date,
      stockCode,
      stockName: r.stockName,
      close: r.close,
      volume: r.volume,
      value: r.value,
      foreignBuy: r.foreignBuy,
      foreignSell: r.foreignSell,
      netForeignVolume,
      estimatedNetForeignValue: netForeignVolume * r.close,
      highNonRegular: isHighNonRegular(r.nonRegularVolume, r.volume),
    }
  })
}

export interface TopForeignBuyItem {
  stockCode: string
  stockName: string
  close: number
  value: number
  volume: number
  frequency: number
  foreignBuy: number
  foreignSell: number
  netForeignVolume: number
  /** Estimasi — net volume asing × harga penutupan, BUKAN nilai transaksi asing presisi. */
  estimatedNetForeignValue: number
  /** true jika nonRegularVolume (block trade/negosiasi) signifikan — estimasi di atas kurang bisa diandalkan. */
  highNonRegular: boolean
}

/**
 * Ranking ala "Net Foreign Buy" Stockbit — diurutkan berdasarkan ESTIMASI nilai net beli
 * asing (Rupiah), bukan volume mentah, dan hanya net buyer (foreignBuy > foreignSell).
 */
async function fetchTopForeignBuy(date: string, limit: number): Promise<TopForeignBuyItem[]> {
  const rows = await prisma.$queryRawUnsafe<{
    stockCode: string; stockName: string; close: number
    value: number; volume: number; frequency: number
    foreignBuy: number; foreignSell: number; nonRegularVolume: number
  }[]>(
    `SELECT "stockCode","stockName","close"::float8 AS close,
            "value"::float8 AS value,"volume"::float8 AS volume,"frequency",
            "foreignBuy"::float8 AS "foreignBuy","foreignSell"::float8 AS "foreignSell",
            "nonRegularVolume"::float8 AS "nonRegularVolume"
     FROM "stock_summaries"
     WHERE "date" = $1 AND "foreignBuy" > "foreignSell"
     ORDER BY ("foreignBuy" - "foreignSell") * "close" DESC LIMIT $2`,
    date, limit,
  )

  return rows.map(r => {
    const netForeignVolume = r.foreignBuy - r.foreignSell
    return {
      stockCode: r.stockCode,
      stockName: r.stockName,
      close: r.close,
      value: r.value,
      volume: r.volume,
      frequency: r.frequency,
      foreignBuy: r.foreignBuy,
      foreignSell: r.foreignSell,
      netForeignVolume,
      estimatedNetForeignValue: netForeignVolume * r.close,
      highNonRegular: isHighNonRegular(r.nonRegularVolume, r.volume),
    }
  })
}

/** Ranking saham dengan volume Foreign Buy terbesar pada satu tanggal — cache per (date, limit). */
export function getCachedTopForeignBuy(date: string, limit: number) {
  return unstable_cache(
    () => fetchTopForeignBuy(date, limit),
    [`top-foreign-buy:${date}:${limit}`],
    { tags: [`top-foreign-buy:${date}`], revalidate: false },
  )()
}
