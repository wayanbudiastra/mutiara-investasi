# PRD — Yahoo Finance Backup: Cache Harga Terakhir

**Modul:** Rekap Portofolio — Harga Real-time  
**Prioritas:** Medium  
**Status:** Open

---

## 1. Latar Belakang

Fitur Rekap Portofolio menggunakan `yahoo-finance2` untuk mengambil harga saham terkini dari Yahoo Finance secara real-time. Ketika Yahoo Finance tidak dapat diakses (timeout, rate limit, server down, atau saham tidak terdaftar), kolom **Harga Terakhir** menampilkan `—` dan seluruh kalkulasi Nilai Pasar serta Floating P/L tidak dapat ditampilkan.

Kondisi ini mengganggu pengalaman user karena seluruh data portofolio terlihat kosong padahal data kepemilikan saham (avg price, lot) tersedia.

---

## 2. Tujuan

- Menyimpan harga terakhir yang berhasil diambil dari Yahoo Finance ke dalam database
- Menggunakan harga cache sebagai fallback ketika Yahoo Finance gagal
- Menampilkan informasi transparansi kepada user bahwa harga yang ditampilkan adalah data cache beserta waktu pengambilannya
- Tidak mengubah alur utama — Yahoo Finance tetap menjadi sumber harga utama

---

## 3. User Flow

### Kondisi Normal (Yahoo Finance Berhasil)

```
User buka halaman Portofolio
  ↓
Fetch harga dari Yahoo Finance → Berhasil
  ↓
Simpan harga ke cache DB (update lastPrice & lastPriceAt)
  ↓
Tampilkan harga real-time di tabel
```

### Kondisi Fallback (Yahoo Finance Gagal)

```
User buka halaman Portofolio
  ↓
Fetch harga dari Yahoo Finance → Gagal / Timeout
  ↓
Ambil harga cache dari kolom lastPrice di tabel portfolios
  ↓
Tampilkan harga cache dengan badge "Cache" + tooltip waktu pengambilan
  ↓
Floating P/L tetap terhitung menggunakan harga cache
```

---

## 4. Perubahan Database

### Tambah Kolom ke Tabel `portfolios`

```sql
ALTER TABLE "portfolios"
  ADD COLUMN IF NOT EXISTS "lastPrice"   DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS "lastPriceAt" TEXT;
```

| Kolom | Type | Keterangan |
|-------|------|-----------|
| `lastPrice` | DOUBLE PRECISION | Harga terakhir yang berhasil diambil dari Yahoo Finance |
| `lastPriceAt` | TEXT | ISO timestamp saat harga berhasil diambil |

> Kedua kolom bersifat nullable — NULL jika harga belum pernah berhasil diambil sama sekali.

---

## 5. Perubahan API

### `GET /api/portfolio/price`

**Perubahan perilaku:**

1. Fetch harga dari Yahoo Finance untuk semua simbol unik
2. Untuk simbol yang **berhasil** diambil:
   - Update `lastPrice` dan `lastPriceAt` di tabel `portfolios`
   - Return harga real-time
3. Untuk simbol yang **gagal** diambil:
   - Ambil `lastPrice` dan `lastPriceAt` dari database
   - Return harga cache dengan flag `isCache: true`

**Response format baru:**

```json
{
  "BBRI": {
    "price": 5100,
    "isCache": false,
    "lastPriceAt": "2026-04-25T10:30:00.000Z"
  },
  "BBCA": {
    "price": 9750,
    "isCache": true,
    "lastPriceAt": "2026-04-24T15:22:00.000Z"
  },
  "TLKM": {
    "price": null,
    "isCache": false,
    "lastPriceAt": null
  }
}
```

> `price: null` hanya terjadi jika Yahoo Finance gagal DAN tidak ada cache tersimpan (data saham baru pertama kali ditambahkan).

---

## 6. Perubahan UI

### Kolom Harga Terakhir di Tabel Portofolio

**Kondisi normal:**
```
Rp 5.100
```

**Kondisi cache (Yahoo Finance gagal):**
```
Rp 5.100  [Cache]
           ↑ tooltip: "Data cache dari 24 Apr 2026 15:22"
```

- Badge `Cache` berwarna **amber/kuning** untuk membedakan dari harga real-time
- Tooltip menampilkan waktu pengambilan cache
- Floating P/L tetap dihitung menggunakan harga cache
- Warna baris tabel tetap hijau/merah sesuai kondisi profit/loss

**Kondisi tidak ada data sama sekali (null):**
```
—
```
Sama seperti sebelumnya — tidak ada kalkulasi.

### Banner Informasi (Opsional)

Jika **semua** harga yang ditampilkan berasal dari cache, tampilkan banner di atas tabel:

```
⚠ Harga tidak dapat diperbarui saat ini. Menampilkan data terakhir dari [tanggal].
  [Coba Refresh]
```

---

## 7. Perubahan Script Migrasi

Tambahkan ke `scripts/migrate-raw-tables.mjs` bagian `alterations`:

```javascript
`ALTER TABLE "portfolios" ADD COLUMN IF NOT EXISTS "lastPrice" DOUBLE PRECISION`,
`ALTER TABLE "portfolios" ADD COLUMN IF NOT EXISTS "lastPriceAt" TEXT`,
```

---

## 8. Acceptance Criteria

### Database
- [ ] Kolom `lastPrice` dan `lastPriceAt` berhasil ditambahkan ke tabel `portfolios`
- [ ] Kolom bersifat nullable (tidak merusak data yang sudah ada)

### API `/api/portfolio/price`
- [ ] Jika Yahoo Finance berhasil: update `lastPrice` & `lastPriceAt` di DB, return harga real-time
- [ ] Jika Yahoo Finance gagal: ambil `lastPrice` dari DB, return dengan `isCache: true`
- [ ] Jika Yahoo Finance gagal DAN tidak ada cache: return `price: null`
- [ ] Update cache dilakukan per simbol (tidak bergantung keberhasilan simbol lain)
- [ ] Response format menyertakan `isCache` dan `lastPriceAt`

### UI
- [ ] Harga cache ditampilkan dengan badge "Cache" berwarna amber
- [ ] Tooltip pada badge menampilkan waktu pengambilan cache dalam format lokal ID
- [ ] Floating P/L tetap terhitung menggunakan harga cache
- [ ] Warna baris dan summary cards tetap berfungsi dengan harga cache
- [ ] Jika `price: null` (tidak ada cache), tampilkan `—` seperti sebelumnya
- [ ] Banner peringatan muncul jika seluruh harga yang tampil berasal dari cache

---

## 9. Catatan Teknis

- Update `lastPrice` dilakukan di API `/api/portfolio/price` setelah berhasil fetch dari Yahoo Finance
- Query update menggunakan `userId` dan `saham` sebagai identifier (bukan `id`) karena price API tidak mengetahui ID row portfolio
- Perlu query: `UPDATE "portfolios" SET "lastPrice"=$1, "lastPriceAt"=$2 WHERE "userId"=$3 AND "saham"=$4`
- `lastPriceAt` disimpan sebagai ISO string — format tampilan dikonversi di frontend
- Tidak ada perubahan pada alur jurnal — jurnal tetap mengambil harga live saat dibuat, dan menyimpan harga dalam kolom `detail` (tidak bergantung cache)

---

## 10. Out of Scope

- Stooq atau sumber harga alternatif lainnya (scope Phase 2 jika cache juga tidak tersedia)
- Auto-refresh harga di background secara periodik
- Notifikasi ke user jika Yahoo Finance down
- Cache harga untuk fitur Jurnal (jurnal sudah menyimpan snapshot harga sendiri)

---
