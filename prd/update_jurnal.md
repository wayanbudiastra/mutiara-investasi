# PRD — Update Jurnal Portofolio dengan Data Cash

**Modul:** Rekap Portofolio — Tab Jurnal  
**Prioritas:** Tinggi  
**Status:** Open

---

## 1. Latar Belakang

Fitur Jurnal Portofolio saat ini hanya merekam snapshot nilai saham (posisi terbuka) pada saat jurnal dibuat. Setelah penambahan fitur **Standby Cash**, data kas yang disimpan di masing-masing akun sekuritas belum ikut terekam di jurnal.

Akibatnya, riwayat jurnal yang ada tidak mencerminkan **total kekayaan investasi** yang sebenarnya — nilai aset nyata user seharusnya adalah `Nilai Pasar Saham + Saldo Cash`.

---

## 2. Tujuan

- Menyertakan data cash ke dalam snapshot jurnal harian
- Menambahkan kolom **Total Cash** dan **Total Aset** ke tabel jurnal
- Memperbarui grafik tren untuk menampilkan **Total Aset** (bukan hanya nilai pasar)
- Menjaga backward compatibility — jurnal lama yang belum punya data cash tetap tampil dengan normal

---

## 3. Perubahan Data

### 3.1 Perubahan Tabel `portfolio_journals`

Tambahkan dua kolom baru:

```sql
ALTER TABLE "portfolio_journals"
  ADD COLUMN IF NOT EXISTS "totalCash" DOUBLE PRECISION NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "totalAset" DOUBLE PRECISION NOT NULL DEFAULT 0;
```

| Kolom | Type | Keterangan |
|-------|------|-----------|
| `totalCash` | DOUBLE PRECISION | Total saldo cash semua akun saat jurnal dibuat |
| `totalAset` | DOUBLE PRECISION | `totalNilaiPasar + totalCash` saat jurnal dibuat |

> **Jurnal lama:** kolom `totalCash` dan `totalAset` akan bernilai `0` (DEFAULT) — tetap tampil tanpa error.

### 3.2 Perubahan Kolom `detail` (JSON)

Tambahkan array `cashSnapshot` di dalam objek detail jurnal:

```json
{
  "stocks": [
    { "keterangan": "STOCKBIT BUDI", "saham": "BBRI", "hargaRata": 4500, "lot": 50,
      "modal": 22500000, "hargaTerakhir": 5100, "nilaiPasar": 25500000,
      "floatRp": 3000000, "floatPct": 13.33 }
  ],
  "cashSnapshot": [
    { "keterangan": "STOCKBIT BUDI", "saldo": 5000000, "catatan": "Menunggu koreksi" },
    { "keterangan": "BIONS",         "saldo": 2500000, "catatan": null }
  ]
}
```

> **Backward compatibility:** jika `cashSnapshot` tidak ada di `detail` (jurnal lama), frontend menampilkan `—` atau `Rp 0` di kolom cash.

---

## 4. Perubahan Alur Buat Jurnal

### Sebelum (Kondisi Saat Ini)

```
Klik "Buat Jurnal Hari Ini"
  ↓
Fetch harga saham dari Yahoo Finance
  ↓
Hitung total modal, nilai pasar, floating P/L
  ↓
Simpan ke portfolio_journals
```

### Sesudah

```
Klik "Buat Jurnal Hari Ini"
  ↓
Fetch harga saham dari Yahoo Finance
  ↓
Ambil data cash dari state (cashRows — sudah di-load saat halaman dibuka)
  ↓
Hitung:
  - totalModal, totalNilaiPasar, totalFloatRp, totalFloatPct (dari saham)
  - totalCash (dari cashRows)
  - totalAset = totalNilaiPasar + totalCash
  ↓
Simpan ke portfolio_journals dengan kolom baru
  - detail berisi: { stocks: [...], cashSnapshot: [...] }
```

---

## 5. Perubahan API

### `POST /api/portfolio/journal`

**Request body baru:**
```json
{
  "totalModal":      143000000,
  "totalNilaiPasar": 149500000,
  "totalFloatRp":      6500000,
  "totalFloatPct":        4.55,
  "totalCash":         7500000,
  "totalAset":       157000000,
  "detail": {
    "stocks": [...],
    "cashSnapshot": [...]
  }
}
```

**Perubahan INSERT query:**
```sql
INSERT INTO "portfolio_journals"
  ("id","userId","journalDate","totalModal","totalNilaiPasar",
   "totalFloatRp","totalFloatPct","totalCash","totalAset","detail","createdAt")
VALUES (...)
```

---

## 6. Perubahan UI

### 6.1 Modal Konfirmasi Jurnal

Tambahkan baris **Cash** dan **Total Aset** di preview sebelum simpan:

```
┌─────────────────────────────────────────────────────────────┐
│ Konfirmasi Jurnal — 1 Mei 2026                              │
│                                                             │
│ Total Modal      : Rp 143.000.000                           │
│ Total Nilai Pasar: Rp 149.500.000                           │
│ Floating P/L     : +Rp 6.500.000 (+4,55%)                  │
│ Total Cash       : Rp 7.500.000       ← BARU               │
│ Total Aset       : Rp 157.000.000     ← BARU               │
│                                                             │
│ Cash per Akun:                        ← BARU               │
│  • STOCKBIT BUDI : Rp 5.000.000                            │
│  • BIONS         : Rp 2.500.000                            │
│                                                             │
│              [Batal]    [Simpan Jurnal]                     │
└─────────────────────────────────────────────────────────────┘
```

### 6.2 Summary Cards Tab Jurnal

Tambahkan card **Total Cash** dan **Total Aset** dari data jurnal terakhir:

| Card | Data |
|------|------|
| Jurnal Tercatat | Jumlah jurnal tahun ini |
| Nilai Pasar Terakhir | `lastJ.totalNilaiPasar` |
| Floating P/L Terakhir | `lastJ.totalFloatRp` |
| Total Cash Terakhir | `lastJ.totalCash` ← BARU |
| Total Aset Terakhir | `lastJ.totalAset` ← BARU |
| Pertumbuhan Aset YTD | `lastJ.totalAset - firstJ.totalAset` ← UPDATE |

### 6.3 Line Chart Tren

**Update chart:** tampilkan dua garis:
- **Nilai Pasar** (warna indigo/biru)
- **Total Aset** (warna hijau/lebih tebal) ← BARU

```typescript
// Chart data update
const chartData = glJournals.map(j => ({
  date:  j.journalDate.slice(5),
  nilai: Math.round(j.totalNilaiPasar / 1000),
  aset:  Math.round((j.totalAset || j.totalNilaiPasar) / 1000), // fallback untuk jurnal lama
  cash:  Math.round((j.totalCash || 0) / 1000),
}))
```

### 6.4 Tabel Riwayat Jurnal

Tambahkan kolom **Total Cash** dan **Total Aset**:

| No | Tanggal | Total Modal | Nilai Pasar | Total Cash | Total Aset | Float P/L | Float % | ΔAset | Aksi |
|----|---------|-------------|-------------|-----------|-----------|-----------|---------|-------|------|

- **ΔAset**: perubahan Total Aset dari jurnal sebelumnya (menggantikan atau melengkapi ΔG/L)

### 6.5 Modal Detail Jurnal

Tambahkan section **Saldo Cash saat Jurnal Dibuat**:

```
┌──────────────────────────────────────────────────────────────┐
│ Detail Jurnal — 1 Mei 2026                                   │
│                                                             │
│ [Summary: Modal / Nilai Pasar / Float P/L / Cash / Aset]    │
│                                                             │
│ ── Posisi Saham ───────────────────────────────────────     │
│ [Tabel snapshot saham]                                      │
│                                                             │
│ ── Saldo Cash ─────────────────────────────────────────     │ ← BARU
│ STOCKBIT BUDI  : Rp 5.000.000                               │
│ BIONS          : Rp 2.500.000                               │
│ Total Cash     : Rp 7.500.000                               │
└──────────────────────────────────────────────────────────────┘
```

---

## 7. Acceptance Criteria

### Database & API
- [ ] Kolom `totalCash` dan `totalAset` ditambahkan ke `portfolio_journals` via ALTER TABLE
- [ ] Kolom baru memiliki DEFAULT 0 agar jurnal lama tidak error
- [ ] `POST /api/portfolio/journal` menerima dan menyimpan `totalCash` dan `totalAset`
- [ ] `GET /api/portfolio/journal` mengembalikan kolom baru (termasuk nilai 0 untuk jurnal lama)
- [ ] `detail` JSON menyertakan `cashSnapshot` array

### Modal Konfirmasi Jurnal
- [ ] Preview menampilkan Total Cash dan Total Aset
- [ ] Daftar cash per akun ditampilkan di preview
- [ ] Jika tidak ada cash entry, Total Cash = Rp 0 (tetap tampil)

### Tab Jurnal
- [ ] Summary cards menampilkan Total Cash Terakhir dan Total Aset Terakhir
- [ ] Pertumbuhan YTD dihitung dari `totalAset` (bukan `totalNilaiPasar`)
- [ ] Chart menampilkan dua garis: Nilai Pasar dan Total Aset
- [ ] Tabel riwayat menampilkan kolom Total Cash dan Total Aset
- [ ] ΔAset menggantikan atau melengkapi ΔG/L

### Modal Detail Jurnal
- [ ] Section "Saldo Cash" muncul jika `cashSnapshot` ada di detail
- [ ] Jurnal lama (tanpa cashSnapshot) tetap tampil normal tanpa section cash

### Backward Compatibility
- [ ] Jurnal lama dengan `totalCash = 0` tidak menyebabkan error di UI
- [ ] `detail` jurnal lama yang berupa array (bukan objek) tetap bisa di-parse
- [ ] Chart dan tabel jurnal lama tampil dengan `totalAset = totalNilaiPasar` sebagai fallback

---

## 8. Catatan Teknis

### Parsing `detail` dengan Backward Compatibility

```typescript
function parseJournalDetail(detailStr: string) {
  const parsed = JSON.parse(detailStr)
  // Jurnal baru: { stocks: [...], cashSnapshot: [...] }
  // Jurnal lama: [...] (array langsung)
  if (Array.isArray(parsed)) {
    return { stocks: parsed as JournalDetail[], cashSnapshot: [] }
  }
  return {
    stocks:       (parsed.stocks       ?? []) as JournalDetail[],
    cashSnapshot: (parsed.cashSnapshot ?? []) as CashSnapshotItem[],
  }
}
```

### Penghitungan `totalAset` Fallback di Frontend

```typescript
const asetForChart = (j: JournalRow) =>
  (j.totalAset && j.totalAset > 0) ? j.totalAset : j.totalNilaiPasar
```

### Kolom `detail` — Format Baru

Simpan sebagai objek, bukan array:
```typescript
detail: JSON.stringify({
  stocks:       detail,        // array JournalDetail (sama seperti sebelumnya)
  cashSnapshot: cashRows.map(c => ({ keterangan: c.keterangan, saldo: c.saldo, catatan: c.catatan })),
})
```

---

## 9. Migrasi Data (Jurnal Lama)

Jurnal lama **tidak perlu dimigrasi** karena:
- `totalCash = 0` (DEFAULT) sudah ditangani di frontend
- `detail` format lama (array) ditangani dengan fungsi `parseJournalDetail()`
- Chart menggunakan fallback `totalNilaiPasar` jika `totalAset = 0`

---

## 10. Out of Scope

- Re-kalkulasi `totalCash`/`totalAset` untuk jurnal lama (data historis tidak dapat diperbarui akurat)
- Cash per akun ditampilkan di Gain/Loss tab (scope terpisah)
- Perbandingan `totalAset` vs benchmark/IHSG

---
