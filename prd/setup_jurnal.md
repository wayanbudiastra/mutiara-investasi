# PRD — Fitur Jurnal Portofolio

**Modul:** Rekap Portofolio — Sub-fitur Jurnal  
**Prioritas:** Medium  
**Status:** Open

---

## 1. Latar Belakang

Modul Rekap Portofolio saat ini menampilkan kondisi portofolio secara real-time menggunakan harga terbaru dari Yahoo Finance. Namun tidak ada data historis yang tersimpan — setiap kali halaman dibuka, data dihitung ulang dari awal berdasarkan harga saat itu.

Fitur **Jurnal Portofolio** memungkinkan user merekam *snapshot* kondisi portofolionya setiap hari secara manual. Dengan demikian, user dapat melihat tren pergerakan nilai portofolio dari waktu ke waktu, menganalisis performa investasi, dan membandingkan kondisi antar periode.

---

## 2. Tujuan

- Menyimpan rekaman harian kondisi portofolio (harga, nilai pasar, floating P/L)
- Memberikan gambaran historis pergerakan portofolio sepanjang tahun
- Membantu user menganalisis tren dan performa investasi saham yang dimiliki
- Input jurnal dibatasi **satu kali per hari** per user untuk menjaga konsistensi data

---

## 3. User Flow

```
User buka halaman Portofolio
  ↓
Klik tab "Jurnal"
  ↓
Halaman menampilkan rekap jurnal YTD (default tahun berjalan)
  ↓
User klik tombol "Buat Jurnal Hari Ini"
  ↓
Sistem cek: apakah sudah ada jurnal untuk hari ini?
  ├── SUDAH ADA → tampilkan pesan "Jurnal hari ini sudah dibuat"
  │              + tampilkan data jurnal hari ini (read-only)
  └── BELUM ADA → sistem ambil harga terbaru semua saham dari Yahoo Finance
                 → tampilkan preview snapshot portofolio saat ini
                 → user konfirmasi → jurnal tersimpan
```

---

## 4. Struktur Data

### Tabel `portfolio_journals`

```sql
CREATE TABLE IF NOT EXISTS "portfolio_journals" (
  "id"             TEXT NOT NULL PRIMARY KEY,
  "userId"         TEXT NOT NULL,
  "journalDate"    TEXT NOT NULL,              -- format: YYYY-MM-DD (unik per user per hari)
  "totalModal"     DOUBLE PRECISION NOT NULL,  -- total modal seluruh saham
  "totalNilaiPasar" DOUBLE PRECISION NOT NULL, -- total nilai pasar saat jurnal dibuat
  "totalFloatRp"   DOUBLE PRECISION NOT NULL,  -- total floating P/L (Rp)
  "totalFloatPct"  DOUBLE PRECISION NOT NULL,  -- total floating P/L (%)
  "detail"         TEXT NOT NULL,              -- JSON array snapshot per saham
  "createdAt"      TEXT NOT NULL,
  UNIQUE("userId", "journalDate")              -- satu jurnal per user per hari
)
```

### Struktur `detail` (JSON Array)

```json
[
  {
    "keterangan": "STOCKBIT BUDI",
    "saham": "BBRI",
    "hargaRata": 4500,
    "lot": 50,
    "modal": 22500000,
    "hargaTerakhir": 5100,
    "nilaiPasar": 25500000,
    "floatRp": 3000000,
    "floatPct": 13.33
  },
  ...
]
```

> `hargaTerakhir` diambil dari Yahoo Finance saat tombol "Buat Jurnal" diklik, bukan saat halaman dibuka.

---

## 5. API Routes

| Route | Method | Fungsi |
|-------|--------|--------|
| `GET /api/portfolio/journal` | GET | Ambil semua jurnal user (default filter tahun ini) |
| `POST /api/portfolio/journal` | POST | Buat jurnal baru (validasi 1x per hari) |
| `GET /api/portfolio/journal/today` | GET | Cek apakah jurnal hari ini sudah ada |

### GET `/api/portfolio/journal`

Query params:
- `year` (opsional, default: tahun berjalan)

Response:
```json
[
  {
    "id": "...",
    "journalDate": "2026-04-25",
    "totalModal": 150000000,
    "totalNilaiPasar": 162000000,
    "totalFloatRp": 12000000,
    "totalFloatPct": 8.0,
    "detail": "[...]",
    "createdAt": "2026-04-25T08:30:00.000Z"
  }
]
```

### POST `/api/portfolio/journal`

Request body:
```json
{
  "totalModal": 150000000,
  "totalNilaiPasar": 162000000,
  "totalFloatRp": 12000000,
  "totalFloatPct": 8.0,
  "detail": [{ "keterangan": "...", "saham": "BBRI", ... }]
}
```

Validasi server-side:
- Cek apakah sudah ada jurnal dengan `journalDate = today` untuk userId ini
- Jika sudah ada → return 409 Conflict
- Jika belum → simpan jurnal

---

## 6. UI — Tab Jurnal di Halaman Portofolio

### 6.1 Struktur Tab

Tambah tab baru **"Jurnal"** setelah tabel portofolio utama:

```
[ Portofolio ] [ Jurnal ]
```

### 6.2 Tampilan Halaman Jurnal

**Header:**
- Judul: "Jurnal Portofolio"
- Tombol **"Buat Jurnal Hari Ini"** (disabled jika sudah ada jurnal hari ini)
- Filter tahun (dropdown, default: tahun berjalan / YTD)

**Summary Cards (YTD):**

| Card | Keterangan |
|------|-----------|
| Jurnal Tercatat | Jumlah hari jurnal dibuat tahun ini |
| Nilai Pasar Terakhir | Nilai pasar dari jurnal terbaru |
| Floating P/L Terakhir | Floating P/L dari jurnal terbaru |
| Pertumbuhan YTD | Selisih nilai pasar jurnal pertama vs terakhir tahun ini |

**Chart — Line Chart Nilai Portofolio:**
- Sumbu X: tanggal jurnal
- Sumbu Y: Total Nilai Pasar (Rp)
- Tooltip: tampilkan detail Nilai Pasar, Modal, Float P/L per tanggal
- Library: Recharts (LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid)
- Warna garis: hijau jika nilai terakhir > nilai pertama, merah jika sebaliknya

**Tabel Riwayat Jurnal:**

| Kolom | Keterangan |
|-------|-----------|
| Tanggal | Format: DD Mon YYYY |
| Total Modal | Rp |
| Nilai Pasar | Rp |
| Floating P/L (Rp) | Hijau jika positif, merah jika negatif |
| Floating P/L (%) | Hijau/merah |
| Aksi | Tombol "Detail" untuk lihat snapshot per saham |

**Modal Detail Jurnal:**
- Muncul saat tombol "Detail" diklik
- Menampilkan tabel snapshot per saham saat jurnal dibuat:
  - Akun, Saham, Avg Price, Lot, Modal, Harga Saat Jurnal, Nilai Pasar, Float P/L Rp, Float P/L %
- Read-only, tidak bisa diedit

### 6.3 Flow Buat Jurnal

**Tombol "Buat Jurnal Hari Ini"** → loading state (fetch harga dari Yahoo Finance) → tampilkan preview:

```
┌─────────────────────────────────────────────────────────────┐
│ Konfirmasi Jurnal — 25 April 2026                           │
│                                                             │
│ Total Modal      : Rp 150.000.000                           │
│ Total Nilai Pasar: Rp 162.000.000                           │
│ Floating P/L     : +Rp 12.000.000 (+8,00%)                 │
│                                                             │
│ Harga saham diambil dari Yahoo Finance pukul 10:30 WIB      │
│                                                             │
│ Tabel preview saham (scrollable):                           │
│ BBRI | Avg: 4.500 | Harga: 5.100 | Float: +13,33%           │
│ BBCA | Avg: 9.200 | Harga: 9.800 | Float: +6,52%            │
│ ...                                                         │
│                                                             │
│              [Batal]    [Simpan Jurnal]                     │
└─────────────────────────────────────────────────────────────┘
```

---

## 7. Acceptance Criteria

### Database & API
- [ ] Tabel `portfolio_journals` dibuat otomatis saat pertama kali diakses
- [ ] Constraint `UNIQUE(userId, journalDate)` mencegah duplikasi per hari
- [ ] `POST /api/portfolio/journal` return 409 jika jurnal hari ini sudah ada
- [ ] `GET /api/portfolio/journal?year=2026` return data jurnal tahun tersebut
- [ ] `journalDate` menggunakan zona waktu WIB (UTC+7) bukan UTC

### UI
- [ ] Tab "Jurnal" muncul di halaman Portofolio
- [ ] Default tampilan adalah data YTD (tahun berjalan)
- [ ] Tombol "Buat Jurnal Hari Ini" disabled + tooltip jika jurnal sudah ada
- [ ] Loading state saat fetch harga Yahoo Finance sebelum preview
- [ ] Preview jurnal menampilkan semua saham di portofolio dengan harga terkini
- [ ] Line chart menampilkan tren nilai portofolio sepanjang periode yang dipilih
- [ ] Warna chart hijau jika growth positif, merah jika negatif
- [ ] Tabel riwayat: Floating P/L berwarna hijau/merah sesuai nilai
- [ ] Modal detail jurnal menampilkan snapshot per saham (read-only)
- [ ] Filter tahun berfungsi: chart dan tabel menyesuaikan data

### Constraint
- [ ] Jika portofolio kosong, tombol "Buat Jurnal" disabled dengan pesan "Belum ada data portofolio"
- [ ] Jika harga saham tidak tersedia dari Yahoo Finance, tampilkan `—` di kolom harga (jurnal tetap bisa disimpan)

---

## 8. Catatan Teknis

- `journalDate` disimpan sebagai TEXT format `YYYY-MM-DD` (bukan timestamp) agar mudah dibandingkan
- Zona waktu: gunakan `new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Jakarta' })` untuk dapatkan tanggal WIB
- `detail` disimpan sebagai TEXT (JSON.stringify) — parse saat digunakan di frontend
- Harga Yahoo Finance diambil batch saat user klik "Buat Jurnal", bukan di background
- Tidak ada fitur edit atau hapus jurnal (data historis bersifat permanen)
- Pertimbangkan pagination jika jurnal lebih dari 365 entry (1 tahun penuh)

---

## 9. Out of Scope (Phase 2)

- Auto-create jurnal harian via cron job (background)
- Perbandingan portofolio vs IHSG / benchmark
- Export jurnal ke CSV / Excel
- Notifikasi pengingat buat jurnal harian
- Chart per akun sekuritas (saat ini: total keseluruhan)
- Analisis saham terbaik / terburuk sepanjang periode

---
