# PRD — Optimasi Fetch Harga Yahoo Finance

**Modul:** Rekap Portofolio — Harga Real-time  
**Prioritas:** Tinggi  
**Status:** Open

---

## 1. Latar Belakang

Saat ini setiap kali halaman Portofolio dibuka, aplikasi otomatis memanggil Yahoo Finance API untuk seluruh saham yang dimiliki user. Pemanggilan ini terjadi melalui `useEffect` yang dipicu setiap `rows` berubah.

**Masalah yang timbul:**

| Masalah | Dampak |
|---------|--------|
| Yahoo Finance dipanggil setiap page load | Limit quota cepat habis |
| Semakin banyak saham, semakin banyak request | Tidak efisien untuk portofolio besar |
| Data harga berubah-ubah saat halaman di-refresh | Pengalaman user tidak konsisten |
| Tidak ada kontrol kapan harga diperbarui | User tidak bisa memilih kapan data di-update |

---

## 2. Tujuan

- Mengurangi jumlah pemanggilan ke Yahoo Finance secara signifikan
- Harga otomatis tersimpan ke database saat pertama kali posisi saham ditambahkan
- Harga hanya diperbarui dari Yahoo Finance saat user secara eksplisit menekan tombol **"Refresh Harga"**
- Saat halaman dibuka, tampilkan harga dari cache database (tanpa hit Yahoo Finance)

---

## 3. Perubahan Perilaku

### Sebelum (Kondisi Saat Ini)

```
User buka halaman Portofolio
  ↓
useEffect → fetchPrices(rows)
  ↓
Panggil Yahoo Finance untuk SEMUA saham
  ↓
Tampilkan harga real-time
  ↓
[User refresh halaman] → ulang dari awal
```

### Sesudah (Target)

```
User buka halaman Portofolio
  ↓
Load data portofolio dari DB (rows)
  ↓
Tampilkan lastPrice dari DB langsung (TANPA hit Yahoo Finance)
  ↓
Tombol "Refresh Harga" tersedia
  ↓
[User klik Refresh] → Panggil Yahoo Finance → Update cache DB → Tampilkan harga baru
```

### Saat Tambah Posisi Baru

```
User input saham baru → klik Tambah
  ↓
POST /api/portfolio → simpan row baru
  ↓
Langsung fetch harga dari Yahoo Finance untuk saham baru saja
  ↓
Simpan lastPrice & lastPriceAt ke DB
  ↓
Tampilkan harga pada baris baru tanpa perlu klik Refresh
```

---

## 4. Detail Perubahan

### 4.1 Halaman Portofolio (`app/portfolio/page.tsx`)

**Hapus auto-fetch:**
```typescript
// HAPUS ini:
useEffect(() => {
  if (rows.length > 0) fetchPrices(rows)
}, [rows, fetchPrices])
```

**Ganti dengan load harga dari DB saat fetch portfolio:**

Saat `GET /api/portfolio` dipanggil, response sudah menyertakan `lastPrice` dan `lastPriceAt` per baris. Frontend langsung membangun `prices` state dari data ini tanpa hit Yahoo Finance.

**Tombol Refresh Harga** tetap ada dan memanggil Yahoo Finance secara manual.

---

### 4.2 API `GET /api/portfolio`

Tambahkan `lastPrice` dan `lastPriceAt` ke response:

**Response sekarang:**
```json
[
  { "id": "...", "saham": "BBRI", "hargaRata": 4500, "lot": 50, ... }
]
```

**Response baru:**
```json
[
  {
    "id": "...",
    "saham": "BBRI",
    "hargaRata": 4500,
    "lot": 50,
    "lastPrice": 5100,
    "lastPriceAt": "2026-04-25T10:30:00.000Z",
    ...
  }
]
```

Frontend membaca `lastPrice` dan `lastPriceAt` dari response ini untuk membangun `prices` state awal.

---

### 4.3 API `POST /api/portfolio` (Tambah Posisi Baru)

Setelah menyimpan row baru ke database, langsung fetch harga saham baru dari Yahoo Finance dan simpan ke `lastPrice` & `lastPriceAt`:

```typescript
// Setelah INSERT berhasil:
try {
  const yf = getYF()
  const quote = await yf.quote(`${saham}.JK`)
  const price = quote?.regularMarketPrice ?? null
  if (price) {
    await prisma.$executeRawUnsafe(
      `UPDATE "portfolios" SET "lastPrice"=$1, "lastPriceAt"=$2 WHERE "id"=$3`,
      price, new Date().toISOString(), id
    )
  }
} catch { /* skip jika Yahoo Finance gagal */ }
```

---

### 4.4 API `GET /api/portfolio/price` (Refresh Manual)

Tidak ada perubahan perilaku — tetap memanggil Yahoo Finance dan update cache. Hanya dipanggil saat user klik tombol **"Refresh Harga"**.

---

## 5. Perubahan State di Frontend

### State `prices` sekarang

```typescript
const [prices, setPrices] = useState<Record<string, {
  price: number | null
  isCache: boolean
  lastPriceAt: string | null
}>>({})
```

### Inisialisasi dari response `GET /api/portfolio`

```typescript
const fetchPortfolio = async () => {
  const res = await fetch('/api/portfolio')
  const data: PortfolioRow[] = await res.json()
  setRows(data)

  // Bangun prices state dari lastPrice di DB — tanpa hit Yahoo Finance
  const initialPrices: Record<string, { price: number | null; isCache: boolean; lastPriceAt: string | null }> = {}
  data.forEach(r => {
    initialPrices[r.saham] = {
      price: r.lastPrice ?? null,
      isCache: r.lastPrice != null, // dari DB = cache
      lastPriceAt: r.lastPriceAt ?? null,
    }
  })
  setPrices(initialPrices)
}
```

---

## 6. UI — Informasi Terakhir Update

Tambahkan teks kecil di bawah tombol Refresh yang menampilkan kapan harga terakhir diperbarui:

```
[↻ Refresh Harga]
Terakhir diperbarui: 25 Apr 2026, 10:30 WIB
```

Logika: ambil `lastPriceAt` terlama dari semua saham yang ada harganya → tampilkan sebagai "terakhir diperbarui".

---

## 7. Acceptance Criteria

### Perilaku Halaman
- [ ] Saat halaman Portofolio dibuka, **tidak ada** pemanggilan ke Yahoo Finance
- [ ] Harga tampil langsung dari cache DB tanpa delay tambahan
- [ ] Tombol "Refresh Harga" masih berfungsi untuk update manual
- [ ] Info "Terakhir diperbarui: [waktu]" tampil di bawah tombol Refresh

### Saat Tambah Posisi Baru
- [ ] Setelah tambah posisi, harga saham baru langsung tampil (fetch 1 saham saja)
- [ ] Jika Yahoo Finance gagal saat tambah, saham tampil dengan harga `—` (tidak error)

### API
- [ ] `GET /api/portfolio` menyertakan `lastPrice` dan `lastPriceAt` di response
- [ ] `POST /api/portfolio` fetch harga saham baru setelah INSERT (async, tidak blocking)
- [ ] `GET /api/portfolio/price` tetap berfungsi untuk refresh manual

### Efisiensi
- [ ] Jumlah pemanggilan Yahoo Finance berkurang drastis (hanya saat Refresh diklik)
- [ ] Tidak ada auto-fetch saat `rows` berubah

---

## 8. Estimasi Penghematan

| Skenario | Sebelum | Sesudah |
|----------|---------|---------|
| User buka halaman 10x | 10× hit Yahoo Finance | 0× hit (semua dari cache) |
| User tambah 1 saham | fetch semua saham | fetch 1 saham saja |
| User klik Refresh | 1× hit Yahoo Finance | 1× hit Yahoo Finance |
| 10 user, masing-masing buka 5x | 50× hit | 0× hit (semua cache) |

---

## 9. Catatan Teknis

- Kolom `lastPrice` dan `lastPriceAt` di tabel `portfolios` sudah ada (dari `yahoo_finance_backup.md`)
- `GET /api/portfolio` perlu SELECT kolom `lastPrice` dan `lastPriceAt` yang saat ini belum di-select
- Saat `isCache: true` tampilkan badge **Cache** + tooltip waktu (sudah ada di implementasi sebelumnya)
- Jika `lastPrice = null` (saham baru, Yahoo Finance belum pernah berhasil): tampilkan `—`
- `POST /api/portfolio` boleh fetch harga secara fire-and-forget (tidak await di response)

---

## 10. Out of Scope

- Auto-refresh harga di background secara periodik (cron job)
- WebSocket atau SSE untuk harga real-time
- Notifikasi saat harga melewati threshold tertentu
- Pilihan interval refresh yang bisa dikonfigurasi user

---
