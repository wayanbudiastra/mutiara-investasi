/**
 * Script test koneksi SMTP dan kirim email percobaan.
 * Jalankan: node scripts/test-smtp.mjs your@email.com
 */

import path from 'path'
import fs from 'fs'

// Load .env.local
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
  console.log('✓ .env.local dimuat\n')
}

const { createRequire } = await import('module')
const require = createRequire(import.meta.url)
const nodemailer = require('nodemailer')

const targetEmail = process.argv[2]
if (!targetEmail) {
  console.error('Usage: node scripts/test-smtp.mjs your@email.com')
  process.exit(1)
}

const config = {
  host:   process.env.SMTP_HOST,
  port:   Number(process.env.SMTP_PORT ?? 465),
  secure: process.env.SMTP_SECURE !== 'false',
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
}

console.log('Konfigurasi SMTP:')
console.log(`  Host    : ${config.host}`)
console.log(`  Port    : ${config.port}`)
console.log(`  Secure  : ${config.secure}`)
console.log(`  User    : ${config.auth.user}`)
console.log(`  Pass    : ${config.auth.pass ? '***tersedia***' : '❌ KOSONG'}`)
console.log(`  From    : ${process.env.SMTP_FROM}`)
console.log(`  To      : ${targetEmail}`)
console.log('')

if (!config.host || !config.auth.user || !config.auth.pass) {
  console.error('❌ Konfigurasi SMTP tidak lengkap. Cek .env.local atau env vars di hosting.')
  process.exit(1)
}

console.log('Menghubungkan ke SMTP server...')
const transport = nodemailer.createTransport(config)

try {
  // Verifikasi koneksi
  await transport.verify()
  console.log('✓ Koneksi SMTP berhasil!\n')

  // Kirim email test
  console.log(`Mengirim email test ke ${targetEmail}...`)
  const info = await transport.sendMail({
    from:    process.env.SMTP_FROM ?? config.auth.user,
    to:      targetEmail,
    subject: '[Test] SMTP Mutiara Investasi',
    html: `
      <div style="font-family:Arial,sans-serif;padding:20px">
        <h2 style="color:#4f46e5">✅ SMTP Berhasil!</h2>
        <p>Email ini dikirim dari konfigurasi SMTP Mutiara Investasi.</p>
        <ul>
          <li>Host: ${config.host}</li>
          <li>Port: ${config.port}</li>
          <li>User: ${config.auth.user}</li>
          <li>Waktu: ${new Date().toLocaleString('id-ID')}</li>
        </ul>
        <p style="color:#6b7280;font-size:12px">Ini adalah email pengujian otomatis.</p>
      </div>
    `,
  })

  console.log(`✓ Email berhasil dikirim!`)
  console.log(`  Message ID : ${info.messageId}`)
  console.log(`  Response   : ${info.response}`)
  console.log('\n🎉 Setup SMTP sudah benar. Cek inbox atau folder spam.')

} catch (err) {
  console.error('\n❌ Error:', err.message)
  console.error('\nKemungkinan penyebab:')

  if (err.code === 'ECONNREFUSED')   console.error('  → Host atau port salah, atau firewall memblokir koneksi')
  if (err.code === 'ENOTFOUND')      console.error('  → Host SMTP tidak ditemukan, cek SMTP_HOST')
  if (err.code === 'ETIMEDOUT')      console.error('  → Koneksi timeout, cek port (coba 587 jika 465 tidak berhasil)')
  if (err.responseCode === 535)      console.error('  → Username atau password salah, cek SMTP_USER dan SMTP_PASS')
  if (err.responseCode === 534)      console.error('  → Perlu aktifkan "Less secure apps" atau App Password')
  if (err.message.includes('STARTTLS')) console.error('  → Coba SMTP_PORT=587 dan SMTP_SECURE=false')

  console.error('\nDetail lengkap:', err)
  process.exit(1)
}
