/**
 * Verifikasi data IDX di database — TANPA panggil API idx.co.id sama sekali (F5, T3).
 *
 * Cara pakai:
 *   node scripts/verify-idx-data.mjs [--date=YYYYMMDD] [--year=YYYY] [--month=M]
 *
 * Mencetak: jumlah baris per sumber, sample baris untuk cek manual nilai (T6).
 */

import fs from 'fs'
import path from 'path'
import { createRequire } from 'module'

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

const require = createRequire(import.meta.url)
const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()

const args = Object.fromEntries(
  process.argv.slice(2).map(a => {
    const [k, v] = a.replace(/^--/, '').split('=')
    return [k, v ?? 'true']
  })
)

const now = new Date()
const date = args.date ?? `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}`
const dateIso = `${date.slice(0, 4)}-${date.slice(4, 6)}-${date.slice(6, 8)}`
const year = parseInt(args.year ?? '') || now.getFullYear()
const month = parseInt(args.month ?? '') || now.getMonth() + 1
const monthPrefix = `${year}-${String(month).padStart(2, '0')}`

async function main() {
  console.log(`Verifikasi DB — date=${dateIso}, month=${monthPrefix}\n(query langsung ke Postgres, tidak ada network call ke idx.co.id)\n`)

  const brokerCount = await prisma.$queryRawUnsafe(
    `SELECT COUNT(*)::int AS count FROM "broker_summaries" WHERE "date" = $1`, dateIso,
  )
  console.log(`broker_summaries (date=${dateIso}) : ${brokerCount[0].count} baris`)

  const brokerSample = await prisma.$queryRawUnsafe(
    `SELECT "brokerCode","brokerName","volume","value","frequency","updatedAt"
     FROM "broker_summaries" WHERE "date" = $1 ORDER BY "value" DESC LIMIT 3`, dateIso,
  )
  for (const r of brokerSample) {
    console.log(`  ${r.brokerCode} (${r.brokerName}) vol=${r.volume} val=${r.value} freq=${r.frequency}`)
  }

  const flowCount = await prisma.$queryRawUnsafe(
    `SELECT "investorType", COUNT(*)::int AS count
     FROM "investor_flows" WHERE "date" LIKE $1 GROUP BY "investorType"`, `${monthPrefix}-%`,
  )
  console.log(`\ninvestor_flows (month=${monthPrefix}):`)
  for (const r of flowCount) {
    console.log(`  ${r.investorType}: ${r.count} baris`)
  }

  const flowSample = await prisma.$queryRawUnsafe(
    `SELECT "date","investorType","buyValue","sellValue","buyVolume","sellVolume","updatedAt"
     FROM "investor_flows" WHERE "date" LIKE $1 ORDER BY "date" ASC LIMIT 6`, `${monthPrefix}-%`,
  )
  for (const r of flowSample) {
    console.log(`  ${r.date} ${r.investorType}: buy=${r.buyValue} sell=${r.sellValue}`)
  }
}

main()
  .catch(e => { console.error('✗ Error:', e.message); process.exitCode = 1 })
  .finally(() => prisma.$disconnect())
