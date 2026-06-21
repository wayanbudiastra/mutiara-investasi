# Laporan Hasil Testing — Sync Data IDX ke Database

| | |
|---|---|
| **Mengacu pada** | `prd/testing_koneksi_idx.md` |
| **Tanggal eksekusi** | 21 Juni 2026 |
| **Lingkungan** | Lokal (`npm run dev`, Postgres Neon — `DATABASE_URL` di `.env.local`) |
| **Dieksekusi oleh** | Claude Code (atas permintaan developer) |

## 1. Implementasi yang Dibuat

PRD ini ternyata mengasumsikan infrastruktur (`lib/idx-client.ts`, route cron, tabel DB, script CLI) yang **belum ada** di codebase. Sebelum testing, infrastruktur berikut dibangun dari nol:

| File | Fungsi |
|---|---|
| `lib/idx-client.ts` | `getBrokerSummary(date)`, `getForeignTradingFlow(year, month)`, `getDomesticTradingFlow(year, month)` — fetch ke endpoint publik idx.co.id, termasuk session/cookie handling & retry |
| `app/api/cron/sync-idx/route.ts` | Trigger manual (GET, bearer token via `IDX_SYNC_BEARER_TOKEN`), upsert ke DB, 3 sumber independen |
| `scripts/test-idx-connection.mjs` | CLI — panggil route di atas, cetak ringkasan hasil |
| `scripts/verify-idx-data.mjs` | CLI — query langsung ke Postgres tanpa sentuh API IDX sama sekali |
| Tabel `broker_summaries` (UNIQUE `date+brokerCode`), `investor_flows` (UNIQUE `date+investorType`) | Dibuat otomatis (`CREATE TABLE IF NOT EXISTS`) oleh route, pola raw-SQL konsisten dengan tabel lain di project (`portfolios`, `portfolio_cash`, dst) |

**Endpoint yang diverifikasi nyata (bisa berubah tanpa pemberitahuan dari IDX):**
- `GET https://www.idx.co.id/primary/TradingSummary/GetBrokerSummary?length=&start=&date=YYYYMMDD`
- `GET https://www.idx.co.id/primary/DigitalStatistic/GetApiData?urlName=LINK_TABLE_DAILY_TRADING_INVESTOR_FOREIGN&query=<base64{year,month,quarter:0,type:'monthly'}>&isPrint=False&cumulative=false`
- `GET .../GetApiData?urlName=LINK_TABLE_DAILY_TRADING_INVESTOR_DOMESTIC&...` (struktur sama)
- Ketiganya butuh session cookie dari `GET https://www.idx.co.id/id` lebih dulu (anti-bot sederhana) — tanpa cookie, response `403`.

**Catatan desain InvestorFlow:** endpoint foreign & domestic IDX hanya menyediakan matriks silang (`foreignForeignValue`, `foreignDomesticValue`, `domesticForeignValue`, `domesticDomesticValue`), bukan langsung "total buy/sell per investorType". `lib/idx-client.ts` menggabungkan kedua tabel per tanggal untuk menghitung total buy/sell FOREIGN dan DOMESTIC — lihat komentar di file.

## 2. Hasil Skenario T1–T7

| # | Skenario | Hasil | Keterangan |
|---|---|---|---|
| **T1** | Trigger pertama (`date=20260619`, `month=2026-05`) | ✅ **LOLOS** | broker: 88 baris, foreign: 16 baris, domestic: 16 baris. Total durasi ±5s. |
| **T2** | Re-run trigger sama tanpa ubah tanggal | ✅ **LOLOS** | `COUNT(*)` sebelum/sesudah identik (broker_summaries: 88→88, investor_flows: 32→32). `createdAt` tetap dari run pertama, `updatedAt` berubah ke run kedua — konfirmasi UPSERT nyata terjadi, bukan silent-skip. |
| **T3** | Query DB tanpa panggil API IDX | ✅ **LOLOS** | `scripts/verify-idx-data.mjs` membaca langsung dari Postgres, tidak ada network call ke idx.co.id, response instan. |
| **T4** | Trigger pada hari libur pasar (Minggu, `date=20260614`) | ✅ **LOLOS** | `getBrokerSummary` kembalikan 0 baris dengan wajar (tidak error), foreign/domestic (bulanan, tidak terpengaruh tanggal harian) tetap sukses 16 baris masing-masing. |
| **T5** | Simulasi kegagalan satu sumber (broker URL disabotase sementara, dikembalikan setelah test) | ✅ **LOLOS** | broker gagal dengan error tercatat jelas (`IDX GetBrokerSummary gagal: HTTP 503`), foreign & domestic tetap sukses (16 & 16 baris) — kegagalan tidak menjalar. |
| **T6** | Cek nilai numerik tidak corrupt | ✅ **LOLOS** | Sample dicocokkan manual antara response API mentah dan isi DB, contoh `2026-05-04 DOMESTIC: buy=12109383466314` = `foreignDomesticValue(3331088280724) + domesticDomesticValue(8778295185590)` — cocok persis. Kolom `BIGINT` menampung nilai triliunan tanpa presisi hilang. |
| **T7** | Trigger bulan yang sudah sebagian/seluruhnya tersinkron | ✅ **LOLOS** | Dibuktikan lewat T2 — re-run bulan Mei (sudah lengkap 16/16 baris) tidak menggandakan baris. |

## 3. Temuan/Anomali Penting

1. **Lag data bulanan investor flow** — saat dicoba untuk bulan **berjalan** (Juni 2026, bulan saat testing dilakukan), endpoint `LINK_TABLE_DAILY_TRADING_INVESTOR_FOREIGN/DOMESTIC` mengembalikan `data: []` kosong (terverifikasi langsung di response mentah, bukan bug kode). Broker summary (harian) untuk hari yang sama tetap tersedia normal. **Implikasi:** cron bulanan untuk foreign/domestic flow sebaiknya menyasar **bulan sebelumnya**, bukan bulan berjalan, atau sistem perlu toleran terhadap hasil kosong di awal/tengah bulan.
2. **Anti-bot IDX cukup sensitif** — pada simulasi T5, request berulang dalam interval pendek terhadap endpoint yang salah memicu HTTP `503` (bukan `404` yang diharapkan untuk path tidak valid), mengindikasikan rate-limiting/anti-bot bisa terpicu oleh trafik testing yang terlalu sering. **Implikasi:** beri jeda antar-run manual saat testing lanjutan, dan saat cron otomatis aktif jangan retry terlalu agresif.
3. Tidak ada tabel log permanen (`SyncLog`) dibuat — hasil run hanya tercatat di response API & `console.log`/`console.error` (lihat §9 PRD, pertanyaan terbuka #1). Cukup untuk fase manual ini.

## 4. Kriteria Sukses (Definition of Done) — Cross-check

- [x] Ketiga sumber data berhasil di-fetch dan tersimpan minimal satu kali tanpa error (T1)
- [x] Re-run untuk data yang sama terbukti tidak menggandakan baris (T2)
- [x] Query analisa terbukti bisa dilakukan murni dari database tanpa panggilan API tambahan (T3)
- [x] Skenario kegagalan parsial (T5) terbukti tidak menjalar ke sumber data lain
- [x] Laporan hasil testing (dokumen ini) selesai ditulis

## 5. Keputusan Go/No-Go

**GO — dengan catatan**, cron harian (`getBrokerSummary`) aman diaktifkan. Untuk foreign/domestic flow bulanan, **jadwalkan sync menyasar bulan sebelumnya** (bukan bulan berjalan) mengingat temuan §3.1, atau tambahkan logika fallback jika bulan berjalan kosong.

Rekomendasi sebelum mengaktifkan Vercel Cron:
1. Jadwalkan broker summary harian (selepas jam tutup pasar, WIB).
2. Jadwalkan foreign/domestic flow bulanan menyasar `month = bulan_sekarang - 1` (atau retry ke bulan sebelumnya jika data bulan berjalan kosong).
3. Tambah jeda/backoff antar-percobaan agar tidak memicu anti-bot IDX saat cron jalan otomatis tanpa pengawasan manual.
4. Pertanyaan terbuka §9 PRD soal tabel `SyncLog` permanen — disarankan ditunda sampai ada kebutuhan monitoring jangka panjang (sesuai scope PRD ini yang membatasi itu di luar scope).
