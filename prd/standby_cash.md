# PRD — Fitur Standby Cash Portofolio

**Modul:** Rekap Portofolio — Tab Baru  
**Prioritas:** Medium  
**Status:** Open

---

## 1. Latar Belakang

Saat ini modul Portofolio hanya menampilkan nilai aset berupa saham yang dimiliki (posisi terbuka). Namun setiap akun sekuritas biasanya juga memiliki **saldo kas (cash)** yang belum diinvestasikan — misalnya sisa uang setelah beli saham, atau dana yang sengaja disimpan menunggu momentum beli.

Tanpa pencatatan cash, nilai aset total yang ditampilkan tidak mencerminkan kondisi portofolio yang sebenarnya.

---

## 2. Tujuan

- Mencatat saldo kas di masing-masing akun sekuritas
- Menampilkan **Total Cash** dan **Total Nilai Aset** (cash + nilai pasar saham) di summary cards
- Memberikan gambaran portofolio yang lebih lengkap dan akurat
- Data cash bisa ditambah, diedit, dan dihapus

---

## 3. Perubahan UI

### 3.1 Tab Baru "Cash"

Tambahkan tab **"Cash"** setelah tab "Gain/Loss":

```
[ Portofolio ]  [ Jurnal ]  [ Gain/Loss ]  [ Cash ]
```

---

### 3.2 Summary Cards (Halaman Portofolio — Semua Tab)

Tambahkan 2 card baru di atas semua tab:

```
┌──────────────┬──────────────┬──────────────┬──────────────┬──────────────┬──────────────┐
│ Total Modal  │ Total Nilai  │ Floating P/L │ Float P/L(%) │ Total Cash   │ Total Aset   │
│ Rp xxx       │ Pasar Rp xxx │ Rp xxx       │ +x.xx%       │ Rp xxx       │ Rp xxx       │
└──────────────┴──────────────┴──────────────┴──────────────┴──────────────┴──────────────┘
```

| Card | Formula |
|------|---------|
| **Total Cash** | Jumlah seluruh saldo kas di semua akun sekuritas |
| **Total Aset** | `Total Nilai Pasar + Total Cash` |

---

### 3.3 Konten Tab Cash

**Header:**
- Judul: "Standby Cash"
- Deskripsi: "Saldo kas yang belum diinvestasikan per akun sekuritas"
- Tombol **"+ Tambah Cash"**

**Tabel Saldo Cash:**

| Kolom | Keterangan |
|-------|-----------|
| No | Nomor urut |
| Akun Sekuritas | Nama broker (dari daftar sekuritas) |
| Saldo Cash | Nominal dalam Rupiah |
| Catatan | Keterangan opsional (misal: "menunggu koreksi") |
| Terakhir Diperbarui | Tanggal update terakhir |
| Aksi | Tombol Edit + Hapus |

**Total di bawah tabel:**
```
Total Cash Keseluruhan: Rp xxx.xxx.xxx
```

**Modal Tambah / Edit:**
```
┌─────────────────────────────────────────┐
│ Tambah Cash                             │
│                                         │
│ Akun Sekuritas *                        │
│ [Dropdown — pilih dari daftar sekuritas]│
│                                         │
│ Saldo Cash (Rp) *                       │
│ [input angka]                           │
│                                         │
│ Catatan (opsional)                      │
│ [input teks]                            │
│                                         │
│          [Batal]  [Simpan]              │
└─────────────────────────────────────────┘
```

> Setiap akun sekuritas hanya boleh memiliki **1 record cash** — jika sudah ada, tombol "Tambah" tidak memunculkan opsi akun yang sudah tercatat. Edit dilakukan via tombol Edit pada baris yang ada.

---

## 4. Struktur Data

### Tabel `portfolio_cash`

```sql
CREATE TABLE IF NOT EXISTS "portfolio_cash" (
  "id"          TEXT NOT NULL PRIMARY KEY,
  "userId"      TEXT NOT NULL,
  "keterangan"  TEXT NOT NULL,    -- nama akun sekuritas
  "saldo"       DOUBLE PRECISION NOT NULL,
  "catatan"     TEXT,
  "createdAt"   TEXT NOT NULL,
  "updatedAt"   TEXT NOT NULL,
  UNIQUE("userId", "keterangan")  -- 1 record per akun per user
)
```

---

## 5. API Routes

| Route | Method | Fungsi |
|-------|--------|--------|
| `GET /api/portfolio/cash` | GET | Ambil semua cash entries milik user |
| `POST /api/portfolio/cash` | POST | Tambah cash entry baru |
| `PUT /api/portfolio/cash/[id]` | PUT | Update saldo dan catatan |
| `DELETE /api/portfolio/cash/[id]` | DELETE | Hapus cash entry |

### GET `/api/portfolio/cash`

Response:
```json
[
  {
    "id": "...",
    "keterangan": "STOCKBIT BUDI",
    "saldo": 5000000,
    "catatan": "Menunggu koreksi BBRI",
    "updatedAt": "2026-04-29T10:00:00.000Z"
  }
]
```

### POST `/api/portfolio/cash`

Request:
```json
{
  "keterangan": "STOCKBIT BUDI",
  "saldo": 5000000,
  "catatan": "Menunggu koreksi BBRI"
}
```

Validasi: jika `keterangan` sudah ada untuk userId → return 409 Conflict

### PUT `/api/portfolio/cash/[id]`

Request:
```json
{
  "saldo": 7500000,
  "catatan": "Update saldo setelah beli BBCA"
}
```

---

## 6. Perubahan Summary Cards

### Data Source

Summary cards di bagian atas halaman Portofolio perlu ditambah:
1. Fetch `GET /api/portfolio/cash` saat halaman dimuat
2. Hitung `totalCash = sum(cash.saldo)`
3. Hitung `totalAset = totalNilaiPasar + totalCash`

### Cards yang Ditambahkan

```typescript
{ label: 'Total Cash',  val: rp(totalCash),  color: 'text-blue-600' },
{ label: 'Total Aset',  val: rp(totalAset),  color: 'text-indigo-700' },
```

Grid summary cards berubah dari 4 kolom menjadi 6 kolom:
```
grid-cols-2 sm:grid-cols-6
```

---

## 7. Acceptance Criteria

### Database & API
- [ ] Tabel `portfolio_cash` dibuat otomatis saat pertama kali diakses
- [ ] Constraint `UNIQUE(userId, keterangan)` mencegah duplikasi per akun
- [ ] `POST` return 409 jika akun sudah punya cash entry
- [ ] `PUT` dan `DELETE` hanya bisa dilakukan oleh pemilik data (userId check)

### Tab Cash
- [ ] Tab "Cash" muncul setelah tab "Gain/Loss"
- [ ] Tabel menampilkan semua cash entries user
- [ ] Modal "Tambah Cash" menggunakan combobox sekuritas (sama dengan tab Portofolio)
- [ ] Akun yang sudah punya cash entry tidak muncul di dropdown "Tambah" (hanya di Edit)
- [ ] Tombol Edit membuka modal dengan data yang sudah terisi
- [ ] Konfirmasi sebelum hapus
- [ ] Total cash ditampilkan di bawah tabel

### Summary Cards
- [ ] Card "Total Cash" menampilkan jumlah semua saldo cash
- [ ] Card "Total Aset" = Total Nilai Pasar + Total Cash
- [ ] Cards menyesuaikan jika filter akun sekuritas aktif (opsional: tampilkan semua meski ada filter)
- [ ] Jika belum ada cash entry, card menampilkan Rp 0

---

## 8. Catatan Teknis

- `keterangan` di `portfolio_cash` harus uppercase (konsisten dengan tabel `portfolios`)
- Dropdown pilih akun sekuritas menggunakan data dari `GET /api/securities` (bukan dari `portfolios`)
- Tabel `portfolio_cash` ditambahkan ke `scripts/migrate-raw-tables.mjs`
- Summary cards fetch cash data bersamaan dengan portfolio data saat halaman dimuat
- Nilai saldo disimpan sebagai `DOUBLE PRECISION` (rupiah, tanpa desimal dalam praktik)

---

## 9. Out of Scope

- Riwayat perubahan saldo cash (history/audit log)
- Top-up / withdrawal otomatis dari API broker
- Integrasi dengan fitur Jurnal (cash tidak dicatat dalam snapshot jurnal — scope Phase 2)
- Multi-currency (semua dalam IDR)

---
