import { unstable_cache } from 'next/cache'
import { prisma } from '@/lib/prisma'

export interface InvestorFlowSide {
  buyValue: number
  sellValue: number
  buyVolume: number
  sellVolume: number
  buyFrequency: number
  sellFrequency: number
}

export interface InvestorFlowResult {
  date: string
  foreign: InvestorFlowSide | null
  domestic: InvestorFlowSide | null
}

async function fetchInvestorFlow(date: string): Promise<InvestorFlowResult> {
  const rows = await prisma.$queryRawUnsafe<{
    investorType: string
    buyValue: number; sellValue: number
    buyVolume: number; sellVolume: number
    buyFrequency: number; sellFrequency: number
  }[]>(
    `SELECT "investorType",
            "buyValue"::float8 AS "buyValue", "sellValue"::float8 AS "sellValue",
            "buyVolume"::float8 AS "buyVolume", "sellVolume"::float8 AS "sellVolume",
            "buyFrequency"::float8 AS "buyFrequency", "sellFrequency"::float8 AS "sellFrequency"
     FROM "investor_flows" WHERE "date" = $1`,
    date,
  )

  const byType = new Map(rows.map(r => [r.investorType, r]))
  const toSide = (r: typeof rows[number] | undefined): InvestorFlowSide | null =>
    r ? {
      buyValue: r.buyValue, sellValue: r.sellValue,
      buyVolume: r.buyVolume, sellVolume: r.sellVolume,
      buyFrequency: r.buyFrequency, sellFrequency: r.sellFrequency,
    } : null

  return {
    date,
    foreign: toSide(byType.get('FOREIGN')),
    domestic: toSide(byType.get('DOMESTIC')),
  }
}

/** Cache per tanggal — data immutable setelah hari itu selesai sinkron. */
export function getCachedInvestorFlow(date: string) {
  return unstable_cache(
    () => fetchInvestorFlow(date),
    [`investor-flow:${date}`],
    { tags: [`investor-flow:${date}`], revalidate: false },
  )()
}

/**
 * investor_flows disinkron per bulan, sedangkan tanggal yang dipilih user berasal dari
 * broker_summaries/stock_summaries (harian) — bisa lebih baru daripada bulan terakhir yang
 * tersedia di investor_flows (mis. bulan berjalan belum dipublikasikan IDX, lihat
 * prd/testing_koneksi_idx_report.md §3.1). Gunakan ini untuk tahu tanggal fallback yang valid.
 */
export async function getLatestInvestorFlowDate(): Promise<string | null> {
  const rows = await prisma.$queryRawUnsafe<{ date: string | null }[]>(
    `SELECT MAX("date") AS date FROM "investor_flows"`,
  )
  return rows[0]?.date ?? null
}
