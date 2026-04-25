import { prisma } from './prisma'

// Set PRO_ENABLED=false di .env.local untuk membuka semua fitur gratis (mode free)
// Set PRO_ENABLED=true untuk mengaktifkan paywall
const PRO_ENABLED = process.env.PRO_ENABLED === 'true'

const ADMIN_IDS = (process.env.ADMIN_USER_IDS ?? '')
  .split(',').map(s => s.trim()).filter(Boolean)

export async function ensureTables() {
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "subscriptions" (
      "id"        TEXT NOT NULL PRIMARY KEY,
      "userId"    TEXT NOT NULL,
      "plan"      TEXT NOT NULL,
      "status"    TEXT NOT NULL DEFAULT 'PENDING',
      "startedAt" TEXT NOT NULL,
      "expiredAt" TEXT NOT NULL,
      "createdAt" TEXT NOT NULL,
      "updatedAt" TEXT NOT NULL
    )
  `)
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "payments" (
      "id"             TEXT NOT NULL PRIMARY KEY,
      "userId"         TEXT NOT NULL,
      "subscriptionId" TEXT NOT NULL,
      "orderId"        TEXT NOT NULL UNIQUE,
      "amount"         INTEGER NOT NULL,
      "status"         TEXT NOT NULL DEFAULT 'PENDING',
      "midtransToken"  TEXT,
      "midtransTxId"   TEXT,
      "createdAt"      TEXT NOT NULL,
      "updatedAt"      TEXT NOT NULL
    )
  `)
}

export type ProAccessResult =
  | { hasAccess: true;  isAdmin: true;  expiredAt?: undefined }
  | { hasAccess: true;  isAdmin: false; expiredAt: string }
  | { hasAccess: false; isAdmin: false; expiredAt?: undefined }

export async function checkProAccess(userId: string): Promise<ProAccessResult> {
  // Selalu pastikan tabel ada — diperlukan untuk fitur subscription meski PRO_ENABLED=false
  await ensureTables()

  // Mode free: semua user mendapat akses tanpa perlu berlangganan
  if (!PRO_ENABLED) {
    return ADMIN_IDS.includes(userId)
      ? { hasAccess: true, isAdmin: true }
      : { hasAccess: true, isAdmin: false, expiredAt: '2099-12-31T00:00:00.000Z' }
  }

  if (ADMIN_IDS.includes(userId)) {
    return { hasAccess: true, isAdmin: true }
  }

  const rows = await prisma.$queryRawUnsafe<{ expiredAt: string }[]>(
    `SELECT "expiredAt" FROM "subscriptions"
     WHERE "userId" = $1 AND "status" = 'ACTIVE' AND "expiredAt" > $2
     ORDER BY "expiredAt" DESC LIMIT 1`,
    userId,
    new Date().toISOString()
  )

  if (rows.length > 0) {
    return { hasAccess: true, isAdmin: false, expiredAt: rows[0].expiredAt }
  }

  return { hasAccess: false, isAdmin: false }
}

export const PLANS = [
  { id: 'MONTHLY',   label: 'Bulanan',   months: 1,  price: 15000,  priceLabel: 'Rp 15.000' },
  { id: 'QUARTERLY', label: 'Kuartalan', months: 3,  price: 35000,  priceLabel: 'Rp 35.000' },
  { id: 'SEMESTER',  label: 'Semester',  months: 6,  price: 55000,  priceLabel: 'Rp 55.000' },
  { id: 'YEARLY',    label: 'Tahunan',   months: 12, price: 100000, priceLabel: 'Rp 100.000' },
] as const

export type PlanId = typeof PLANS[number]['id']
