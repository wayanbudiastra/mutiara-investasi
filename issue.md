# Issue Tracker — Modul Rekap Dividen

---

## ISSUE-001 · Pencarian Sekuritas pada Form Input Dividen

**Modul:** Rekap Dividen — Form Tambah / Edit  
**Prioritas:** Tinggi  
**Status:** Closed ✅

### Deskripsi
Pada saat user hendak memilih akun sekuritas di form input dividen, dropdown hanya menampilkan daftar statis tanpa fitur pencarian. Jika user memiliki banyak sekuritas terdaftar, proses pemilihan menjadi tidak efisien.

### Expected Behavior
- Dropdown pemilihan sekuritas dilengkapi dengan input pencarian (searchable select / combobox)
- User dapat mengetik nama atau kode sekuritas untuk memfilter pilihan secara real-time
- Hasil filter menampilkan nama sekuritas yang cocok

### Acceptance Criteria
- [ ] Tersedia input teks di dalam dropdown untuk pencarian
- [ ] Filter berjalan real-time saat user mengetik
- [ ] Pencarian berdasarkan nama sekuritas
- [ ] Jika tidak ada hasil, tampilkan pesan "Sekuritas tidak ditemukan"
- [ ] Pilihan tetap dapat di-scroll jika hasil lebih dari 5 item

---

## ISSUE-002 · Paging pada Tabel Data Dividen

**Modul:** Rekap Dividen — Tab Data Dividen  
**Prioritas:** Tinggi  
**Status:** Closed ✅

### Deskripsi
Tabel data dividen saat ini menampilkan semua data sekaligus tanpa pagination. Seiring bertambahnya data, performa halaman akan menurun dan tampilan menjadi tidak rapi.

### Expected Behavior
- Tabel menampilkan maksimal **10 baris per halaman** (default)
- Data diambil dari server dengan limit **100 baris** dan diurutkan **DESC** berdasarkan tahun dan tanggal input
- Tersedia kontrol navigasi halaman (Prev / Next / nomor halaman)
- Informasi jumlah data ditampilkan (contoh: "Menampilkan 1–10 dari 87 data")

### Acceptance Criteria
- [ ] Default 10 data per halaman
- [ ] Query ke API menggunakan `ORDER BY tahun DESC, createdAt DESC`
- [ ] API membatasi maksimal 100 baris data yang diambil
- [ ] Kontrol pagination: « Prev [1] [2] [3] Next »
- [ ] Tampil info range data yang sedang ditampilkan
- [ ] Pagination tetap berfungsi saat filter saham / status aktif
- [ ] Reset ke halaman 1 saat filter berubah

---

## ISSUE-003 · Summary Card Dividen Hanya Menghitung Year To Date (YTD)

**Modul:** Rekap Dividen — Summary Cards  
**Prioritas:** Medium  
**Status:** Closed ✅

### Deskripsi
Summary card yang menampilkan **Total Terealisasi (DONE)**, **Total Estimasi**, dan **Total Keseluruhan** saat ini menghitung akumulasi seluruh data dari semua tahun. Seharusnya card summary hanya menampilkan data **Year To Date (YTD)** — yaitu total dari tahun berjalan saja.

Rekap total keseluruhan per tahun akan disajikan di halaman terpisah.

### Expected Behavior
- Summary card menghitung total dividen untuk **tahun berjalan** saja (contoh: 2026)
- Label card ditambahkan keterangan tahun, contoh: **"Total Terealisasi 2026"**
- Data tahun-tahun sebelumnya tidak ikut dihitung di summary card
- Halaman rekap total tahunan (multi-year) dibuat sebagai halaman / tab terpisah

### Acceptance Criteria
- [ ] Filter YTD menggunakan tahun dari `new Date().getFullYear()`
- [ ] Label card menyertakan tahun berjalan (contoh: "Total Terealisasi 2026")
- [ ] Total Estimasi YTD hanya menghitung data dengan `status = 'ESTIMASI'` dan `tahun = currentYear`
- [ ] Total Terealisasi YTD hanya menghitung data dengan `status = 'DONE'` dan `tahun = currentYear`
- [ ] Total Keseluruhan YTD = Total DONE + Total ESTIMASI tahun berjalan
- [ ] Halaman / tab rekap tahunan multi-year dibuat terpisah (scope issue berikutnya)

---

## ISSUE-004 · Rekap Chart Menampilkan Maksimal 5 Tahun Terakhir

**Modul:** Rekap Dividen — Tab Rekap Chart  
**Prioritas:** Medium  
**Status:** Closed ✅

### Deskripsi
Tab Rekap Chart saat ini menampilkan semua tahun yang ada di data dividen (status DONE) tanpa batasan. Jika data sudah mencakup banyak tahun, bar chart dan tabel summary menjadi terlalu lebar dan sulit dibaca. Cukup tampilkan **5 tahun terakhir** saja.

### Expected Behavior
- Bar chart hanya menampilkan kolom untuk **5 tahun terakhir** (dihitung mundur dari tahun terbaru yang ada di data)
- Tabel "Total Per Akun Per Tahun" hanya menampilkan kolom 5 tahun terakhir
- Grand Total pada tabel dihitung berdasarkan 5 tahun yang ditampilkan saja
- Jika data kurang dari 5 tahun, tampilkan semua tahun yang tersedia

### Acceptance Criteria
- [ ] Ambil daftar tahun unik dari `doneDividends`, urutkan DESC, slice 5 teratas, lalu sort ASC untuk tampilan kiri-ke-kanan
- [ ] Bar chart hanya render `<Bar>` untuk 5 tahun tersebut
- [ ] Kolom tabel summary hanya menampilkan 5 tahun tersebut
- [ ] Grand Total kolom per tahun dan kolom Total konsisten dengan data yang ditampilkan
- [ ] Jika data < 5 tahun, tampilkan semua tahun yang ada (tidak ada error)

---

## ISSUE-005 · Tab Rekap By Sekuritas

**Modul:** Rekap Dividen — Tab Baru  
**Prioritas:** Medium  
**Status:** Closed ✅

### Deskripsi
Saat ini tab Rekap Chart menampilkan perbandingan antar akun sekuritas secara keseluruhan. Dibutuhkan tab baru **"Rekap By Sekuritas"** yang memungkinkan user memilih satu akun sekuritas lalu melihat detail performa per saham dan per tahun khusus untuk akun tersebut. Tujuannya agar user bisa mengevaluasi kontribusi tiap saham di masing-masing akun sekuritas dari tahun ke tahun.

### Expected Behavior
- Tab baru disisipkan di antara tab **"Rekap Chart"** dan akhir tab list, dengan label **"Rekap By Sekuritas"**
- Di dalam tab terdapat **dropdown pemilihan sekuritas** (hanya akun yang memiliki data DONE)
- Setelah sekuritas dipilih, tampil:
  - **Tabel**: baris = kode saham, kolom = tahun (5 tahun terakhir), kolom terakhir = Total per saham
  - **Baris Grand Total**: jumlah dividen seluruh saham per tahun dan total keseluruhan
  - **Bar chart**: sumbu X = kode saham, batang per warna = tahun, hanya 5 tahun terakhir
- Jika sekuritas belum dipilih, tampilkan placeholder "Pilih sekuritas untuk melihat rekap"
- Jika sekuritas dipilih tapi tidak ada data, tampilkan "Belum ada data DONE untuk sekuritas ini"

### Acceptance Criteria
- [ ] Tab "Rekap By Sekuritas" muncul setelah tab "Rekap Chart"
- [ ] Dropdown hanya menampilkan sekuritas yang memiliki minimal 1 data dengan status DONE
- [ ] Data yang ditampilkan hanya status DONE (terealisasi)
- [ ] Tabel mengelompokkan data per `saham` (baris) dan per `tahun` (kolom)
- [ ] Kolom tahun dibatasi 5 tahun terakhir dari data yang ada (bukan dari tahun berjalan)
- [ ] Baris Grand Total menjumlahkan seluruh saham per kolom tahun
- [ ] Bar chart menggunakan komponen Recharts yang sudah ada (`BarChart`, `Bar`, `XAxis`, `YAxis`, `Tooltip`, `Legend`)
- [ ] Bar chart: sumbu X = kode saham, batang = per tahun (max 5 warna dari `YEAR_COLORS`)
- [ ] Format angka konsisten menggunakan fungsi `rp()` yang sudah ada
- [ ] Responsive dan mengikuti style `max-w-7xl` yang sudah digunakan

---

## ISSUE-006 · Filter ESTIMASI Tidak Menampilkan Semua Data karena Limit API

**Modul:** Rekap Dividen — API & Filter  
**Prioritas:** Tinggi  
**Status:** Closed ✅

### Deskripsi
API GET `/api/dividends` menerapkan `LIMIT 100` untuk semua data tanpa memisahkan status. Akibatnya, jika total data (DONE + ESTIMASI) sudah melebihi 100 baris, data ESTIMASI yang lebih lama bisa tergeser dan tidak dikembalikan oleh API. Filter ESTIMASI di halaman depan menjadi tidak lengkap karena data yang tidak ada di response tidak bisa ditampilkan.

### Root Cause
Query API mengambil 100 baris teratas berdasarkan `tahun DESC, createdAt DESC` tanpa memisahkan antara data ESTIMASI dan DONE.

### Expected Behavior
- Data ESTIMASI selalu ditampilkan **semua tanpa limit** — jumlahnya terbatas karena setiap data ESTIMASI akan berubah jadi DONE setelah direalisasi
- Data DONE dibatasi maksimal **500 baris terbaru** (cukup untuk keperluan rekap chart 5 tahun)
- Filter ESTIMASI di halaman selalu menampilkan data yang lengkap

### Acceptance Criteria
- [ ] API menggunakan UNION: semua ESTIMASI + max 500 DONE
- [ ] Filter status ESTIMASI di halaman menampilkan semua data ESTIMASI tanpa ada yang hilang
- [ ] Data DONE tetap terbatas agar performa query terjaga
- [ ] Tidak ada perubahan pada UI — hanya perubahan di query API

---

## ISSUE-007 · Fitur Pro — Modul Rekap Dividen di Balik Paywall dengan Pembayaran Midtrans

**Modul:** Subscription / Monetisasi  
**Prioritas:** Tinggi  
**Status:** Open

### Deskripsi
Modul Rekap Dividen (halaman `/dividends` beserta seluruh sub-fiturnya) akan dikunci sebagai fitur berbayar (**Paket Pro**). User yang belum berlangganan akan diarahkan ke halaman pricing. Pembayaran dilakukan melalui **Midtrans Snap** (mendukung kartu Visa/Mastercard, GoPay, QRIS, Transfer Bank, dll).

### Paket Langganan

| Paket | Durasi | Harga |
|-------|--------|-------|
| Bulanan | 1 Bulan | Rp 15.000 |
| Kuartalan | 3 Bulan | Rp 40.000 |
| Tahunan | 12 Bulan | Rp 100.000 |

### Cakupan Fitur yang Dikunci (Pro)
- Halaman `/dividends` — seluruh tab (Data Dividen, Rekap Chart, Rekap By Sekuritas)
- Halaman `/securities` — Daftar Sekuritas (karena berelasi dengan Rekap Dividen)

### Cakupan Fitur yang Tetap Gratis
- Halaman `/` — Simulasi
- Halaman `/history` — Riwayat Simulasi

---

### Scope Pengerjaan

#### 1. Database — Tabel Baru

**Tabel `subscriptions`**
```sql
id          TEXT PRIMARY KEY
userId      TEXT NOT NULL
plan        TEXT NOT NULL  -- 'MONTHLY' | 'QUARTERLY' | 'YEARLY'
status      TEXT NOT NULL  -- 'ACTIVE' | 'EXPIRED' | 'PENDING'
startedAt   TEXT NOT NULL
expiredAt   TEXT NOT NULL
createdAt   TEXT NOT NULL
updatedAt   TEXT NOT NULL
```

**Tabel `payments`**
```sql
id              TEXT PRIMARY KEY
userId          TEXT NOT NULL
subscriptionId  TEXT NOT NULL
orderId         TEXT NOT NULL UNIQUE  -- dikirim ke Midtrans
amount          INTEGER NOT NULL      -- dalam Rupiah
status          TEXT NOT NULL         -- 'PENDING' | 'PAID' | 'FAILED' | 'EXPIRED'
midtransToken   TEXT                  -- Snap token dari Midtrans
midtransTxId    TEXT                  -- transaction_id dari Midtrans
createdAt       TEXT NOT NULL
updatedAt       TEXT NOT NULL
```

---

#### 2. API Routes Baru

| Route | Method | Fungsi |
|-------|--------|--------|
| `/api/subscription/status` | GET | Cek status langganan aktif user |
| `/api/subscription/create` | POST | Buat order baru + ambil Snap token Midtrans |
| `/api/midtrans/webhook` | POST | Terima notifikasi pembayaran dari Midtrans |

**Logika `/api/subscription/create`:**
1. Buat record `payments` dengan status `PENDING` dan `orderId` unik (`INV-{userId}-{timestamp}`)
2. Panggil Midtrans API untuk membuat transaksi dan dapatkan `snap_token`
3. Return `snap_token` ke client untuk membuka Midtrans Snap popup

**Logika `/api/midtrans/webhook`:**
1. Verifikasi signature key dari Midtrans
2. Jika `transaction_status = settlement` atau `capture`: update payment → PAID, aktifkan/perpanjang subscription
3. Jika `transaction_status = expire` atau `cancel`: update payment → FAILED/EXPIRED

---

#### 3. Halaman Baru

**`/pricing`** — Halaman pilih paket:
- Tampil 3 card paket (Bulanan, Kuartalan, Tahunan)
- Highlight paket Tahunan sebagai "Paling Hemat"
- Tombol "Pilih Paket" membuka Midtrans Snap popup
- Setelah pembayaran sukses, redirect ke `/dividends`

**`/subscription`** — Halaman status langganan user:
- Info paket aktif, tanggal mulai, tanggal berakhir
- Tombol "Perpanjang" jika mendekati expired (< 7 hari)
- Riwayat pembayaran

---

#### 4. Feature Gating (Proteksi Halaman)

- Buat helper `checkProAccess(userId)` di `lib/subscription.ts`:
  - Query `subscriptions` WHERE userId = ? AND status = 'ACTIVE' AND expiredAt > now()
  - Return `{ hasAccess: boolean, expiredAt?: string }`

- Di `app/dividends/page.tsx` dan `app/securities/page.tsx`:
  - Panggil `/api/subscription/status` saat mount
  - Jika tidak aktif: tampilkan **Paywall component** (bukan redirect) dengan CTA ke `/pricing`

- Di `components/Sidebar.tsx`:
  - Tambahkan badge **PRO** pada menu "Rekap Dividen" dan "Daftar Sekuritas"
  - Jika user tidak punya langganan aktif, tampilkan icon gembok kecil

---

#### 5. Komponen UI Baru

- `components/ProGate.tsx` — Wrapper paywall:
  - Tampil ketika user belum Pro
  - Pesan: "Fitur ini tersedia untuk pengguna Pro"
  - Info harga singkat + tombol "Upgrade ke Pro"

- `components/PricingCard.tsx` — Card paket harga

---

### Acceptance Criteria

**Database & API:**
- [ ] Tabel `subscriptions` dan `payments` berhasil dibuat (raw SQL, konsisten dengan pola project)
- [ ] `POST /api/subscription/create` mengembalikan Midtrans Snap token
- [ ] `POST /api/midtrans/webhook` memverifikasi signature dan mengaktifkan subscription setelah pembayaran sukses
- [ ] `GET /api/subscription/status` mengembalikan status aktif/tidak beserta tanggal expired

**Halaman Pricing:**
- [ ] Menampilkan 3 pilihan paket dengan harga yang benar
- [ ] Midtrans Snap popup terbuka saat tombol "Pilih Paket" diklik
- [ ] Setelah pembayaran berhasil, subscription aktif dan user bisa akses Rekap Dividen

**Feature Gating:**
- [ ] `/dividends` menampilkan ProGate jika subscription tidak aktif
- [ ] `/securities` menampilkan ProGate jika subscription tidak aktif
- [ ] Sidebar menampilkan badge PRO dan/atau icon gembok pada menu yang dikunci

**Keamanan:**
- [ ] Webhook Midtrans memverifikasi signature key sebelum memproses
- [ ] Status subscription dicek di sisi server (tidak hanya client-side)

---

### Catatan Teknis
- Gunakan **Midtrans Snap.js** (client-side) untuk popup pembayaran
- Midtrans environment: Sandbox untuk dev, Production untuk live
- `orderId` harus unik per transaksi — gunakan format `INV-{userId}-{Date.now()}`
- Perpanjang subscription: `expiredAt` dihitung dari `expiredAt` lama jika masih aktif, atau dari `now()` jika sudah expired
- Midtrans Snap docs: https://snap-docs.midtrans.com

---

## Catatan Umum

- Semua perubahan mengikuti konsep yang sudah ada: PostgreSQL Neon, Prisma raw queries (`$1, $2, ...`), UI style `max-w-7xl`, pagination pattern sama dengan halaman Riwayat Simulasi dan Daftar Sekuritas
- `issue.md` ini akan diperbarui seiring progres pengerjaan
