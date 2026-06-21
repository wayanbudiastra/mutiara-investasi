import { unstable_cache } from 'next/cache'
import { prisma } from '@/lib/prisma'

const METRIC_COLUMN = { value: 'value', volume: 'volume', frequency: 'frequency' } as const
export type BrokerMetric = keyof typeof METRIC_COLUMN
export const VALID_METRICS: BrokerMetric[] = ['value', 'volume', 'frequency']

export interface BrokerTopItem {
  brokerCode: string
  brokerName: string
  volume: number
  value: number
  frequency: number
  share: number
}

export interface BrokerTopResult {
  date: string
  metric: BrokerMetric
  total: number
  data: BrokerTopItem[]
}

async function fetchBrokerTop(date: string, metric: BrokerMetric, limit: number): Promise<BrokerTopResult> {
  const column = METRIC_COLUMN[metric]

  const totalRows = await prisma.$queryRawUnsafe<{ total: number | null }[]>(
    `SELECT SUM("${column}")::float8 AS total FROM "broker_summaries" WHERE "date" = $1`,
    date,
  )
  const total = totalRows[0]?.total ?? 0

  const rows = await prisma.$queryRawUnsafe<{
    brokerCode: string; brokerName: string; volume: number; value: number; frequency: number
  }[]>(
    `SELECT "brokerCode","brokerName","volume"::float8 AS volume,"value"::float8 AS value,"frequency"
     FROM "broker_summaries" WHERE "date" = $1
     ORDER BY "${column}" DESC LIMIT $2`,
    date, limit,
  )

  const data: BrokerTopItem[] = rows.map(r => ({
    brokerCode: r.brokerCode,
    brokerName: r.brokerName,
    volume: r.volume,
    value: r.value,
    frequency: r.frequency,
    share: total > 0 ? parseFloat(((r[metric] / total) * 100).toFixed(2)) : 0,
  }))

  return { date, metric, total, data }
}

/** Cache per (date, metric, limit) — data immutable setelah hari itu selesai sinkron. */
export function getCachedBrokerTop(date: string, metric: BrokerMetric, limit: number) {
  return unstable_cache(
    () => fetchBrokerTop(date, metric, limit),
    [`brokers-top:${date}:${metric}:${limit}`],
    { tags: [`brokers-top:${date}`], revalidate: false },
  )()
}

export async function getLatestBrokerDate(): Promise<string | null> {
  const rows = await prisma.$queryRawUnsafe<{ date: string | null }[]>(
    `SELECT MAX("date") AS date FROM "broker_summaries"`,
  )
  return rows[0]?.date ?? null
}
