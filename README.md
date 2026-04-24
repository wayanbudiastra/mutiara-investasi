# Mutiara Investasi — Kalkulator Saham

Aplikasi web untuk simulasi investasi saham, rekap dividen, rekap portofolio, dan kalkulasi floating profit/loss secara real-time. Dibangun dengan Next.js 16, PostgreSQL (Neon.tech), Prisma, dan NextAuth.

---

## Daftar Isi

1. [Teknologi yang Digunakan](#teknologi-yang-digunakan)
2. [Prasyarat](#prasyarat)
3. [Variabel Lingkungan](#variabel-lingkungan)
4. [Menjalankan Lokal (Development)](#menjalankan-lokal-development)
5. [Deploy ke Vercel](#deploy-ke-vercel)
6. [Deploy ke VPS / Server Mandiri](#deploy-ke-vps--server-mandiri)
7. [Setup Database (Neon.tech)](#setup-database-neontech)
8. [Checklist Pasca-Deploy](#checklist-pasca-deploy)
9. [Struktur Modul](#struktur-modul)
10. [Fitur Pro & Subscription](#fitur-pro--subscription)

---

## Teknologi yang Digunakan

| Teknologi | Versi | Keterangan |
|-----------|-------|------------|
| Next.js | 16.x | App Router, Turbopack |
| React | 18.x | |
| TypeScript | 5.x | |
| Prisma | 5.x | ORM — raw queries PostgreSQL |
| PostgreSQL | — | via Neon.tech (serverless) |
| NextAuth | 4.x | Autentikasi JWT + Credentials |
| Tailwind CSS | 3.x | |
| Recharts | 2.x | Grafik dividen |
| yahoo-finance2 | 3.x | Harga saham real-time (BEI) |
| Node.js | ≥ 20 | Direkomendasikan ≥ 22 untuk yahoo-finance2 |

---

## Prasyarat

Pastikan sudah terinstall di server / mesin lokal:

- **Node.js** versi 20+ (rekomendasi: 22+)
- **npm** versi 9+
- **Git**
- Akun **Neon.tech** (database PostgreSQL serverless gratis)
- Akun **Vercel** (opsional, untuk deploy serverless)

---

## Variabel Lingkungan

Buat file `.env.local` di root project. Berikut semua variabel yang diperlukan:

```bash
# ── Database ─────────────────────────────────────────────────────────────────
# Connection string PostgreSQL dari Neon.tech
# Format: postgresql://USER:PASSWORD@HOST/DBNAME?sslmode=require
DATABASE_URL="postgresql://neondb_owner:PASSWORD@ep-xxx.neon.tech/neondb?sslmode=require&channel_binding=require"

# ── NextAuth ──────────────────────────────────────────────────────────────────
# Secret untuk enkripsi JWT — generate dengan: openssl rand -base64 32
NEXTAUTH_SECRET="isi-dengan-random-string-32-karakter"

# URL aplikasi (tanpa trailing slash)
# Lokal: http://localhost:3000
# Produksi: https://domain-anda.vercel.app
NEXTAUTH_URL="https://domain-anda.vercel.app"

# ── Fitur Pro ─────────────────────────────────────────────────────────────────
# true  = aktifkan paywall (user harus berlangganan)
# false = semua fitur gratis (mode awal / promosi)
PRO_ENABLED=false

# User ID yang mendapat akses admin penuh (bypass paywall)
# Pisahkan dengan koma jika lebih dari satu
ADMIN_USER_IDS="cmo8gr6wg000013555943rxay"

# ── Midtrans (isi setelah integrasi pembayaran aktif) ─────────────────────────
# MIDTRANS_SERVER_KEY="SB-Mid-server-xxxx"
# MIDTRANS_CLIENT_KEY="SB-Mid-client-xxxx"
# MIDTRANS_IS_PRODUCTION=false
```

> **Penting:** File `.env.local` sudah ada di `.gitignore`. Jangan pernah commit file ini ke repositori.

---

## Menjalankan Lokal (Development)

```bash
# 1. Clone repositori
git clone https://github.com/wayanbudiastra/mutiara-investasi.git
cd mutiara-investasi

# 2. Install dependencies
npm install

# 3. Buat file .env.local
cp .env.example .env.local
# Lalu isi nilai variabel sesuai panduan di atas

# 4. Generate Prisma Client
npm run db:generate

# 5. Sinkronisasi schema ke database (buat tabel Prisma)
npm run db:push

# 6. Jalankan server development
npm run dev
```

Aplikasi berjalan di: **http://localhost:3000**

> **Catatan:** Tabel non-Prisma (`dividends`, `portfolios`, `subscriptions`, `payments`, `securities`) dibuat otomatis saat pertama kali endpoint diakses — tidak perlu migrasi manual.

---

## Deploy ke Vercel

Vercel adalah cara termudah untuk deploy aplikasi Next.js.

### Langkah 1 — Hubungkan Repositori

1. Login ke [vercel.com](https://vercel.com)
2. Klik **"Add New Project"**
3. Import repositori `wayanbudiastra/mutiara-investasi` dari GitHub
4. Framework akan terdeteksi otomatis sebagai **Next.js**

### Langkah 2 — Atur Environment Variables

Di dashboard Vercel → **Settings → Environment Variables**, tambahkan semua variabel dari tabel berikut:

| Variabel | Nilai | Environment |
|----------|-------|-------------|
| `DATABASE_URL` | Connection string Neon.tech | Production, Preview, Development |
| `NEXTAUTH_SECRET` | Random string 32 karakter | Production, Preview, Development |
| `NEXTAUTH_URL` | `https://domain-anda.vercel.app` | Production |
| `PRO_ENABLED` | `false` (awal) atau `true` | Production |
| `ADMIN_USER_IDS` | ID user admin | Production |

> **Generate NEXTAUTH_SECRET:**
> ```bash
> openssl rand -base64 32
> ```
> Atau gunakan: [generate-secret.vercel.app](https://generate-secret.vercel.app/32)

### Langkah 3 — Deploy

1. Klik **"Deploy"**
2. Vercel akan otomatis build dan deploy
3. Setelah selesai, jalankan Prisma push melalui Vercel CLI atau terminal lokal yang sudah dikonfigurasi:

```bash
# Dari mesin lokal (pastikan DATABASE_URL sudah diset di .env.local)
npm run db:push
```

### Langkah 4 — Verifikasi

1. Buka URL production (misal: `https://mutiara-investasi.vercel.app`)
2. Coba registrasi akun baru
3. Login dan akses semua halaman

### Auto-Deploy

Setiap `git push` ke branch `master` akan otomatis men-trigger deploy ulang di Vercel.

---

## Deploy ke VPS / Server Mandiri

Gunakan panduan ini jika deploy ke Ubuntu/Debian VPS (DigitalOcean, AWS EC2, dll).

### Prasyarat Server

```bash
# Update sistem
sudo apt update && sudo apt upgrade -y

# Install Node.js 22 (via NodeSource)
curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
sudo apt install -y nodejs

# Verifikasi
node --version  # v22.x.x
npm --version   # 10.x.x

# Install PM2 (process manager)
sudo npm install -g pm2

# Install Nginx (reverse proxy)
sudo apt install -y nginx
```

### Langkah 1 — Clone & Setup

```bash
# Clone ke server
git clone https://github.com/wayanbudiastra/mutiara-investasi.git
cd mutiara-investasi

# Install dependencies
npm install

# Buat file environment
nano .env.local
# Isi semua variabel sesuai panduan di atas
```

### Langkah 2 — Build Aplikasi

```bash
# Generate Prisma Client
npm run db:generate

# Sinkronisasi schema ke database
npm run db:push

# Build Next.js untuk production
npm run build
```

### Langkah 3 — Jalankan dengan PM2

```bash
# Jalankan aplikasi
pm2 start npm --name "mutiara-investasi" -- start

# Set PM2 auto-start saat server reboot
pm2 startup
pm2 save

# Cek status
pm2 status
pm2 logs mutiara-investasi
```

Aplikasi berjalan di port **3000** secara default.

### Langkah 4 — Setup Nginx sebagai Reverse Proxy

```bash
# Buat konfigurasi Nginx
sudo nano /etc/nginx/sites-available/mutiara-investasi
```

Isi file konfigurasi:

```nginx
server {
    listen 80;
    server_name domain-anda.com www.domain-anda.com;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }
}
```

```bash
# Aktifkan konfigurasi
sudo ln -s /etc/nginx/sites-available/mutiara-investasi /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
```

### Langkah 5 — SSL dengan Let's Encrypt (HTTPS)

```bash
# Install Certbot
sudo apt install -y certbot python3-certbot-nginx

# Generate sertifikat SSL
sudo certbot --nginx -d domain-anda.com -d www.domain-anda.com

# Auto-renewal sudah dikonfigurasi otomatis oleh Certbot
```

### Update Aplikasi (setelah ada commit baru)

```bash
cd /path/to/mutiara-investasi
git pull origin master
npm install
npm run build
pm2 restart mutiara-investasi
```

---

## Setup Database (Neon.tech)

1. Daftar di [neon.tech](https://neon.tech) (gratis)
2. Buat project baru → pilih region terdekat (Singapore / ap-southeast-1)
3. Salin **Connection String** dari dashboard
4. Paste ke `DATABASE_URL` di `.env.local`

Format connection string:
```
postgresql://USER:PASSWORD@ep-xxx-yyy.ap-southeast-1.aws.neon.tech/neondb?sslmode=require&channel_binding=require
```

### Tabel yang Dibuat Prisma (`npm run db:push`)

- `users` — akun pengguna
- `accounts`, `sessions`, `verificationtokens` — NextAuth
- `calculations` — riwayat simulasi
- `watchlist` — pantauan saham

### Tabel yang Dibuat Otomatis (raw SQL, saat endpoint pertama diakses)

- `securities` — daftar akun sekuritas per user
- `dividends` — rekap dividen
- `portfolios` — rekap portofolio
- `subscriptions` — data langganan Pro
- `payments` — riwayat transaksi pembayaran

---

## Checklist Pasca-Deploy

Lakukan verifikasi setelah deploy berhasil:

### Fungsional
- [ ] Halaman login dan registrasi dapat diakses
- [ ] Registrasi akun baru berhasil (password ter-hash di database)
- [ ] Login berhasil, session aktif
- [ ] Halaman Simulasi dapat menghitung dan menyimpan data
- [ ] Riwayat Simulasi menampilkan data yang tersimpan
- [ ] Halaman Portofolio dapat menampilkan harga real-time dari Yahoo Finance
- [ ] Rekap Dividen dapat menambah, edit, dan hapus data
- [ ] Filter dan pagination berfungsi di semua halaman

### Fitur Pro
- [ ] `PRO_ENABLED=false` → semua user bisa akses semua fitur
- [ ] `PRO_ENABLED=true` → user tanpa langganan melihat ProGate
- [ ] Akun admin (`ADMIN_USER_IDS`) bisa akses semua fitur tanpa berlangganan
- [ ] Halaman `/pricing` menampilkan 4 paket dengan harga yang benar
- [ ] Halaman `/subscription` menampilkan status langganan

### Database
- [ ] Tabel Prisma terbuat setelah `npm run db:push`
- [ ] Tabel raw SQL terbuat otomatis saat pertama kali diakses

### Yahoo Finance
- [ ] Harga saham muncul di halaman Portofolio (kolom Harga Terakhir)
- [ ] Kode saham BEI ditambah `.JK` otomatis (BBRI → BBRI.JK)
- [ ] Jika saham tidak ditemukan, tampil `—` (tidak error)

---

## Struktur Modul

```
app/
├── (auth)/          # Login & Register
├── api/
│   ├── calculations/    # CRUD simulasi saham
│   ├── dividends/       # CRUD rekap dividen
│   ├── portfolio/       # CRUD portofolio + harga Yahoo Finance
│   ├── securities/      # CRUD daftar sekuritas
│   └── subscription/    # Status & create langganan Pro
├── dividends/       # Rekap Dividen (PRO)
├── history/         # Riwayat Simulasi
├── portfolio/       # Rekap Portofolio (PRO)
├── pricing/         # Halaman pilih paket Pro
├── securities/      # Daftar Sekuritas (PRO)
├── subscription/    # Status langganan
└── page.tsx         # Simulasi Saham (halaman utama)

components/
├── AppShell.tsx     # Layout utama
├── ProGate.tsx      # Paywall component
├── Providers.tsx    # NextAuth session provider
└── Sidebar.tsx      # Navigasi sidebar

lib/
├── auth.ts          # Konfigurasi NextAuth
├── prisma.ts        # Prisma client singleton
└── subscription.ts  # Logika cek Pro access + daftar PLANS
```

---

## Fitur Pro & Subscription

### Mode Free (PRO_ENABLED=false)
Semua user dapat mengakses semua fitur tanpa berlangganan.
Aktifkan dengan: `PRO_ENABLED=false` di `.env.local`

### Mode Pro (PRO_ENABLED=true)
Fitur berikut dikunci untuk user tanpa langganan aktif:
- Rekap Dividen (`/dividends`)
- Rekap Portofolio (`/portfolio`)
- Daftar Sekuritas (`/securities`)

Fitur yang tetap gratis:
- Simulasi Saham (`/`)
- Riwayat Simulasi (`/history`)

### Paket Harga

| Paket | Durasi | Harga |
|-------|--------|-------|
| Bulanan | 1 bulan | Rp 15.000 |
| Kuartalan | 3 bulan | Rp 35.000 |
| Semester | 6 bulan | Rp 50.000 |
| Tahunan | 12 bulan | Rp 100.000 |

### Admin Bypass
User yang ID-nya terdaftar di `ADMIN_USER_IDS` mendapat akses penuh ke semua fitur tanpa berlangganan, di mode apa pun.

---

## Catatan Penting

- **yahoo-finance2 v3** membutuhkan Node.js ≥ 22 secara resmi, namun tetap berjalan di Node 20 dengan peringatan. Disarankan upgrade ke Node 22 di server produksi.
- **Midtrans** belum terintegrasi — tombol bayar di halaman pricing membuat pesanan dengan status `PENDING`. Aktivasi langganan dapat dilakukan manual oleh admin melalui database.
- **Connection pooling** sudah dikonfigurasi via Neon.tech pooler URL (`-pooler` di connection string). Gunakan pooler URL untuk environment production.
