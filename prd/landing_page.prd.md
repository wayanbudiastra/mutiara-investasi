# PRD: Landing Page Publik — Mutiara Investasi

**Dokumen**: landing_page.prd.md  
**Versi**: 1.1  
**Tanggal**: 17 Mei 2026  
**Status**: Draft  
**Produk**: Mutiara Investasi — Platform Analisis Saham Dividen Indonesia  
**Perubahan v1.1**: Section aktif dikonfirmasi: Hero, Fitur, Harga, Footer. Section Testimoni, FAQ, How It Works dihapus dari scope v1. Tidak ada demo/preview — semua CTA langsung ke `/register` atau `/login`.

---

## 1. Latar Belakang

Mutiara Investasi adalah platform web berbayar untuk investor ritel Indonesia yang menyediakan rekap dividen, analisis chart tahunan, rekap portofolio, dan klasifikasi saham per sekuritas. Saat ini aplikasi langsung membuka halaman login tanpa ada halaman publik yang menjelaskan nilai produk.

Landing page dibutuhkan sebagai **pintu masuk publik** yang:
- Menjelaskan manfaat produk kepada calon pengguna baru
- Mendorong konversi ke pendaftaran / pembelian paket
- Bisa diindeks mesin pencari (SEO-friendly)
- Mencerminkan identitas brand Mutiara Investasi

---

## 2. Tujuan

| Tujuan | Indikator Keberhasilan |
|--------|----------------------|
| Meningkatkan awareness produk | Bounce rate < 60% |
| Mendorong konversi sign up | CTR tombol CTA > 5% |
| Menjelaskan fitur & harga secara mandiri | Waktu di halaman > 90 detik |
| Mendukung SEO organik | Halaman terindeks Google dalam 30 hari |

---

## 3. Target Pengguna

**Persona Utama — Investor Ritel Pemula hingga Menengah**
- Usia 25–45 tahun
- Tertarik saham dividen di IDX
- Menggunakan broker: AJAIB, IPOT, KOINS, Stockbit, dll.
- Belum punya alat rekap portofolio yang terpadu
- Aktif di YouTube / media sosial investasi

---

## 4. Scope

### In Scope
- Halaman statis publik di route `/` (root)
- Diakses **tanpa login** — fully public
- **4 section utama**: Hero, Fitur, Harga, Footer
- Redirect ke `/login` atau `/register` via tombol CTA — **tidak ada demo/preview**
- SEO metadata (title, description, og:image)
- Responsif: mobile-first

### Out of Scope
- Halaman demo/preview fitur tanpa login — **semua CTA langsung ke daftar/login**
- Section Testimoni — ditambahkan di v2 jika ada data
- Section FAQ — ditambahkan di v2
- Section "Cara Kerja" (How It Works) — ditambahkan di v2
- Blog atau artikel
- Chatbot / live chat
- Integrasi payment langsung dari landing page

---

## 5. Struktur Halaman & Section

### 5.1 Navbar (Sticky)

```
┌─────────────────────────────────────────────────────────┐
│  🔮 Mutiara Investasi        [Fitur] [Harga]  [Masuk]  [Daftar →] │
└─────────────────────────────────────────────────────────┘
```

| Elemen | Detail |
|--------|--------|
| Logo | Nama "Mutiara Investasi" + ikon gem/mutiara |
| Nav links | Fitur (anchor), Harga (anchor) |
| CTA kanan | Tombol "Masuk" (ghost) + "Daftar Gratis" (solid) |
| Perilaku | Sticky saat scroll; background solid setelah melewati hero |
| Mobile | Hamburger menu collapse |

---

### 5.2 Hero Section

**Tujuan**: Tangkap perhatian dan sampaikan value proposition utama dalam 3 detik.

```
┌─────────────────────────────────────────────────────────┐
│                                                         │
│   Rekap Portofolio & Dividen                           │
│   Saham Indonesia, Satu Tempat.                        │
│                                                         │
│   Pantau pertumbuhan dividen, analisis chart tahunan,  │
│   dan kelola portofolio multi-sekuritas dengan mudah.  │
│                                                         │
│   [Coba Gratis 7 Hari]   [Lihat Fitur ↓]              │
│                                                         │
│   ── Screenshot / Mockup Dashboard ──                  │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

| Elemen | Konten |
|--------|--------|
| Headline | "Rekap Portofolio & Dividen Saham Indonesia, Satu Tempat." |
| Subheadline | "Pantau pertumbuhan dividen, analisis chart tahunan, dan kelola portofolio multi-sekuritas dengan mudah." |
| CTA Primer | **"Mulai Sekarang"** → `/register` |
| CTA Sekunder | **"Lihat Fitur"** → anchor ke section fitur |
| Visual | Screenshot/mockup dashboard rekap portofolio |
| Sosial proof kecil | "Dipercaya X investor aktif IDX" (jika data tersedia) |

---

### 5.3 Social Proof / Stats Bar

Bar horizontal tipis di bawah hero:

```
📊 12 Emiten Terlacak   |   💰 Rekap Dividen Real-time   |   🏦 Multi-Sekuritas   |   📅 Histori 5 Tahun
```

Animasi count-up sederhana saat masuk viewport.

---

### 5.4 Section Fitur Utama

**Judul**: "Semua yang Kamu Butuhkan untuk Investasi Dividen"

Layout: **3 kolom card** di desktop, 1 kolom di mobile.

| # | Ikon | Judul Fitur | Deskripsi |
|---|------|-------------|-----------|
| 1 | 💰 | Rekap Dividen Lengkap | Lacak semua dividen yang sudah dan akan diterima dari saham portofoliomu. |
| 2 | 📈 | Rekap Chart per Tahun | Visualisasi kinerja saham dalam grafik tahunan yang bersih dan mudah dibaca. |
| 3 | 🏦 | Rekap by Sekuritas | Pisahkan dan bandingkan kepemilikan saham per akun broker secara otomatis. |
| 4 | 📂 | Rekap Portofolio | Lihat floating P/L, nilai pasar, dan alokasi semua saham dalam satu dashboard. |
| 5 | 📋 | Daftar Sekuritas | Direktori sekuritas yang kamu gunakan, terintegrasi dengan data portofolio. |
| 6 | 🥧 | Alokasi Saham (baru) | Pie chart porsi kepemilikan saham dengan histori 5 tahun terakhir. |

---

### 5.5 Section Harga (Pricing)

**Judul**: "Pilih Paket Langganan"  
**Subjudul**: "Akses penuh ke semua fitur Pro. Makin panjang berlangganan, makin hemat per bulannya."

Layout: **4 card** sejajar (sesuai screenshot yang sudah ada).

| Paket | Harga | Periode | Harga/bulan | Badge |
|-------|-------|---------|-------------|-------|
| Bulanan | Rp 15.000 | 1 bulan | — | — |
| Kuartalan | Rp 35.000 | 3 bulan | ≈ Rp 11.667/bln | — |
| Semester | Rp 55.000 | 6 bulan | ≈ Rp 9.167/bln | — |
| Tahunan | Rp 100.000 | 12 bulan | ≈ Rp 8.333/bln | 🏷 Paling Hemat |

**Fitur semua paket** (checklist):
- ✓ Rekap Dividen lengkap
- ✓ Rekap Chart per tahun
- ✓ Rekap By Sekuritas
- ✓ Rekap Portofolio
- ✓ Daftar Sekuritas

**Metode pembayaran** (footer kecil di bawah card):  
Transfer Bank · Virtual Account · GoPay · OVO · DANA · ShopeePay · QRIS · Kartu Kredit/Debit

> **Note implementasi**: Tombol "Pilih Paket" di landing page → redirect ke `/register?plan=bulanan` (plan dipilih setelah user membuat akun, atau langsung ke flow payment jika sudah login).

---

### 5.6 CTA Bottom (Final Conversion)

```
┌─────────────────────────────────────────────────────────┐
│                                                         │
│   Siap Pantau Portofolio Dividenmu?                    │
│   Daftar sekarang dan mulai kelola investasimu.        │
│                                                         │
│              [Daftar Sekarang]                         │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

---

### 5.7 Footer

```
┌─────────────────────────────────────────────────────────┐
│  🔮 Mutiara Investasi                                  │
│  Platform rekap dividen & portofolio saham IDX         │
│                                                         │
│  Produk          Hukum              Sosial             │
│  Fitur           Kebijakan Privasi  YouTube ↗          │
│  Harga           Syarat & Ketentuan Instagram          │
│                                                         │
│  © 2026 Mutiara Investasi. All rights reserved.       │
└─────────────────────────────────────────────────────────┘
```

**Link sosial media:**
| Platform | URL | Target |
|----------|-----|--------|
| YouTube | `https://www.youtube.com/@mutiarainvestasi/videos` | `_blank` |
| Instagram | *(tambahkan jika tersedia)* | `_blank` |

---

## 6. Spesifikasi Teknis

### 6.1 Stack

| Aspek | Keputusan |
|-------|-----------|
| Framework | Next.js (App Router) — konsisten dengan aplikasi existing |
| Route | `app/page.tsx` (root `/`) atau `app/(public)/landing/page.tsx` |
| Styling | Tailwind CSS |
| Animasi | Framer Motion (scroll reveal, count-up stats) |
| SEO | `next/metadata` — title, description, og:image, canonical |
| Font | Sesuai brand existing (atau tetapkan di sini) |
| Image | `next/image` — optimasi WebP otomatis |

### 6.2 Routing & Auth Guard

```
/           → Landing page (PUBLIC — tidak perlu session)
/login      → Halaman login
/register   → Halaman daftar
/dashboard  → Redirect ke /login jika belum auth (PROTECTED)
```

Pastikan middleware Next.js **tidak memblokir route `/`** untuk publik.

```typescript
// middleware.ts
export const config = {
  matcher: [
    '/dashboard/:path*',
    '/portofolio/:path*',
    // jangan masukkan '/' di sini
  ],
};
```

### 6.3 SEO Metadata

```typescript
// app/page.tsx
export const metadata = {
  title: 'Mutiara Investasi — Rekap Dividen & Portofolio Saham IDX',
  description:
    'Platform analisis saham dividen Indonesia. Rekap portofolio multi-sekuritas, chart tahunan, dan histori dividen dalam satu dashboard.',
  openGraph: {
    title: 'Mutiara Investasi',
    description: 'Rekap Dividen & Portofolio Saham IDX',
    url: 'https://mutiarainvestasi.com',
    siteName: 'Mutiara Investasi',
    images: [{ url: '/og-image.png', width: 1200, height: 630 }],
    locale: 'id_ID',
    type: 'website',
  },
};
```

### 6.4 Performa

| Target | Nilai |
|--------|-------|
| Lighthouse Performance | ≥ 90 |
| First Contentful Paint | < 1.5 detik |
| Cumulative Layout Shift | < 0.1 |
| Gambar Hero | WebP, lazy-load, width/height dideklarasi |

---

## 7. Struktur Komponen

```
app/
  page.tsx                        ← Entry point landing page

components/
  landing/
    Navbar.tsx                    ← Sticky navbar publik
    HeroSection.tsx               ← Headline + CTA + visual
    StatsBar.tsx                  ← Angka highlight (count-up)
    FeaturesSection.tsx           ← Grid 6 fitur
    PricingSection.tsx            ← 4 card paket
    CtaBottom.tsx                 ← Final CTA banner
    Footer.tsx                    ← Footer publik (dengan link sosmed)

  ui/
    PricingCard.tsx               ← Reusable card harga
    FeatureCard.tsx               ← Reusable card fitur
```

---

## 8. Acceptance Criteria

| ID | Kriteria | Pass |
|----|----------|------|
| AC-01 | Halaman `/` dapat diakses tanpa login (tidak di-redirect ke /login) | ☐ |
| AC-02 | Semua section tampil: Hero, Stats Bar, Fitur, Harga, CTA Bottom, Footer | ☐ |
| AC-03 | Navbar sticky dan collapse menjadi hamburger di mobile | ☐ |
| AC-04 | Semua tombol CTA ("Daftar", "Pilih Paket") mengarah ke `/register` — tidak ada link demo | ☐ |
| AC-05 | Tombol "Masuk" mengarah ke `/login` | ☐ |
| AC-06 | Anchor link Navbar (Fitur, Harga) smooth-scroll ke section yang tepat | ☐ |
| AC-07 | Pricing card Tahunan tampil dengan badge "Paling Hemat" dan border highlight | ☐ |
| AC-08 | Metode pembayaran tampil di bawah pricing section | ☐ |
| AC-09 | Footer menampilkan link sosmed (YouTube, Instagram) yang aktif | ☐ |
| AC-10 | Halaman responsif di mobile (320px – 768px) | ☐ |
| AC-11 | SEO metadata (`title`, `description`, `og:image`) terpasang | ☐ |
| AC-12 | Lighthouse score ≥ 90 di desktop | ☐ |

---

## 9. Milestone & Estimasi

| Fase | Task | Estimasi |
|------|------|----------|
| **Fase 1** | Setup route publik, middleware fix, Navbar | 0.5 sesi (1 jam) |
| **Fase 2** | HeroSection + StatsBar | 1 sesi (1.5 jam) |
| **Fase 3** | FeaturesSection (6 card) | 0.5 sesi (1 jam) |
| **Fase 4** | PricingSection (port dari UI existing) | 0.5 sesi (1 jam) |
| **Fase 5** | CtaBottom + Footer + link sosmed | 0.5 sesi (1 jam) |
| **Fase 6** | SEO metadata, og:image, Lighthouse audit | 0.5 sesi (1 jam) |
| **Total** | | **~6.5 jam (3–4 sesi malam)** |

---

## 10. Catatan Tambahan

- **Tidak ada demo publik**: Semua CTA langsung ke `/register` atau `/login`. Jangan ada link yang memberi akses fitur tanpa login. Middleware harus ketat untuk route `/dashboard` dan seterusnya.
- **og:image**: Siapkan gambar 1200×630px yang menampilkan dashboard mockup atau visual brand Mutiara Investasi — sangat penting untuk share di WhatsApp grup investor.
- **YouTube di Footer**: Link ke channel `https://www.youtube.com/@mutiarainvestasi/videos` sudah terkonfirmasi — wajib ada di footer dengan `target="_blank"` dan `rel="noopener noreferrer"`. Pertimbangkan juga Instagram jika sudah aktif.
- **Testimoni & FAQ**: Dihapus dari v1, masuk backlog untuk v2 setelah ada pengguna aktif yang bisa memberikan review nyata.
- **Pricing card di landing page**: Tombol "Pilih Paket" redirect ke `/register?plan=bulanan` — query param `plan` bisa digunakan di halaman register untuk pre-select paket dan mempercepat flow konversi.
