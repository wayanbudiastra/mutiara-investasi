# PRD: Testing & Validasi Manual — Sync Data IDX ke Database

| | |
|---|---|
| **Produk** | Mutiara Investasi (mutiarainvestasi.com) |
| **Modul** | Infrastruktur Data — Validasi Sync IDX (Pra-syarat Modul Data Transaksi Pro) |
| **Status** | Draft |
| **Versi** | 1.0 |
| **Tanggal** | 21 Juni 2026 |

---

## 1. Latar Belakang

Sebelum mengaktifkan cron harian otomatis (`/api/cron/sync-idx`) dan sebelum membangun modul Pro **Data Transaksi** yang mengonsumsi data ini, perlu ada fase validasi manual untuk memastikan:

1. Tiga fungsi fetch (`getBrokerSummary`, `getForeignTradingFlow`, `getDomesticTradingFlow`) benar-benar berhasil mengambil data dari endpoint publik IDX
2. Data yang diambil tersimpan dengan benar ke tabel `BrokerSummary` dan `InvestorFlow`
3. Proses ini **idempotent** — dijalankan berkali-kali untuk tanggal yang sama tidak menghasilkan duplikasi/ menggandakan baris
4. Setelah data tersimpan, query analisa berikutnya **tidak perlu fetch API lagi** — cukup baca dari database

PRD ini adalah prasyarat sebelum PRD modul **Data Transaksi (Pro)** dapat dianggap siap dikerjakan, karena modul itu bergantung penuh pada data yang sudah tervalidasi tersimpan di sini.

## 2. Batasan & Konteks Teknis

- Endpoint sumber adalah endpoint publik tidak resmi `idx.co.id/primary/...` (lihat catatan di `lib/idx-client.ts` dan `README.md` project) — **bisa berubah/gagal tanpa pemberitahuan**, sehingga testing manual ini juga berfungsi sebagai *smoke test* kesehatan endpoint
- Fase ini **belum** mengaktifkan Vercel Cron — trigger sepenuhnya manual (lewat script lokal atau route API yang dipanggil langsung oleh developer)
- Scope: tiga fungsi sekaligus — `getBrokerSummary` (harian), `getForeignTradingFlow` (bulanan), `getDomesticTradingFlow` (bulanan)
- Tidak ada UI untuk end-user di PRD ini — seluruhnya tools internal untuk developer/QA

## 3. Tujuan

1. Memvalidasi bahwa pipeline fetch → simpan → query berjalan benar untuk ketiga sumber data
2. Mendeteksi sejak dini jika struktur response IDX berubah, sebelum cron otomatis diaktifkan
3. Memastikan mekanisme upsert mencegah duplikasi data saat dijalankan berulang
4. Menghasilkan log/report yang jelas soal apa yang berhasil dan apa yang gagal di setiap run

## 4. Kebutuhan Fungsional

| ID | Deskripsi | Prioritas |
|---|---|---|
| F1 | Tersedia satu cara trigger manual (script CLI atau route API yang dipanggil manual) yang menjalankan ketiga fetch sekaligus | Must |
| F2 | Setiap fetch yang berhasil langsung di-upsert ke tabel terkait (`BrokerSummary` untuk broker, `InvestorFlow` untuk foreign/domestic) | Must |
| F3 | Proses upsert menggunakan unique constraint (`date + brokerCode` untuk broker, `date + investorType` untuk flow) sehingga re-run untuk tanggal/bulan yang sama tidak menggandakan baris, hanya update nilai | Must |
| F4 | Setelah proses selesai, sistem menampilkan ringkasan hasil: jumlah baris tersimpan per sumber, dan daftar error per sumber jika ada | Must |
| F5 | Tersedia query verifikasi terpisah (script/endpoint read-only) yang membaca langsung dari database — bukan dari API — untuk membuktikan F2/F3 berjalan (lihat §6) | Must |
| F6 | Jika satu sumber gagal (misal foreign flow error), dua sumber lain tetap lanjut diproses — kegagalan tidak boleh saling menjalar (sudah konsisten dengan pola try-catch terpisah di `route.ts` yang ada) | Must |
| F7 | Log mencatat: waktu eksekusi, sumber data, jumlah baris diproses, durasi, dan pesan error spesifik jika gagal | Should |
| F8 | Hasil testing didokumentasikan dalam laporan singkat (lihat §7) untuk jadi rujukan sebelum mengaktifkan cron | Must |

## 5. Yang Bukan Scope (Out of Scope)

- Mengaktifkan Vercel Cron — itu langkah setelah PRD ini selesai dan tervalidasi
- UI end-user untuk menampilkan data (itu scope PRD **Data Transaksi (Pro)**)
- Monitoring/alerting otomatis jangka panjang (misal notifikasi kalau sync gagil di produksi) — dipertimbangkan setelah cron aktif, bukan di fase manual ini
- Historical backfill data lampau secara massal — fase ini fokus validasi proses untuk data harian/bulanan terbaru saja

## 6. Skenario Testing

Berikut skenario yang harus dieksekusi dan dicatat hasilnya secara manual.

| # | Skenario | Hasil yang Diharapkan |
|---|---|---|
| T1 | Jalankan trigger manual pertama kali untuk tanggal hari trading terakhir | Tiga sumber berhasil fetch, baris baru tersimpan di `BrokerSummary` dan `InvestorFlow` (2 baris: FOREIGN + DOMESTIC) |
| T2 | Jalankan ulang trigger yang sama tanpa ubah tanggal | Tidak ada baris baru bertambah (cek `COUNT(*)` sebelum/sesudah harus sama) — hanya `updatedAt`/nilai numerik yang ter-update jika ada revisi data dari IDX |
| T3 | Query langsung ke database (tanpa panggil API IDX) untuk tanggal yang sudah disinkron | Data berhasil diambil, response cepat (tidak ada network call ke idx.co.id) |
| T4 | Jalankan trigger pada hari libur pasar (tidak ada perdagangan) | `getBrokerSummary` mengembalikan kosong/null dengan wajar (tidak error/crash), proses lain tetap lanjut |
| T5 | Simulasikan satu sumber gagal (misal matikan akses sementara/ubah URL jadi salah secara sengaja saat test) | Dua sumber lain tetap berhasil tersimpan, error dari sumber yang gagal tercatat jelas di hasil ringkasan |
| T6 | Cek isi kolom numerik besar (value, volume) tidak corrupt akibat konversi `BigInt` | Nilai di database sama persis dengan nilai mentah dari response API (cocokkan manual minimal 3 baris sampel) |
| T7 | Jalankan trigger untuk bulan yang sudah lewat beberapa hari (foreign/domestic flow bulanan) | Seluruh hari dalam bulan tersebut tersimpan, termasuk hari-hari yang sudah disinkron sebelumnya (idempotent) |

## 7. Deliverable

1. **Script atau route trigger manual** — interface sederhana untuk menjalankan ketiga fetch (bisa CLI seperti `test-idx-connection.ts` yang sudah ada, diperluas agar langsung menyimpan ke DB, atau memanggil langsung route `/api/cron/sync-idx` dengan bearer token secara manual)
2. **Script verifikasi database** — query terpisah yang membaca dari `BrokerSummary` dan `InvestorFlow` untuk konfirmasi data tersimpan benar, tanpa menyentuh API IDX sama sekali
3. **Laporan hasil testing** — dokumen singkat (bisa markdown) yang mencatat hasil T1–T7: tanggal dijalankan, hasil tiap skenario, dan anomali jika ada
4. **Keputusan go/no-go** — rekomendasi tertulis apakah cron harian sudah aman diaktifkan berdasarkan hasil testing ini

## 8. Kriteria Sukses (Definition of Done)

- [ ] Ketiga sumber data berhasil di-fetch dan tersimpan minimal satu kali tanpa error
- [ ] Re-run untuk data yang sama terbukti tidak menggandakan baris (T2 lolos)
- [ ] Query analisa terbukti bisa dilakukan murni dari database tanpa panggilan API tambahan (T3 lolos)
- [ ] Skenario kegagalan parsial (T5) terbukti tidak menjalar ke sumber data lain
- [ ] Laporan hasil testing (§7.3) selesai ditulis dan disetujui sebelum cron harian diaktifkan

## 9. Pertanyaan Terbuka

- [ ] Apakah perlu tabel log terpisah (misal `SyncLog`) untuk mencatat riwayat setiap run secara permanen, atau cukup console log untuk fase manual ini?
- [ ] Untuk T5 (simulasi gagal), apakah ada cara aman menyimulasikan kegagalan tanpa benar-benar mengganggu endpoint asli (misal lewat env var toggle atau mock)?
- [ ] Berapa lama fase testing manual ini berjalan sebelum diputuskan layak lanjut ke cron otomatis — beberapa hari trading berturut-turut, atau cukup sekali lolos semua skenario?