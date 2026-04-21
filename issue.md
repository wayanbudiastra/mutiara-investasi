# Issue Tracker — Modul Rekap Dividen

---

## ISSUE-001 · Pencarian Sekuritas pada Form Input Dividen

**Modul:** Rekap Dividen — Form Tambah / Edit  
**Prioritas:** Tinggi  
**Status:** Open

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
**Status:** Open

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
**Status:** Open

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

## Catatan Umum

- Semua perubahan mengikuti konsep yang sudah ada: PostgreSQL Neon, Prisma raw queries (`$1, $2, ...`), UI style `max-w-7xl`, pagination pattern sama dengan halaman Riwayat Simulasi dan Daftar Sekuritas
- `issue.md` ini akan diperbarui seiring progres pengerjaan
