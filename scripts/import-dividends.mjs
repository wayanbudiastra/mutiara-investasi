/**
 * Script import data dividen dari CSV (export Google Sheets — tanpa baris header)
 *
 * Cara pakai:
 *   1. Di Google Sheets: File > Download > Comma Separated Values (.csv)
 *   2. Simpan file CSV ke folder scripts/ (misal: scripts/dividen.csv)
 *   3. Jalankan: node scripts/import-dividends.mjs scripts/dividen.csv
 *
 * Urutan kolom yang diharapkan (sesuai sheet):
 *   A=Bulan  B=Tahun  C=Saham  D=Dividen/Lembar  E=Lot  F=Total  G=Keterangan  H=Status
 */

import fs from 'fs'
import path from 'path'
import { createRequire } from 'module'
import { randomUUID } from 'crypto'

// Load .env.local (Next.js tidak otomatis expose ke script Node biasa)
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
  console.log('✓ .env.local dimuat')
} else {
  console.warn('⚠ .env.local tidak ditemukan')
}

const require = createRequire(import.meta.url)
const { PrismaClient } = require('@prisma/client')

// ─── KONFIGURASI ────────────────────────────────────────────────────────────

const USER_EMAIL = 'wayan.budiastra07@gmail.com'
const USER_ID    = 'cmo8gr6wg000013555943rxay'

// Indeks kolom (0-based), sesuai urutan kolom di sheet:
// A=0, B=1, C=2, D=3, E=4, F=5, G=6, H=7
const COL = {
  bulan:      0,  // A — Bulan
  tahun:      1,  // B — Tahun
  saham:      2,  // C — Saham
  dividen:    3,  // D — Dividen per lembar
  lot:        4,  // E — Lot
  total:      5,  // F — Total
  keterangan: 6,  // G — Keterangan (nama akun sekuritas)
  status:     7,  // H — Status (DONE / ESTIMASI)
}

// Separator CSV: ',' standar, ';' untuk Excel Indonesia
const CSV_SEPARATOR = ','

// ─────────────────────────────────────────────────────────────────────────────

const MONTHS = [
  'Januari','Februari','Maret','April','Mei','Juni',
  'Juli','Agustus','September','Oktober','November','Desember',
]

function parseCSVNoHeader(content, sep) {
  const rows = []
  for (const raw of content.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n')) {
    const line = raw.trim()
    if (!line) continue
    const fields = []
    let inQuote = false, cur = ''
    for (const ch of line + sep) {
      if (ch === '"') { inQuote = !inQuote }
      else if (ch === sep && !inQuote) { fields.push(cur.trim()); cur = '' }
      else { cur += ch }
    }
    rows.push(fields)
  }
  return rows
}

function cleanNumber(val) {
  if (!val) return 0
  return parseFloat(
    String(val).replace(/Rp\s*/gi, '').replace(/\./g, '').replace(',', '.').trim()
  ) || 0
}

function normalizeBulan(val) {
  if (!val) return 'Januari'
  const lower = String(val).trim().toLowerCase()
  return MONTHS.find(m => m.toLowerCase() === lower) ?? String(val).trim()
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
    const userId = USER_ID
    console.log(`\n✓ User: ${USER_EMAIL}`)
    console.log(`  userId: ${userId}`)

    // Load sekuritas untuk validasi keterangan
    console.log(`\nMemuat daftar sekuritas...`)
    const secRows = await prisma.$queryRawUnsafe(
      `SELECT id, nama FROM securities WHERE "userId" = $1`, userId
    )
    const securitiesMap = {}
    secRows.forEach(s => { securitiesMap[s.nama.toUpperCase().trim()] = s })
    console.log(`✓ ${secRows.length} sekuritas ditemukan:`)
    secRows.forEach(s => console.log(`   - ${s.nama}`))

    // Parse CSV (tanpa header)
    const content = fs.readFileSync(fullPath, 'utf-8')
    const rows = parseCSVNoHeader(content, CSV_SEPARATOR)
    console.log(`\nTotal baris CSV: ${rows.length}`)

    // Tampilkan preview 3 baris pertama untuk verifikasi mapping
    console.log('\nPreview 3 baris pertama:')
    rows.slice(0, 3).forEach((r, i) => {
      console.log(`  Baris ${i + 1}: Bulan="${r[COL.bulan]}" | Tahun="${r[COL.tahun]}" | Saham="${r[COL.saham]}" | Dividen="${r[COL.dividen]}" | Lot="${r[COL.lot]}" | Total="${r[COL.total]}" | Ket="${r[COL.keterangan]}" | Status="${r[COL.status]}"`)
    })

    // Ensure tabel dividends ada
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

    let inserted = 0
    let skipped = 0
    const errors = []

    console.log('\nMemproses baris...')
    for (let i = 0; i < rows.length; i++) {
      const fields = rows[i]
      const rowNum = i + 1

      const rawBulan    = normalizeBulan(fields[COL.bulan])
      const rawTahun    = parseInt(fields[COL.tahun]) || 0
      const rawSaham    = (fields[COL.saham] ?? '').toUpperCase().trim()
      const rawDividen  = cleanNumber(fields[COL.dividen])
      const rawLot      = parseInt(String(fields[COL.lot]).replace(/[^0-9]/g, '')) || 0
      const rawTotal    = cleanNumber(fields[COL.total]) || rawDividen * rawLot * 100
      const rawKet      = (fields[COL.keterangan] ?? '').toUpperCase().trim()
      const rawStatusRaw = (fields[COL.status] ?? 'DONE').toUpperCase().trim()
      const status      = rawStatusRaw === 'DONE' ? 'DONE' : 'ESTIMASI'

      // Validasi wajib
      if (!rawKet || !rawTahun || !rawSaham) {
        skipped++
        console.warn(`  ⚠ Baris ${rowNum} dilewati — data tidak lengkap`)
        continue
      }

      // Validasi keterangan terhadap sekuritas terdaftar
      if (!securitiesMap[rawKet]) {
        errors.push(`Baris ${rowNum}: "${rawKet}" tidak cocok sekuritas`)
        console.warn(`  ✗ Baris ${rowNum} — keterangan "${rawKet}" tidak ada di daftar sekuritas`)
        skipped++
        continue
      }

      const id  = randomUUID()
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

    console.log(`\n${'─'.repeat(55)}`)
    console.log(`Import selesai:`)
    console.log(`  ✓ Berhasil diimpor : ${inserted} baris`)
    console.log(`  ⚠ Dilewati        : ${skipped} baris`)

    if (errors.length) {
      console.log(`\nKeterangan tidak cocok — pastikan nama persis sama dengan sekuritas:`)
      secRows.forEach(s => console.log(`  → "${s.nama}"`))
      console.log(`\nDetail:`)
      errors.forEach(e => console.log(`  - ${e}`))
    }

  } finally {
    await prisma.$disconnect()
  }
}

main().catch(err => {
  console.error('Error:', err.message)
  process.exit(1)
})
