/**
 * Buat semua tabel raw SQL (non-Prisma) di PostgreSQL.
 * Dijalankan otomatis saat build: npm run db:migrate-raw
 */

import path from 'path'
import fs from 'fs'

// Load .env.local jika ada (development)
const envPath = path.resolve(
  path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Z]:)/, '$1')),
  '../.env.local'
)
if (fs.existsSync(envPath)) {
  for (const line of fs.readFileSync(envPath, 'utf-8').split('\n')) {
    const t = line.trim()
    if (!t || t.startsWith('#')) continue
    const eq = t.indexOf('=')
    if (eq === -1) continue
    const key = t.slice(0, eq).trim()
    const val = t.slice(eq + 1).trim().replace(/^['"]|['"]$/g, '')
    if (!process.env[key]) process.env[key] = val
  }
}

const { createRequire } = await import('module')
const require = createRequire(import.meta.url)
const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()

const tables = [
  {
    name: 'securities',
    sql: `
      CREATE TABLE IF NOT EXISTS "securities" (
        "id"        TEXT NOT NULL PRIMARY KEY,
        "userId"    TEXT NOT NULL,
        "nama"      TEXT NOT NULL,
        "kode"      TEXT NOT NULL,
        "status"    TEXT NOT NULL DEFAULT 'ACTIVE',
        "createdAt" TEXT NOT NULL,
        "updatedAt" TEXT NOT NULL
      )`,
  },
  {
    name: 'dividends',
    sql: `
      CREATE TABLE IF NOT EXISTS "dividends" (
        "id"         TEXT NOT NULL PRIMARY KEY,
        "userId"     TEXT NOT NULL,
        "bulan"      TEXT NOT NULL,
        "tahun"      INTEGER NOT NULL,
        "saham"      TEXT NOT NULL,
        "dividen"    DOUBLE PRECISION NOT NULL,
        "lot"        INTEGER NOT NULL,
        "total"      DOUBLE PRECISION NOT NULL,
        "keterangan" TEXT NOT NULL,
        "status"     TEXT NOT NULL DEFAULT 'ESTIMASI',
        "createdAt"  TEXT NOT NULL,
        "updatedAt"  TEXT NOT NULL
      )`,
  },
  {
    name: 'portfolios',
    sql: `
      CREATE TABLE IF NOT EXISTS "portfolios" (
        "id"         TEXT NOT NULL PRIMARY KEY,
        "userId"     TEXT NOT NULL,
        "keterangan" TEXT NOT NULL,
        "saham"      TEXT NOT NULL,
        "hargaRata"  DOUBLE PRECISION NOT NULL,
        "lot"        INTEGER NOT NULL,
        "createdAt"  TEXT NOT NULL,
        "updatedAt"  TEXT NOT NULL
      )`,
  },
  {
    name: 'portfolio_journals',
    sql: `
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
      )`,
  },
  {
    name: 'password_reset_tokens',
    sql: `
      CREATE TABLE IF NOT EXISTS "password_reset_tokens" (
        "id"        TEXT NOT NULL PRIMARY KEY,
        "userId"    TEXT NOT NULL,
        "token"     TEXT NOT NULL UNIQUE,
        "expiredAt" TEXT NOT NULL,
        "usedAt"    TEXT,
        "createdAt" TEXT NOT NULL
      )`,
  },
  {
    name: 'subscriptions',
    sql: `
      CREATE TABLE IF NOT EXISTS "subscriptions" (
        "id"        TEXT NOT NULL PRIMARY KEY,
        "userId"    TEXT NOT NULL,
        "plan"      TEXT NOT NULL,
        "status"    TEXT NOT NULL DEFAULT 'PENDING',
        "startedAt" TEXT NOT NULL,
        "expiredAt" TEXT NOT NULL,
        "createdAt" TEXT NOT NULL,
        "updatedAt" TEXT NOT NULL
      )`,
  },
  {
    name: 'payments',
    sql: `
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
      )`,
  },
]

// Kolom tambahan (ALTER TABLE — aman jika sudah ada)
const alterations = [
  `ALTER TABLE "subscriptions" ADD COLUMN IF NOT EXISTS "grantedBy" TEXT`,
  `ALTER TABLE "subscriptions" ADD COLUMN IF NOT EXISTS "grantNote" TEXT`,
  `ALTER TABLE "subscriptions" ADD COLUMN IF NOT EXISTS "isGranted" BOOLEAN NOT NULL DEFAULT FALSE`,
  `ALTER TABLE "portfolios" ADD COLUMN IF NOT EXISTS "lastPrice" DOUBLE PRECISION`,
  `ALTER TABLE "portfolios" ADD COLUMN IF NOT EXISTS "lastPriceAt" TEXT`,
]

async function run() {
  console.log('Membuat tabel raw SQL...\n')
  try {
    for (const t of tables) {
      await prisma.$executeRawUnsafe(t.sql)
      console.log(`  ✓ ${t.name}`)
    }
    console.log('\nMenambah kolom baru...')
    for (const sql of alterations) {
      await prisma.$executeRawUnsafe(sql)
      console.log(`  ✓ ${sql.split('ADD COLUMN IF NOT EXISTS')[1]?.trim().split(' ')[0]}`)
    }
    console.log('\nSemua tabel berhasil dibuat.')
  } catch (err) {
    console.error('Error:', err.message)
    process.exit(1)
  } finally {
    await prisma.$disconnect()
  }
}

run()
