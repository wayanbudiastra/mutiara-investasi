import { unstable_cache } from 'next/cache'
import { prisma } from '@/lib/prisma'

export const CACHE_TAGS = {
  dividenList: (userId: string) => `dividen-list:${userId}`,
} as const

export function getCachedDividens(userId: string) {
  return unstable_cache(
    async () => {
      // ESTIMASI semua + DONE max 500 — sama dengan query API sebelumnya
      return prisma.$queryRawUnsafe(
        `SELECT * FROM "dividends" WHERE "userId" = $1 AND "status" = 'ESTIMASI'
         UNION ALL
         SELECT * FROM (
           SELECT * FROM "dividends" WHERE "userId" = $1 AND "status" = 'DONE'
           ORDER BY "tahun" DESC, "createdAt" DESC LIMIT 500
         ) done_rows
         ORDER BY "tahun" DESC, "createdAt" DESC`,
        userId
      )
    },
    [CACHE_TAGS.dividenList(userId)],
    {
      tags:       [CACHE_TAGS.dividenList(userId)],
      revalidate: false, // hanya invalid saat mutasi
    }
  )()
}
