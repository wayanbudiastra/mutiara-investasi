/**
 * Script import data dividen dari CSV (export Google Sheets)
 *
 * Cara pakai:
 *   1. Di Google Sheets: File > Download > Comma Separated Values (.csv)
 *   2. Simpan file CSV ke folder scripts/ (misal: scripts/dividen.csv)
 *   3. Sesuaikan COLUMN_MAP di bawah dengan nama kolom di CSV Anda
 *   4. Jalankan: node scripts/import-dividends.mjs scripts/dividen.csv
 */

import fs from 'fs'
import path from 'path'
import { createRequire } from 'module'
import { randomUUID } from 'crypto'

// Load .env.local (Next.js tidak otomatis expose ke script Node biasa)
const envPath = path.resolve(path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Z]:)/, '$1')), '../.env.local')
if (fs.existsSync(envPath)) {
  const lines = fs.readFileSync(envPath, 'utf-8').split('\n')
  for (const line of lines) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const eq = trimmed.indexOf('=')
    if (eq === -1) continue
    const key = trimmed.slice(0, eq).trim()
    const val = trimmed.slice(eq + 1).trim().replace(/^['"]|['"]$/g, '')
    if (!process.env[key]) process.env[key] = val
  }
  console.log('✓ .env.local dimuat')
} else {
  console.warn('⚠ .env.local tidak ditemukan, pastikan DATABASE_URL sudah di-set')
}

const require = createRequire(import.meta.url)
const { PrismaClient } = require('@prisma/client')

// ─── KONFIGURASI ────────────────────────────────────────────────────────────

// Email akun yang akan menjadi pemilik data
const USER_EMAIL = 'wayan.budiastra07@gmail.com'
const USER_ID    = 'cmo8gr6wg000013555943rxay' // hardcoded, skip DB lookup

// Mapping nama kolom CSV → field database
// Sesuaikan dengan header kolom di file CSV Anda
const COLUMN_MAP = {
  bulan:   'Bulan',           // nama kolom untuk bulan (Januari, Februari, dst)
  tahun:   'Tahun',           // nama kolom untuk tahun (2024, 2025)
  saham:   'Saham',           // nama kolom untuk kode saham (BBCA, TLKM, dst)
  dividen: 'Dividen/Lembar',  // nama kolom untuk dividen per lembar (Rp)
  lot:     'Lot',             // nama kolom untuk jumlah lot
  total:   'Total',           // nama kolom untuk total dividen (boleh dikosongkan, akan dihitung)
  keterangan: 'Keterangan',   // nama kolom untuk nama akun sekuritas (STOCKBIT BUDI, IPOT MEI, dst)
  status:  'Status',          // nama kolom untuk status (DONE / ESTIMASI) — opsional
}

// Separator CSV: ',' untuk standar, ';' untuk export dari Excel Indonesia
const CSV_SEPARATOR = ','

// ─────────────────────────────────────────────────────────────────────────────

const MONTHS = [
  'Januari','Februari','Maret','April','Mei','Juni',
  'Juli','Agustus','September','Oktober','November','Desember',
]

function parseCSV(content, sep) {
  const lines = content.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n')
  const headers = lines[0].split(sep).map(h => h.trim().replace(/^"|"$/g, ''))
  const rows = []
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim()
    if (!line) continue
    // handle quoted fields
    const fields = []
    let inQuote = false, cur = ''
    for (const ch of line + sep) {
      if (ch === '"') { inQuote = !inQuote }
      else if (ch === sep && !inQuote) { fields.push(cur.trim()); cur = '' }
      else { cur += ch }
    }
    if (fields.length !== headers.length) continue
    const row = {}
    headers.forEach((h, i) => { row[h] = fields[i] })
    rows.push(row)
  }
  return rows
}

function cleanNumber(val) {
  if (!val) return 0
  // hapus "Rp", titik ribuan, spasi, lalu ganti koma desimal → titik
  return parseFloat(
    String(val).replace(/Rp\s*/gi, '').replace(/\./g, '').replace(',', '.').trim()
  ) || 0
}

function normalizeBulan(val) {
  if (!val) return 'Januari'
  const lower = String(val).trim().toLowerCase()
  const found = MONTHS.find(m => m.toLowerCase() === lower)
  return found ?? String(val).trim()
}

async function main() {
  const csvPath = process.argv[2]
  if (!csvPath) {
    console.error('Usage: node scripts/import-dividends.mjs <path-to-csv>')
    process.exit(1)
  }

  const fullPath = path.resolve(csvPath)
  if (!fs.existsSync(fullPath)) {
    console.error(`File tidak ditemukan: ${fullPath}`)
    process.exit(1)
  }

  const prisma = new PrismaClient()

  try {
    // 1. Gunakan userId langsung (sudah diketahui)
    const userId = USER_ID
    console.log(`\n✓ User: ${USER_EMAIL}`)
    console.log(`  userId: ${userId}`)

    // 2. Load daftar sekuritas user (untuk validasi keterangan)
    console.log(`\nMemuat daftar sekuritas...`)
    const secRows = await prisma.$queryRawUnsafe(
      `SELECT id, nama FROM securities WHERE "userId" = $1`, userId
    )
    const securitiesMap = {}
    secRows.forEach(s => {
      // normalize: uppercase, trim
      securitiesMap[s.nama.toUpperCase().trim()] = s
    })
    console.log(`✓ ${secRows.length} sekuritas ditemukan:`)
    secRows.forEach(s => console.log(`   - ${s.nama}`))

    // 3. Parse CSV
    const content = fs.readFileSync(fullPath, 'utf-8')
    const rows = parseCSV(content, CSV_SEPARATOR)
    console.log(`\nTotal baris CSV: ${rows.length}`)

    // 4. Ensure dividends table exists
    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS "dividends" (
        "id" TEXT NOT NULL PRIMARY KEY,
        "userId" TEXT NOT NULL,
        "bulan" TEXT NOT NULL,
        "tahun" INTEGER NOT NULL,
        "saham" TEXT NOT NULL,
        "dividen" DOUBLE PRECISION NOT NULL,
        "lot" INTEGER NOT NULL,
        "total" DOUBLE PRECISION NOT NULL,
        "keterangan" TEXT NOT NULL,
        "status" TEXT NOT NULL DEFAULT 'ESTIMASI',
        "createdAt" TEXT NOT NULL,
        "updatedAt" TEXT NOT NULL
      )
    `)

    // 5. Import baris per baris
    let inserted = 0
    let skipped = 0
    const errors = []

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i]
      const rowNum = i + 2 // +2 karena baris 1 = header

      const rawKet = (row[COLUMN_MAP.keterangan] ?? '').toUpperCase().trim()
      const rawBulan = normalizeBulan(row[COLUMN_MAP.bulan])
      const rawTahun = parseInt(row[COLUMN_MAP.tahun]) || 0
      const rawSaham = (row[COLUMN_MAP.saham] ?? '').toUpperCase().trim()
      const rawDividen = cleanNumber(row[COLUMN_MAP.dividen])
      const rawLot = parseInt(cleanNumber(row[COLUMN_MAP.lot])) || 0
      const rawTotal = cleanNumber(row[COLUMN_MAP.total]) || rawDividen * rawLot * 100
      const rawStatus = ((row[COLUMN_MAP.status] ?? 'DONE')).toUpperCase().trim()
      const status = rawStatus === 'DONE' ? 'DONE' : 'ESTIMASI'

      // Validasi wajib
      if (!rawKet || !rawTahun || !rawSaham) {
        skipped++
        console.warn(`  ⚠ Baris ${rowNum} dilewati — data tidak lengkap (keterangan/tahun/saham kosong)`)
        continue
      }

      // Validasi keterangan terhadap securities
      if (!securitiesMap[rawKet]) {
        errors.push(`Baris ${rowNum}: keterangan "${rawKet}" tidak cocok dengan sekuritas terdaftar`)
        console.warn(`  ✗ Baris ${rowNum} — keterangan "${rawKet}" tidak ada di daftar sekuritas`)
        skipped++
        continue
      }

      const id = randomUUID()
      const now = new Date().toISOString()

      await prisma.$executeRawUnsafe(
        `INSERT INTO "dividends" ("id","userId","bulan","tahun","saham","dividen","lot","total","keterangan","status","createdAt","updatedAt")
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)`,
        id, userId,
        rawBulan, rawTahun, rawSaham,
        rawDividen, rawLot, rawTotal,
        rawKet, status,
        now, now
      )
      inserted++
      console.log(`  ✓ Baris ${rowNum} — ${rawBulan} ${rawTahun} | ${rawSaham} | ${rawKet} | Rp ${rawTotal.toLocaleString('id-ID')} | ${status}`)
    }

    console.log(`\n${'─'.repeat(50)}`)
    console.log(`Import selesai:`)
    console.log(`  ✓ Berhasil diimpor : ${inserted} baris`)
    console.log(`  ⚠ Dilewati        : ${skipped} baris`)
    if (errors.length) {
      console.log(`\nDetail error keterangan tidak cocok:`)
      errors.forEach(e => console.log(`  - ${e}`))
      console.log(`\nPastikan nilai kolom Keterangan di CSV cocok (case-insensitive) dengan nama sekuritas berikut:`)
      secRows.forEach(s => console.log(`  → "${s.nama}"`))
    }

  } finally {
    await prisma.$disconnect()
  }
}

main().catch(err => {
  console.error('Error:', err.message)
  process.exit(1)
})
