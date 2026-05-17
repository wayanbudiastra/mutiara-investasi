# PRD: Fitur Tab Alokasi — Rekap Portofolio

**Dokumen**: setup_alokasi.md  
**Versi**: 1.1  
**Tanggal**: 11 Mei 2026  
**Status**: Draft  
**Perubahan v1.1**: Kolom akun sekuritas dihapus dari tampilan Alokasi Saham. Fitur alokasi per sekuritas akan dibuat sebagai sub-fitur terpisah.

---

## 1. Latar Belakang

Halaman **Rekap Portofolio** saat ini memiliki empat tab: Portofolio, Jurnal, Gain/Loss, dan Cash. Data saham yang tampil di tab Portofolio sudah mencakup nilai pasar dan floating P/L, namun belum ada visualisasi distribusi alokasi modal/nilai antar saham secara agregat dan historis. Pengguna perlu melihat seberapa besar porsi tiap saham dalam portofolionya secara visual, serta membandingkan alokasi antar tahun.

---

## 2. Tujuan Fitur

- Menampilkan **diagram pie** alokasi semua saham berdasarkan **Nilai Pasar (Rp)** dan **persentase porsi** dari total portofolio.
- Data snapshot diambil dari **jurnal terakhir** (entri jurnal paling akhir yang tersimpan).
- Menyediakan **riwayat alokasi 5 tahun terakhir** melalui combobox tahun, di mana tiap tahun mengambil data dari **jurnal terakhir pada tahun tersebut**.

---

## 3. Scope Fitur

### In Scope
- Tab baru bernama **"Alokasi"** di antara tab yang sudah ada (setelah Cash, atau sesuai urutan UX yang disepakati).
- Pie chart interaktif berbasis data real dari tabel Jurnal.
- Combobox pemilih tahun (5 tahun terakhir dari tahun berjalan).
- Legenda saham dengan kode, nominal, dan persentase.
- Ringkasan statistik: total nilai pasar, jumlah emiten, saham terbesar/terkecil.

### Out of Scope
- **Alokasi per akun sekuritas** — akan dibuat sebagai sub-fitur/tab terpisah ("Alokasi Sekuritas").
- Alokasi berbasis modal (avg price × lot) — versi ini hanya berbasis **Nilai Pasar**.
- Perbandingan dua tahun secara side-by-side.
- Export chart ke gambar/PDF (dapat ditambahkan di versi berikutnya).

---

## 4. User Stories

| ID | Sebagai... | Saya ingin... | Agar... |
|----|-----------|---------------|---------|
| US-01 | Investor | Melihat pie chart alokasi saham terkini | Mengetahui distribusi portofolio saya secara visual |
| US-02 | Investor | Melihat persentase dan nilai (Rp) tiap saham di pie chart | Memahami bobot tiap emiten tanpa hitung manual |
| US-03 | Investor | Memilih tahun dari combobox (5 tahun terakhir) | Melihat bagaimana alokasi berubah dari tahun ke tahun |
| US-04 | Investor | Melihat data dari jurnal terakhir pada tahun yang dipilih | Mendapat snapshot akurat di akhir periode tersebut |
| US-05 | Investor | Melihat legenda saham yang lengkap di bawah chart | Membaca detail tiap slice dengan mudah |

---

## 5. Spesifikasi Fungsional

### 5.1 Sumber Data

```
Tabel: jurnal
Kolom relevan:
  - tanggal         : DATE
  - kode_saham      : VARCHAR
  - nilai_pasar     : BIGINT / DECIMAL
  - (field lain sesuai skema existing)
```

**Query snapshot terbaru** (untuk "Tahun Ini" / tab default):

```sql
-- Ambil jurnal terakhir secara global, agregasi per kode_saham
SELECT kode_saham, SUM(nilai_pasar) AS nilai_pasar
FROM jurnal
WHERE tanggal = (SELECT MAX(tanggal) FROM jurnal)
GROUP BY kode_saham
ORDER BY nilai_pasar DESC;
```

**Query snapshot per tahun** (untuk combobox):

```sql
-- Ambil jurnal terakhir pada tahun yang dipilih (:year)
SELECT kode_saham, SUM(nilai_pasar) AS nilai_pasar
FROM jurnal
WHERE tanggal = (
  SELECT MAX(tanggal)
  FROM jurnal
  WHERE YEAR(tanggal) = :year
)
GROUP BY kode_saham
ORDER BY nilai_pasar DESC;
```

> **Catatan**: `SUM` digunakan untuk mengantisipasi satu saham yang mungkin tercatat di beberapa baris pada tanggal yang sama. Akun sekuritas tidak diikutsertakan — agregasi murni per `kode_saham`.

---

### 5.2 Layout Tab Alokasi

```
┌──────────────────────────────────────────────────────────┐
│  Rekap Portofolio                                        │
│  [Portofolio] [Jurnal] [Gain/Loss] [Cash] [Alokasi]     │
├──────────────────────────────────────────────────────────┤
│                                                          │
│  Alokasi Saham           [Combobox: Tahun 2026 ▾]       │
│  Snapshot: Jurnal 9 Mei 2026                            │
│                                                          │
│  ┌───────────────────────┐  ┌──────────────────────┐    │
│  │                       │  │ Ringkasan             │    │
│  │     [PIE CHART]       │  │ Total Nilai Pasar:    │    │
│  │                       │  │ Rp 204.227.500        │    │
│  │                       │  │ Jumlah Emiten: 12     │    │
│  │                       │  │ Terbesar: BMRI  8.39% │    │
│  │                       │  │ Terkecil: BRIS  0.56% │    │
│  └───────────────────────┘  └──────────────────────┘    │
│                                                          │
│  Legenda                                                 │
│  ● BMRI   Rp 17.131.000   8.39%                        │
│  ● BBRI   Rp 16.300.000   7.99%                        │
│  ● DMAS   Rp 15.400.000   7.54%                        │
│  ... (semua saham, tanpa kolom akun sekuritas)          │
│                                                          │
└──────────────────────────────────────────────────────────┘
```

---

### 5.3 Komponen Pie Chart

| Atribut | Spesifikasi |
|---------|-------------|
| Library | Recharts (`PieChart`, `Pie`, `Tooltip`, `Legend`) atau Chart.js |
| Basis nilai | `nilai_pasar` per saham |
| Tooltip | Hover → tampil: kode saham, Rp nilai_pasar, % porsi |
| Warna slice | Palet warna distinkif per saham (konsisten antar tahun berdasarkan kode saham) |
| Klik slice | Highlight slice + scroll ke baris legenda |
| Inner label | Opsional: donut chart dengan total Rp di tengah |

---

### 5.4 Combobox Pemilih Tahun

- Opsi: `2026`, `2025`, `2024`, `2023`, `2022` (dinamis dari tahun berjalan - 4)
- Default: tahun berjalan
- Jika tidak ada data jurnal pada tahun tersebut → tampilkan pesan: *"Tidak ada data jurnal pada tahun [YYYY]"*
- Label di bawah judul menampilkan tanggal snapshot: *"Snapshot: Jurnal [tanggal terakhir]"*

---

### 5.5 Tabel Legenda

Kolom: No | Warna | Kode Saham | Nilai Pasar (Rp) | Porsi (%)

- Diurutkan dari porsi terbesar ke terkecil
- **Tidak ada kolom akun sekuritas** — fokus pada kepemilikan saham, bukan tempat penyimpanan
- Baris dapat di-hover untuk highlight slice chart
- Warna dot legenda sesuai warna slice chart

---

## 6. Spesifikasi Non-Fungsional

| Aspek | Ketentuan |
|-------|-----------|
| Framework | Next.js (konsisten dengan stack existing) |
| ORM | Prisma |
| Database | PostgreSQL |
| State Management | React `useState` / `useEffect` |
| API | REST endpoint baru: `GET /api/alokasi?year=2026` |
| Loading State | Skeleton loader saat fetch data |
| Error State | Alert component jika query gagal |
| Responsif | Layout menyesuaikan mobile (pie chart di atas, legenda di bawah) |
| Performance | Query diindeks pada kolom `tanggal` dan `kode_saham` di tabel jurnal |

---

## 7. API Endpoint

### `GET /api/alokasi`

**Query params:**
| Param | Tipe | Default | Keterangan |
|-------|------|---------|------------|
| `year` | number | tahun berjalan | Tahun snapshot yang diambil |

**Response sukses (200):**
```json
{
  "snapshot_date": "2026-05-09",
  "year": 2026,
  "total_nilai_pasar": 204227500,
  "jumlah_emiten": 12,
  "data": [
    {
      "kode_saham": "BMRI",
      "nilai_pasar": 17131000,
      "porsi_persen": 8.39
    },
    {
      "kode_saham": "BBRI",
      "nilai_pasar": 16300000,
      "porsi_persen": 7.99
    }
    // ...
  ]
}
```

**Response tidak ada data (200):**
```json
{
  "snapshot_date": null,
  "year": 2020,
  "total_nilai_pasar": 0,
  "jumlah_emiten": 0,
  "data": []
}
```

---

## 8. Prisma Query (Referensi Implementasi)

```typescript
// pages/api/alokasi.ts
import { prisma } from '@/lib/prisma';

export default async function handler(req, res) {
  const year = parseInt(req.query.year as string) || new Date().getFullYear();

  // 1. Cari tanggal jurnal terakhir pada tahun tersebut
  const lastEntry = await prisma.jurnal.findFirst({
    where: {
      tanggal: {
        gte: new Date(`${year}-01-01`),
        lte: new Date(`${year}-12-31`),
      },
    },
    orderBy: { tanggal: 'desc' },
    select: { tanggal: true },
  });

  if (!lastEntry) {
    return res.json({ snapshot_date: null, year, total_nilai_pasar: 0, jumlah_emiten: 0, data: [] });
  }

  // 2. Ambil semua data jurnal pada tanggal terakhir, select kode_saham & nilai_pasar saja
  const rows = await prisma.jurnal.findMany({
    where: { tanggal: lastEntry.tanggal },
    select: { kode_saham: true, nilai_pasar: true },
  });

  // 3. Agregasi nilai_pasar per kode_saham (tanpa akun sekuritas)
  const aggregated: Record<string, number> = {};
  for (const row of rows) {
    aggregated[row.kode_saham] = (aggregated[row.kode_saham] ?? 0) + row.nilai_pasar;
  }

  const total = Object.values(aggregated).reduce((sum, v) => sum + v, 0);

  const data = Object.entries(aggregated)
    .map(([kode_saham, nilai_pasar]) => ({
      kode_saham,
      nilai_pasar,
      porsi_persen: parseFloat(((nilai_pasar / total) * 100).toFixed(2)),
    }))
    .sort((a, b) => b.nilai_pasar - a.nilai_pasar);

  return res.json({
    snapshot_date: lastEntry.tanggal.toISOString().split('T')[0],
    year,
    total_nilai_pasar: total,
    jumlah_emiten: data.length,
    data,
  });
}
```

---

## 9. Komponen Frontend (Struktur File)

```
components/
  alokasi/
    AlokasiTab.tsx          ← Komponen utama tab
    PieChartAlokasi.tsx     ← Wrapper Recharts PieChart
    LegendaAlokasi.tsx      ← Tabel legenda
    RingkasanAlokasi.tsx    ← Card ringkasan statistik
    YearSelector.tsx        ← Combobox tahun

pages/
  (tidak ada halaman baru — fitur masuk ke halaman rekap existing)

hooks/
  useAlokasi.ts             ← Custom hook fetch API /api/alokasi?year=...
```

---

## 10. Acceptance Criteria

| ID | Kriteria | Pass |
|----|----------|------|
| AC-01 | Tab "Alokasi" muncul di navbar rekap portofolio | ☐ |
| AC-02 | Pie chart tampil dengan data dari jurnal terakhir (tahun berjalan) saat tab dibuka | ☐ |
| AC-03 | Setiap slice menampilkan tooltip dengan kode, Rp, dan % saat di-hover | ☐ |
| AC-04 | Combobox menampilkan 5 tahun terakhir sebagai pilihan | ☐ |
| AC-05 | Ganti tahun di combobox → chart dan legenda diperbarui tanpa reload halaman | ☐ |
| AC-06 | Label tanggal snapshot berubah sesuai tahun yang dipilih | ☐ |
| AC-07 | Jika tidak ada data jurnal untuk tahun tersebut → muncul pesan kosong | ☐ |
| AC-08 | Legenda diurutkan dari porsi terbesar ke terkecil | ☐ |
| AC-09 | Warna tiap saham konsisten saat ganti tahun | ☐ |
| AC-10 | Layout responsif di mobile (pie di atas, legenda di bawah) | ☐ |
| AC-11 | Loading skeleton tampil saat data sedang di-fetch | ☐ |

---

## 11. Milestone & Estimasi

| Fase | Task | Estimasi |
|------|------|----------|
| **Fase 1** | Setup API endpoint `/api/alokasi` + Prisma query | 1 sesi (2 jam) |
| **Fase 2** | Komponen `PieChartAlokasi` + `YearSelector` | 1 sesi (2 jam) |
| **Fase 3** | Komponen `LegendaAlokasi` + `RingkasanAlokasi` | 1 sesi (1.5 jam) |
| **Fase 4** | Integrasi ke tab rekap portofolio existing | 0.5 sesi (1 jam) |
| **Fase 5** | Testing, edge case (data kosong, single saham), responsif | 1 sesi (1.5 jam) |
| **Total** | | **~8 jam (4–5 sesi malam)** |

---

## 12. Catatan Tambahan

- **Warna saham**: Buat mapping tetap `kode_saham → warna hex` agar konsisten antar tahun. Simpan sebagai konstanta di `lib/chartColors.ts`.
- **Agregasi bersih**: Karena akun sekuritas diabaikan, agregasi cukup `SUM(nilai_pasar) GROUP BY kode_saham` — tidak ada logika "Multi" akun yang perlu ditangani di sisi tampilan.
- **Indeks database**: Tambahkan index pada `(tanggal, kode_saham)` di tabel jurnal untuk performa query snapshot.
- **Fitur terpisah — Alokasi Sekuritas**: Fitur untuk melihat porsi nilai pasar per akun sekuritas (AJAIB, IPOT, KOINS, dst.) akan direncanakan sebagai PRD tersendiri (`setup_alokasi_sekuritas.md`).
- **Versi berikutnya (v2)**: Pertimbangkan tambahan view alokasi berbasis **modal (cost basis)**, dan fitur **export chart** sebagai PNG.
