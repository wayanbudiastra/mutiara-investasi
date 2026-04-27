# PRD — Rekap Capital Gain & Loss

**Modul:** Rekap Portofolio — Sub-fitur Gain/Loss  
**Prioritas:** Medium  
**Status:** Open

---

## 1. Latar Belakang

Saat ini modul Portofolio menampilkan floating P/L secara real-time per saham berdasarkan harga terkini. Namun belum tersedia rekap menyeluruh yang membantu user memahami performa investasi secara lebih terstruktur — baik per saham, per akun sekuritas, maupun tren historis berdasarkan data jurnal harian.

Fitur **Rekap Capital Gain & Loss** mengkonsolidasi data dari dua sumber:
1. **Tabel `portfolios`** — posisi kepemilikan saham saat ini (avg price, lot, harga terkini)
2. **Tabel `portfolio_journals`** — snapshot harian nilai portofolio

Hasilnya adalah laporan komprehensif yang membantu user mengevaluasi performa investasi dari berbagai sudut pandang.

---

## 2. Definisi Kalkulasi

Karena sistem belum mencatat transaksi jual, seluruh kalkulasi berbasis **Unrealized (Floating) Gain/Loss**:

| Istilah | Formula |
|---------|---------|
| **Modal** | `hargaRata × lot × 100` |
| **Nilai Pasar** | `hargaTerakhir × lot × 100` |
| **Floating G/L (Rp)** | `Nilai Pasar − Modal` |
| **Floating G/L (%)** | `(Floating G/L ÷ Modal) × 100` |
| **Pertumbuhan YTD** | `Nilai Pasar Jurnal Terakhir − Nilai Pasar Jurnal Pertama (tahun berjalan)` |
| **Rata-rata Harian G/L** | `Pertumbuhan YTD ÷ Jumlah Hari Jurnal` |

---

## 3. Tujuan

- Memberikan laporan P/L menyeluruh yang terstruktur dan mudah dibaca
- Membantu user mengidentifikasi saham terbaik (top gainer) dan terburuk (top loser)
- Memperlihatkan tren perubahan nilai portofolio dari waktu ke waktu via data jurnal
- Rekap per akun sekuritas untuk evaluasi performa per broker

---

## 4. Sumber Data

| Sumber | Data yang Digunakan |
|--------|-------------------|
| `portfolios` | hargaRata, lot, keterangan (akun), saham |
| `lastPrice` (cache/Yahoo Finance) | harga pasar terkini per saham |
| `portfolio_journals` | totalModal, totalNilaiPasar, totalFloatRp, totalFloatPct, journalDate |
| `portfolio_journals.detail` | snapshot per saham saat jurnal dibuat |

---

## 5. Struktur Halaman

Tab baru **"Gain/Loss"** disisipkan di halaman Portofolio setelah tab "Jurnal":

```
[ Portofolio ]  [ Jurnal ]  [ Gain/Loss ]
```

---

## 6. Konten Tab Gain/Loss

### 6.1 Summary Cards — Kondisi Saat Ini

| Card | Nilai | Keterangan |
|------|-------|-----------|
| Total Modal | Rp xxx | Seluruh investasi yang ditanamkan |
| Total Nilai Pasar | Rp xxx | Nilai pasar saat ini |
| Total Floating G/L | Rp xxx | Hijau jika profit, merah jika loss |
| Total Floating G/L (%) | +x.xx% | Persentase keseluruhan |
| Pertumbuhan YTD | Rp xxx | Dari jurnal pertama ke terakhir tahun ini |

---

### 6.2 Tabel — Rekap Per Saham

Sumber: `portfolios` + `lastPrice`

| Kolom | Keterangan |
|-------|-----------|
| Saham | Kode saham (badge indigo) |
| Akun | Nama akun sekuritas |
| Avg Price | Harga rata-rata beli |
| Lot | Jumlah lot |
| Modal | hargaRata × lot × 100 |
| Harga Terkini | Live/cache dari Yahoo Finance |
| Nilai Pasar | Harga terkini × lot × 100 |
| G/L (Rp) | Nilai Pasar − Modal |
| G/L (%) | (G/L ÷ Modal) × 100 |
| Status | Badge: **GAIN** (hijau) / **LOSS** (merah) / **FLAT** (abu) |

**Sorting default:** G/L (%) descending — saham terbaik di atas  
**Filter:** dropdown per akun sekuritas  

---

### 6.3 Tabel — Rekap Per Akun Sekuritas

Sumber: `portfolios` dikelompokkan per `keterangan` + `lastPrice`

| Kolom | Keterangan |
|-------|-----------|
| Akun Sekuritas | Nama broker |
| Jumlah Saham | Banyaknya saham berbeda di akun ini |
| Total Modal | Akumulasi modal di akun ini |
| Total Nilai Pasar | Akumulasi nilai pasar di akun ini |
| Total G/L (Rp) | Total floating gain/loss akun ini |
| Total G/L (%) | Persentase akun ini |
| Status | GAIN / LOSS / FLAT |

---

### 6.4 Top Gainer & Top Loser

Dua kolom berdampingan:

**Top 3 Gainer** (G/L % tertinggi):
```
1. BBCA  +13,33%   Rp 3.000.000
2. TLKM  +8,50%    Rp 1.200.000
3. BMRI  +6,20%    Rp 950.000
```

**Top 3 Loser** (G/L % terendah):
```
1. EXCL  -5,80%   -Rp 450.000
2. BNGA  -3,20%   -Rp 280.000
3. ADRO  -1,50%   -Rp 120.000
```

---

### 6.5 Chart — Tren G/L dari Data Jurnal

Sumber: `portfolio_journals` (default: YTD tahun berjalan)

**Line Chart:**
- Sumbu X: tanggal jurnal
- Sumbu Y: Total Floating G/L (Rp)
- Warna garis: hijau jika nilai terakhir positif, merah jika negatif
- Tooltip: tampilkan nilai G/L, modal, nilai pasar per tanggal
- Filter tahun: dropdown (default tahun berjalan)

**Area Chart alternatif:**
- Dua area: Total Modal (abu) vs Total Nilai Pasar (indigo/hijau/merah)
- Selisih antara dua area = G/L secara visual

---

### 6.6 Tabel — Riwayat G/L dari Jurnal

Sumber: `portfolio_journals` (default: 10 terbaru, dengan paging)

| Kolom | Keterangan |
|-------|-----------|
| Tanggal | Format DD Mon YYYY |
| Total Modal | Rp |
| Nilai Pasar | Rp |
| G/L (Rp) | Hijau/merah |
| G/L (%) | Persentase |
| ΔG/L | Perubahan G/L dari jurnal sebelumnya (+ atau −) |

Kolom **ΔG/L** membantu user melihat perubahan harian:
- `+Rp 500.000` → hari itu portofolio naik 500 ribu
- `-Rp 200.000` → hari itu portofolio turun 200 ribu

---

## 7. API

Tidak perlu API baru — data diambil dari endpoint yang sudah ada:

| Data | Endpoint |
|------|---------|
| Posisi portofolio | `GET /api/portfolio` |
| Harga terkini | `GET /api/portfolio/price?symbols=...` |
| Riwayat jurnal | `GET /api/portfolio/journal?year=...` |

Seluruh kalkulasi dilakukan **client-side** dari tiga sumber di atas.

---

## 8. Acceptance Criteria

### Summary Cards
- [ ] Total Modal, Nilai Pasar, Floating G/L, G/L%, Pertumbuhan YTD tampil benar
- [ ] Warna G/L hijau jika positif, merah jika negatif, abu jika nol

### Tabel Per Saham
- [ ] Sorting default: G/L % descending
- [ ] Badge GAIN/LOSS/FLAT per baris
- [ ] Filter per akun sekuritas berfungsi
- [ ] Kolom harga terkini menampilkan badge Cache jika dari cache

### Tabel Per Akun
- [ ] Data dikelompokkan per `keterangan` (nama broker)
- [ ] Total modal, nilai pasar, dan G/L per akun dihitung benar

### Top Gainer & Loser
- [ ] Masing-masing menampilkan 3 saham teratas
- [ ] Jika saham < 3, tampilkan semua yang ada
- [ ] Tidak ada error jika portofolio kosong

### Chart Tren Jurnal
- [ ] Line chart tren G/L dari data jurnal
- [ ] Filter tahun berfungsi
- [ ] Tooltip menampilkan detail per titik

### Tabel Riwayat Jurnal
- [ ] Kolom ΔG/L menampilkan perubahan dari jurnal sebelumnya
- [ ] Paging 10 baris per halaman
- [ ] Hijau/merah pada G/L dan ΔG/L

### Umum
- [ ] Jika portofolio kosong: tampilkan pesan placeholder
- [ ] Jika jurnal kosong: chart dan tabel riwayat tidak error
- [ ] Jika harga tidak tersedia: G/L tampil `—` (bukan error)

---

## 9. Catatan Teknis

- Seluruh kalkulasi dilakukan di frontend (tidak ada API baru)
- `ΔG/L` dihitung: `journal[i].totalFloatRp - journal[i-1].totalFloatRp`
- Saham dengan `lastPrice = null` di-exclude dari ranking Top Gainer/Loser
- Untuk akun dengan beberapa saham: G/L akun = sum semua saham di akun tersebut
- Komponen chart: `LineChart` dari Recharts (sudah terinstall)
- Pertumbuhan YTD: jurnal difilter `journalDate LIKE "2026-%"`, ambil index 0 dan terakhir

---

## 10. Out of Scope

- Realized G/L dari transaksi jual (belum ada fitur catat penjualan)
- Perhitungan pajak capital gain (PPh atas keuntungan saham)
- Perbandingan return vs IHSG / benchmark indeks
- Export laporan ke PDF / Excel
- Notifikasi saat G/L melewati threshold tertentu

---
