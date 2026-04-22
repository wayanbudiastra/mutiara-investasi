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

## Catatan Umum

- Semua perubahan mengikuti konsep yang sudah ada: PostgreSQL Neon, Prisma raw queries (`$1, $2, ...`), UI style `max-w-7xl`, pagination pattern sama dengan halaman Riwayat Simulasi dan Daftar Sekuritas
- `issue.md` ini akan diperbarui seiring progres pengerjaan
