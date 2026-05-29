/**
 * Test query aktivitas user ke database
 * Usage: node scripts/test-activity.mjs [userId]
 */
import path from 'path'
import fs from 'fs'

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

const userId = process.argv[2] || process.env.ADMIN_USER_IDS?.split(',')[0]?.trim()

if (!userId) {
  console.error('Usage: node scripts/test-activity.mjs <userId>')
  process.exit(1)
}

console.log(`\nMengecek aktivitas untuk userId: ${userId}\n`)

// Cek data per tabel
const checks = [
  { name: 'calculations', query: `SELECT COUNT(*) AS cnt FROM "calculations" WHERE "userId" = $1` },
  { name: 'dividends',    query: `SELECT COUNT(*) AS cnt FROM "dividends"    WHERE "userId" = $1` },
  { name: 'portfolios',   query: `SELECT COUNT(*) AS cnt FROM "portfolios"   WHERE "userId" = $1` },
  { name: 'portfolio_journals', query: `SELECT COUNT(*) AS cnt FROM "portfolio_journals" WHERE "userId" = $1` },
  { name: 'portfolio_cash',     query: `SELECT COUNT(*) AS cnt FROM "portfolio_cash"     WHERE "userId" = $1` },
  { name: 'securities',  query: `SELECT COUNT(*) AS cnt FROM "securities"   WHERE "userId" = $1` },
]

console.log('Data per tabel:')
for (const c of checks) {
  try {
    const rows = await prisma.$queryRawUnsafe(c.query, userId)
    const cnt = Number(rows[0].cnt)
    console.log(`  ${cnt > 0 ? '✓' : '○'} ${c.name.padEnd(22)}: ${cnt} record`)
  } catch (e) {
    console.log(`  ✗ ${c.name.padEnd(22)}: ERROR — ${e.message.slice(0, 60)}`)
  }
}

// Test UNION query aktivitas
console.log('\nTest query UNION aktivitas (20 terbaru):')
try {
  const activities = await prisma.$queryRawUnsafe(`
    SELECT * FROM (
      SELECT 'Simulasi' AS type,
             CONCAT('Simulasi saham ', "stockSymbol") AS description,
             "createdAt"::text
      FROM "calculations" WHERE "userId" = $1

      UNION ALL

      SELECT 'Dividen' AS type,
             CONCAT('Dividen ', "saham", ' ', "bulan", ' ', "tahun"::text) AS description,
             "createdAt" FROM "dividends" WHERE "userId" = $1

      UNION ALL

      SELECT 'Portofolio' AS type,
             CONCAT('Portofolio ', "saham", ' | ', "keterangan") AS description,
             "createdAt" FROM "portfolios" WHERE "userId" = $1

      UNION ALL

      SELECT 'Jurnal' AS type,
             CONCAT('Jurnal portofolio | Aset: Rp ', TO_CHAR("totalAset", 'FM999,999,999,999')) AS description,
             "createdAt" FROM "portfolio_journals" WHERE "userId" = $1

      UNION ALL

      SELECT 'Cash' AS type,
             CONCAT('Update cash ', "keterangan") AS description,
             "createdAt" FROM "portfolio_cash" WHERE "userId" = $1

      UNION ALL

      SELECT 'Sekuritas' AS type,
             CONCAT('Tambah sekuritas ', "nama", ' (', "kode", ')') AS description,
             "createdAt" FROM "securities" WHERE "userId" = $1

    ) all_activities
    ORDER BY "createdAt" DESC
    LIMIT 20
  `, userId)

  if (activities.length === 0) {
    console.log('  ○ Tidak ada aktivitas ditemukan untuk user ini')
  } else {
    console.log(`  ✓ ${activities.length} aktivitas berhasil diambil:\n`)
    activities.forEach((a, i) => {
      const tgl = new Date(a.createdAt).toLocaleString('id-ID', { dateStyle: 'short', timeStyle: 'short' })
      console.log(`  ${String(i+1).padStart(2)}. [${a.type.padEnd(10)}] ${a.description.slice(0, 50)} — ${tgl}`)
    })
  }
} catch (e) {
  console.error(`  ✗ UNION query error: ${e.message}`)
}

await prisma.$disconnect()
console.log('\nSelesai.')
