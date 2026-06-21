# PRD: Modul Pro — Data Transaksi

| | |
|---|---|
| **Produk** | Mutiara Investasi (mutiarainvestasi.com) |
| **Modul** | Data Transaksi (Pro) |
| **Status** | Draft |
| **Versi** | 1.0 |
| **Tanggal** | 21 Juni 2026 |

---

## 1. Latar Belakang

Investor ritel yang aktif memantau portfolio sering ingin tahu bagaimana aktivitas broker bergerak pada hari yang sama dengan saham yang mereka pegang — sebagai konteks tambahan saat membaca pergerakan harga. Modul **Data Transaksi** menyediakan akses cepat dari daftar saham di portfolio user ke ringkasan aktivitas broker harian, dalam satu alur navigasi yang sederhana.

Modul ini berstatus **Pro** — hanya dapat diakses oleh user dengan subscription aktif (terintegrasi dengan Midtrans yang sudah disiapkan di project).

## 2. Batasan Data — WAJIB DIBACA SEBELUM IMPLEMENTASI

Ini adalah bagian paling penting dari PRD ini. Salah pengertian di poin ini akan menyebabkan engineer membangun ekspektasi UI yang salah, dan berisiko fitur ini menyesatkan user soal apa yang sebenarnya mereka lihat.

| Aspek | Kenyataan |
|---|---|
| Sumber data broker | Endpoint publik `idx.co.id` (`GetBrokerSummary`) — sudah terintegrasi di `lib/idx-client.ts` dan tersinkron harian ke tabel `BrokerSummary` |
| Granularitas data broker | **Market-wide** — total transaksi (beli + jual digabung) tiap broker, across **seluruh saham di market**, per hari |
| Apakah ada data broker spesifik per saham? | **Tidak.** Endpoint publik IDX tidak menyediakan breakdown "broker mana net buy di saham X". Data ini (sering disebut komunitas sebagai *bandarmology*) hanya tersedia di layanan berbayar (Stockbit, RTI, Invezgo, dll) dan tidak termasuk scope PRD ini |
| Implikasi untuk fitur ini | Saat user memilih saham dari portfolio, tabel broker yang muncul **bukan** broker yang bertransaksi di saham itu — melainkan ranking broker paling aktif di **seluruh market** pada hari itu. Saham yang dipilih berfungsi sebagai *anchor* konteks (tanggal acuan, dan ruang untuk menampilkan data harga saham itu sendiri), bukan filter ke data broker |

**Keputusan desain yang mengikuti dari batasan ini:**
- UI harus secara eksplisit memberi tahu user bahwa tabel broker adalah data market-wide, bukan spesifik saham yang dipilih (lihat §5.3 dan §6 — wireframe & copy)
- Dilarang memberi label seperti "broker yang bertransaksi di [SAHAM]" atau sejenisnya yang mengisyaratkan keterkaitan langsung
- Dilarang memberi label "bandar", "smart money", atau istilah sejenis pada ranking broker ini — itu klaim yang tidak didukung data yang tersedia

Jika di masa depan Mutiara Investasi berlangganan data provider berbayar yang punya breakdown per-saham, modul ini perlu revisi besar (lihat §9 Pengembangan Lanjutan).

## 3. Tujuan

1. Memberi user Pro akses cepat dari portfolio mereka ke ringkasan aktivitas broker harian sebagai konteks tambahan
2. Mendorong konversi user gratis → Pro dengan fitur yang terasa "data profesional" namun tetap jujur soal sumbernya
3. Memanfaatkan data yang sudah tersinkron (`BrokerSummary`) tanpa perlu sumber data baru

## 4. Target Pengguna

User dengan subscription **Pro** aktif yang sudah memiliki minimal satu entri saham di portfolio mereka.

## 5. User Flow

### 5.1 Alur Utama

```
[Sidebar/Menu Utama]
   └─ klik "Data Transaksi"
        │
        ▼
[Halaman: Daftar Saham Portfolio]
   - Menampilkan semua saham yang dimiliki user (dari data portfolio existing)
   - Setiap item: kode saham, nama perusahaan, jumlah lot/lembar (opsional, kalau sudah ada di data portfolio)
        │
        ├─ klik salah satu saham
        ▼
[Halaman: Detail — Saham [KODE] + Data Transaksi Broker]
   - Header: kode saham, nama perusahaan, tanggal data (default: hari trading terakhir)
   - Banner info: "Data broker di bawah adalah ringkasan aktivitas broker market-wide,
     bukan spesifik untuk saham ini" (wajib selalu tampil, tidak bisa di-dismiss permanen)
   - Tabel: Top Broker by Activity (value/volume/frequency) — dari endpoint
     /api/brokers/top yang sudah dibangun
   - Selector tanggal: user bisa pilih tanggal lain (dibatasi ke tanggal yang tersedia di DB)
   - Selector metric: Value / Volume / Frekuensi
```

### 5.2 Alur Akses Tanpa Subscription Pro

Jika user belum Pro:
- Menu "Data Transaksi" tetap terlihat di sidebar (untuk awareness/marketing) namun diberi badge "Pro"
- Klik menu → tampilkan halaman upsell singkat dengan CTA ke flow subscription Midtrans yang sudah ada
- Tidak ada partial preview data (hindari "intip data lalu paywall" yang terasa memaksa — cukup jelaskan value proposition)

### 5.3 State Kosong

Jika user Pro tapi belum punya saham di portfolio:
- Tampilkan empty state: "Belum ada saham di portfolio kamu" + CTA ke halaman tambah saham/portfolio

## 6. Wireframe & Copy (Acuan untuk Desain/Implementasi)

### 6.1 Halaman Daftar Saham

```
┌─────────────────────────────────────────┐
│  Data Transaksi                    [Pro]│
│  Pilih saham dari portfolio kamu untuk   │
│  melihat ringkasan aktivitas broker      │
│                                           │
│  ┌─────────────────────────────────┐    │
│  │ BBRI   Bank Rakyat Indonesia    │ →  │
│  │ 200 lot                          │    │
│  ├─────────────────────────────────┤    │
│  │ BBCA   Bank Central Asia        │ →  │
│  │ 50 lot                           │    │
│  └─────────────────────────────────┘    │
└─────────────────────────────────────────┘
```

### 6.2 Halaman Detail

```
┌─────────────────────────────────────────┐
│  ← BBRI — Bank Rakyat Indonesia          │
│  Data per 20 Jun 2026          [Ganti tanggal ▾] │
│                                           │
│  ⓘ Data di bawah adalah ringkasan         │
│  aktivitas broker market-wide (seluruh   │
│  saham), bukan spesifik untuk BBRI.      │
│  Data broker per saham belum tersedia    │
│  di Mutiara Investasi.                   │
│                                           │
│  Top Broker by Activity                  │
│  [Value] [Volume] [Frekuensi]            │
│  ┌─────────────────────────────────┐    │
│  │ # │ Broker │ Total Value │ Share│    │
│  │ 1 │ YP ...  │ Rp1.28T    │ 8.4% │    │
│  │ 2 │ PD ...  │ Rp1.10T    │ 7.2% │    │
│  │...│         │             │      │    │
│  └─────────────────────────────────┘    │
└─────────────────────────────────────────┘
```

**Catatan copywriting:** kalimat disclaimer di atas adalah teks minimum yang wajib ada secara substansi — boleh diparafrase agar lebih natural, tapi makna "data ini market-wide, bukan spesifik saham yang dipilih" harus tetap eksplisit dan tidak boleh dihilangkan.

## 7. Kebutuhan Fungsional

| ID | Deskripsi | Prioritas |
|---|---|---|
| F1 | Menu "Data Transaksi" muncul di navigasi utama, dengan badge Pro untuk user non-Pro | Must |
| F2 | Sistem memvalidasi status subscription Pro sebelum render konten halaman (server-side check, bukan hanya UI hide) | Must |
| F3 | Halaman daftar saham menarik data dari tabel portfolio user yang sudah ada | Must |
| F4 | Klik item saham membawa user ke halaman detail dengan kode saham sebagai parameter route (misal `/data-transaksi/BBRI`) | Must |
| F5 | Halaman detail menampilkan banner disclaimer yang tidak bisa di-dismiss permanen (boleh collapse tapi harus ada indikator ⓘ permanen) | Must |
| F6 | Halaman detail menampilkan tabel Top Broker by Activity dari endpoint `/api/brokers/top`, default tanggal hari trading terakhir | Must |
| F7 | User bisa ganti tanggal (dibatasi ke tanggal yang ada datanya di `BrokerSummary`) | Should |
| F8 | User bisa ganti metric tampilan (Value/Volume/Frekuensi) | Should |
| F9 | Empty state untuk user Pro tanpa saham di portfolio | Should |
| F10 | Halaman upsell untuk user non-Pro yang klik menu ini | Must |

## 8. Kebutuhan Non-Fungsional

- **Performa**: data broker diambil dari tabel lokal (`BrokerSummary`), bukan fetch live ke IDX — sesuai arsitektur sync harian yang sudah dibangun, sehingga response API harus di bawah 500ms untuk kondisi normal
- **Caching**: pertimbangkan cache response `/api/brokers/top` per kombinasi (tanggal, metric) karena datanya immutable setelah hari itu selesai sinkron — konsisten dengan pola caching yang sudah diterapkan di modul rekap dividen
- **Akses kontrol**: re-cek validasi Pro di level API route, jangan hanya di level halaman frontend
- **Auditability**: jika nanti ada pertanyaan dari user soal akurasi data, tim harus bisa trace balik ke tanggal sync dan endpoint sumber

## 9. Pengembangan Lanjutan (Out of Scope untuk v1.0)

Dicatat di sini supaya jelas ini bukan terlupa, melainkan keputusan sengaja untuk v1.0:

1. **Data broker per-saham** — butuh evaluasi provider berbayar (Stockbit API, Invezgo, dll) sebelum bisa dikerjakan. Akan jadi PRD terpisah jika diputuskan untuk dikembangkan
2. **Grafik tren broker activity** (mingguan/bulanan) — bisa dibangun dari data historis `BrokerSummary` yang sudah tersimpan, tidak butuh sumber data baru, cocok untuk v1.1
3. **Notifikasi/alert** jika ada broker baru masuk top-N — di luar scope v1.0
4. **Export data ke Excel/PDF** — di luar scope v1.0, evaluasi demand dulu

## 10. Pertanyaan Terbuka

- [ ] Apakah jumlah lot/lembar perlu ditampilkan di daftar saham (F3), atau cukup kode + nama saham saja untuk v1.0?
- [ ] Berapa hari ke belakang yang masuk akal untuk selector tanggal (F7)? Disarankan dibatasi ke 30 hari terakhir dulu untuk v1.0, mengingat volume data growing harian
- [ ] Apakah perlu rate-limit khusus di endpoint `/api/brokers/top` untuk mencegah abuse dari user Pro yang sering ganti-ganti tanggal/metric secara cepat?