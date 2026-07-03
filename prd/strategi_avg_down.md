# PRD: Modul Pro — Strategi Average Down

| | |
|---|---|
| **Produk** | Mutiara Investasi (mutiarainvestasi.com) |
| **Modul** | Strategi Average Down (Pro) |
| **Status** | Draft |
| **Versi** | 1.0 |
| **Tanggal** | 3 Juli 2026 |

---

## 1. Latar Belakang

Average down (membeli lagi saham yang sama saat harganya turun untuk menurunkan harga rata-rata) adalah strategi yang umum dipakai investor ritel, tapi sering dilakukan **tanpa rencana**: modal habis di penurunan pertama, tidak ada level harga yang disiapkan, dan tidak tahu berapa harga rata-rata baru setelah beli. Akibatnya average down yang seharusnya menurunkan break-even malah membuat investor kehabisan amunisi di harga yang masih tinggi.

Modul **Strategi Average Down** membantu user menyusun rencana average down yang terukur **sebelum** harga turun: membagi modal ke beberapa tahap (tranche) pada level-level harga yang ditentukan, dan menunjukkan proyeksi harga rata-rata baru di setiap tahap.

Modul ini berstatus **Pro** — hanya dapat diakses oleh user dengan subscription aktif, konsisten dengan modul Pro lain (Portofolio, Data Transaksi, Data Index).

## 2. Batasan & Posisi Fitur — WAJIB DIBACA SEBELUM IMPLEMENTASI

| Aspek | Kenyataan |
|---|---|
| Sifat fitur | **Kalkulator/perencana mekanis** — menghitung level harga, alokasi modal, dan harga rata-rata hasil. Fitur ini TIDAK memprediksi arah harga dan TIDAK menilai apakah saham tertentu layak di-average down |
| Risiko strategi | Average down menambah eksposur pada saham yang sedang turun. Untuk saham yang fundamentalnya memburuk, average down memperbesar kerugian ("catching a falling knife") |
| Implikasi copy/UI | Wajib ada disclaimer permanen bahwa ini alat bantu hitung, bukan rekomendasi beli. Dilarang memakai istilah yang mengesankan kepastian ("harga pasti mantul", "level aman", "sinyal beli") |
| Data pendukung | Harga terkini dari Yahoo Finance (infrastruktur `/api/portfolio/price` yang sudah ada) dan net asing per saham dari `stock_summaries` (modul Data Transaksi) boleh ditampilkan sebagai **konteks**, dengan label jelas bahwa itu bukan sinyal |

## 3. Tujuan

1. Membantu user Pro menyusun rencana average down bertahap yang terukur (level harga, alokasi modal per tahap) sebelum harga bergerak
2. Menunjukkan secara transparan matematika average down: harga rata-rata baru, penurunan break-even, dan sisa modal di setiap tahap
3. Memanfaatkan data yang sudah ada di platform (harga Yahoo, posisi portfolio, net asing) tanpa sumber data baru

## 4. Target Pengguna

User dengan subscription **Pro** aktif. Fitur tetap bisa dipakai untuk saham yang belum dimiliki (perencanaan pembelian bertahap dari nol), namun nilai terbesar untuk user yang sudah punya posisi di portfolio.

## 5. Input & Parameter

### 5.1 Input dari User

| Field | Tipe | Keterangan |
|---|---|---|
| Kode saham | Text/combobox, wajib | Uppercase otomatis. Jika saham ada di portfolio user → prefill posisi awal (lihat 5.2) |
| Harga saat ini | Number (Rp), wajib | Auto-isi dari cache harga portfolio / tombol "Ambil Harga" (Yahoo Finance), tetap bisa diedit manual |
| Jumlah modal | Number (Rp), wajib | Total dana yang disiapkan KHUSUS untuk average down (di luar posisi yang sudah ada) |
| Jangka waktu | Pilihan: Pendek / Menengah / Panjang, wajib | Menentukan jumlah tahap dan kedalaman interval — lihat 5.3 |
| Posisi awal (opsional) | Harga rata-rata + jumlah lot | Prefill otomatis dari portfolio jika kode saham cocok; bisa dikosongkan (mulai dari nol) atau diedit manual |
| Override manual (opsional, mode lanjutan) | Jumlah tahap + interval penurunan (%) | Collapse/expandable ("Atur manual"). Terisi otomatis sesuai preset jangka waktu yang dipilih; user bisa mengubah keduanya. Mengubah pilihan jangka waktu me-reset nilai override ke preset |

### 5.2 Prefill dari Portfolio

Jika kode saham yang diinput ada di tabel `portfolios` milik user (agregasi semua akun sekuritas):
- Harga rata-rata awal = rata-rata tertimbang `hargaRata` semua baris saham tersebut
- Lot awal = total `lot`
- User bisa override manual (misal hanya ingin menghitung untuk satu akun)

### 5.3 Parameter per Jangka Waktu

Semakin panjang jangka waktu, semakin banyak tahap dan semakin dalam jarak antar level — sesuai prinsip "semakin lama, frekuensi average down semakin tersebar".

| Jangka Waktu | Horizon | Jumlah Tahap (tranche) | Interval Penurunan per Tahap |
|---|---|---|---|
| Pendek | < 3 bulan | 2 | -7% dari level sebelumnya |
| Menengah | 3–12 bulan | 3 | -10% dari level sebelumnya |
| Panjang | > 12 bulan | 5 | -12% dari level sebelumnya |

> Angka di atas adalah **preset default** — user dapat meng-override jumlah tahap dan interval secara manual lewat mode lanjutan (§5.1, keputusan produk 3 Juli 2026). Nilai preset disimpan sebagai konstanta konfigurasi di satu tempat agar mudah disesuaikan tanpa mengubah logika.
>
> Batas wajar untuk override manual: jumlah tahap 1–10, interval penurunan 1%–50% per tahap.

### 5.4 Alokasi Modal Antar Tahap

Dua metode, user bisa memilih (default: **Piramida**):

1. **Piramida** — bobot membesar di harga lebih rendah (rasio 1 : 2 : 3 : ... sesuai jumlah tahap). Lebih efektif menurunkan harga rata-rata karena porsi terbesar dibeli di harga terendah.
2. **Rata (Equal)** — modal dibagi sama besar per tahap. Lebih sederhana dipahami.

Pembelian dibulatkan ke bawah ke kelipatan **1 lot (100 lembar)**. Sisa pembulatan diakumulasikan sebagai "modal tidak terpakai" dan ditampilkan.

## 6. Output — Rencana Average Down

### 6.1 Tabel Rencana per Tahap

| Kolom | Isi |
|---|---|
| Tahap | 1, 2, 3, ... |
| Level Harga | Harga trigger beli (hasil interval §5.3, dibulatkan ke tick size harga BEI) |
| Turun dari Harga Awal | % kumulatif penurunan dari harga saat ini |
| Lot Dibeli | Jumlah lot pada tahap ini (kelipatan 100 lembar) |
| Modal Terpakai | Rp pada tahap ini |
| Harga Rata-rata Baru | Rata-rata tertimbang kumulatif SETELAH tahap ini tereksekusi (termasuk posisi awal jika ada) |
| Penurunan Avg | % penurunan harga rata-rata dibanding sebelum tahap ini |
| Jarak ke Break-even | % kenaikan yang dibutuhkan dari level harga tahap ini agar posisi balik modal |

### 6.2 Ringkasan Akhir

- Total lot akhir & total modal terpakai jika **seluruh** tahap tereksekusi
- Harga rata-rata akhir vs harga rata-rata awal (dan vs harga saat ini)
- Modal tidak terpakai (sisa pembulatan lot)
- Grafik sederhana (bar/line) harga rata-rata per tahap — opsional v1.0, boleh tabel saja dulu

### 6.3 Konteks Data (bukan sinyal)

Panel samping menampilkan, dengan label "Konteks — bukan sinyal beli/jual":
- Harga terakhir + waktu update (cache Yahoo)
- Net asing saham ini beberapa hari terakhir (dari `stock_summaries`, modul Data Transaksi) — hanya jika datanya tersedia

## 7. User Flow

```
[Sidebar] → klik "Strategi Avg Down" (badge Pro)
   │
   ▼
[Halaman: Form Input]
   - Kode saham (prefill posisi jika ada di portfolio)
   - Harga saat ini (tombol ambil harga)
   - Modal average down
   - Jangka waktu (Pendek/Menengah/Panjang)
   - Metode alokasi (Piramida/Rata)
   │  klik "Hitung Rencana"
   ▼
[Hasil: Tabel Rencana + Ringkasan + Konteks]
   - Disclaimer permanen di atas hasil
   - Ubah input → hasil dihitung ulang (client-side, tanpa reload)
```

User non-Pro: menu tetap terlihat dengan badge Pro → klik → `ProGate` (pola yang sama dengan modul Pro lain).

## 8. Kebutuhan Fungsional

| ID | Deskripsi | Prioritas |
|---|---|---|
| F1 | Menu "Strategi Avg Down" di sidebar dengan badge Pro | Must |
| F2 | Validasi Pro server-side (`checkProAccess`) di setiap API route modul ini — bukan hanya di frontend | Must |
| F3 | Form input sesuai §5.1 dengan validasi (harga > 0, modal > 0, kode saham tidak kosong) | Must |
| F4 | Prefill posisi awal dari portfolio user jika kode saham cocok (§5.2) | Must |
| F5 | Kalkulasi rencana sesuai §5.3–§6.2, seluruhnya deterministik dan bisa diverifikasi manual | Must |
| F6 | Level harga dibulatkan mengikuti fraksi harga (tick size) BEI: <Rp200 = Rp1, Rp200–<500 = Rp2, Rp500–<2.000 = Rp5, Rp2.000–<5.000 = Rp10, ≥Rp5.000 = Rp25 | Must |
| F7 | Tombol "Ambil Harga" memakai infrastruktur harga yang sudah ada (`/api/portfolio/price`) — tidak membuat integrasi Yahoo baru | Must |
| F8 | Disclaimer permanen (tidak bisa di-dismiss) di halaman hasil | Must |
| F9 | Pilihan metode alokasi Piramida/Rata (§5.4), default Piramida | Should |
| F10 | Panel konteks net asing (§6.3) jika data tersedia di `stock_summaries` | Should |
| F11 | Kalkulasi berjalan client-side setelah data awal dimuat (respons instan saat user mengubah input) | Should |
| F12 | Override manual jumlah tahap & interval penurunan (mode lanjutan, §5.1 & §5.3) dengan validasi batas wajar; ganti jangka waktu me-reset override ke preset | Must |

## 9. Yang Bukan Scope (Out of Scope v1.0)

1. **Menyimpan rencana** ke database & memantau eksekusinya (alert saat harga menyentuh level) — kandidat kuat v1.1, butuh desain notifikasi
2. **Rekomendasi apakah saham layak di-average down** (analisa fundamental/teknikal) — di luar posisi produk, lihat §2
3. Average down berbasis waktu (DCA berkala per bulan tanpa level harga) — strategi berbeda, bisa jadi modul terpisah
4. Simulasi pajak/fee broker per transaksi — v1.0 mengabaikan fee; dicatat di disclaimer
5. Multi-saham dalam satu rencana

## 10. Pertanyaan Terbuka

- [x] ~~Apakah interval penurunan perlu bisa di-override manual oleh user?~~ **Diputuskan 3 Juli 2026: ya, bisa di-override manual** (jumlah tahap + interval, mode lanjutan) — lihat §5.1, §5.3, F12
- [ ] Kalibrasi default §5.3: apakah 2/3/5 tahap dan interval -7%/-10%/-12% sudah sesuai ekspektasi sebagai preset? (Dampaknya lebih kecil sekarang karena user bisa override, tapi preset tetap jadi pengalaman default mayoritas user)
- [ ] Rasio piramida 1:2:3:... vs 1:1.5:2:... — mana yang jadi default?
- [ ] Nama menu di sidebar: "Strategi Avg Down", "Average Down", atau "Rencana Beli Bertahap"?
- [ ] Apakah posisi awal prefill perlu bisa memilih per akun sekuritas, atau agregat semua akun cukup untuk v1.0?
