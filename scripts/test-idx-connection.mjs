/**
 * Trigger manual sync IDX (broker summary + foreign/domestic flow) — F1.
 *
 * Cara pakai:
 *   node scripts/test-idx-connection.mjs [--date=YYYYMMDD] [--year=YYYY] [--month=M] [--base=http://localhost:3000]
 *
 * Memanggil route /api/cron/sync-idx dengan bearer token dari .env.local (IDX_SYNC_BEARER_TOKEN),
 * lalu mencetak ringkasan jumlah baris tersimpan & error per sumber (F4).
 */

import fs from 'fs'
import path from 'path'

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
} else {
  console.warn('⚠ .env.local tidak ditemukan')
}

const args = Object.fromEntries(
  process.argv.slice(2).map(a => {
    const [k, v] = a.replace(/^--/, '').split('=')
    return [k, v ?? 'true']
  })
)

const base = args.base ?? 'http://localhost:3000'
const token = process.env.IDX_SYNC_BEARER_TOKEN
if (!token) {
  console.error('✗ IDX_SYNC_BEARER_TOKEN tidak ditemukan di .env.local')
  process.exit(1)
}

const qs = new URLSearchParams()
if (args.date) qs.set('date', args.date)
if (args.year) qs.set('year', args.year)
if (args.month) qs.set('month', args.month)

const url = `${base}/api/cron/sync-idx${qs.toString() ? `?${qs}` : ''}`
console.log(`→ GET ${url}`)

const start = Date.now()
const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } })
const body = await res.json()
const totalMs = Date.now() - start

console.log(`\nHTTP ${res.status} — ${totalMs}ms\n`)

if (!res.ok) {
  console.error('✗ Request gagal:', JSON.stringify(body, null, 2))
  process.exit(1)
}

console.log(`Dijalankan pada : ${body.ranAt}`)
console.log(`Params          : date=${body.params.date} year=${body.params.year} month=${body.params.month}\n`)

for (const [name, r] of Object.entries(body.results)) {
  const icon = r.success ? '✓' : '✗'
  console.log(`${icon} ${name.padEnd(10)} baris=${String(r.count).padEnd(6)} durasi=${r.durationMs}ms${r.error ? `  ERROR: ${r.error}` : ''}`)
}
