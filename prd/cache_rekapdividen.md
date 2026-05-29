# PRD: Implementasi Cache — Halaman Rekap Dividen
**Mutiara Investasi — mutiarainvestasi.com**
**Versi:** 1.0
**Tanggal:** 6 Mei 2026
**Stack:** Next.js (App Router) · Prisma · PostgreSQL

---

## 1. Latar Belakang & Tujuan

Halaman Rekap Dividen menampilkan data agregat dividen per user (Total Terealisasi, Total Estimasi, Total Keseluruhan) serta tabel detail per entri. Seluruh data di-fetch dari database PostgreSQL via Prisma pada setiap request, menyebabkan:

- Query DB berulang meski data jarang berubah dalam satu sesi
- Waktu render lambat terutama saat jumlah data besar
- Beban DB tinggi jika banyak user aktif bersamaan

**Tujuan implementasi cache:**
- Mengurangi jumlah query ke database hingga 80%
- Menurunkan waktu response halaman di bawah 200ms untuk kunjungan berulang
- Tetap memastikan data selalu konsisten setelah user melakukan aksi (tambah/edit/hapus)

---

## 2. Ruang Lingkup

### Termasuk dalam scope
- Cache data summary cards (Total Terealisasi, Total Estimasi, Total Keseluruhan)
- Cache data tabel dividen (list entri per user)
- Invalidasi cache otomatis setelah mutasi data (POST / PUT / DELETE)
- Cache filter dan state pagination (client-side)

### Tidak termasuk dalam scope
- Cache halaman Tab "Rekap Chart" dan "Rekap By Sekuritas" (direncanakan di PRD terpisah)
- Real-time price feed dari API eksternal
- Cache lintas user (semua data bersifat per-user/private)

---

## 3. Analisis Data & Strategi Cache

### 3.1 Karakteristik Data

| Data | Frekuensi Berubah | Sensitif per User | Strategi Cache |
|---|---|---|---|
| Summary cards (total YTD) | Hanya saat mutasi | Ya | `unstable_cache` + tag |
| List entri dividen | Hanya saat mutasi | Ya | `unstable_cache` + tag |
| Filter kode saham (UI) | Per interaksi | Tidak | Client state (SWR) |
| Status dropdown | Statis | Tidak | Hard-code / static |

### 3.2 Cache Key Design

Karena data bersifat **per-user**, setiap cache key harus menyertakan `userId` agar data satu user tidak bocor ke user lain.

```
dividen-summary:{userId}
dividen-list:{userId}
```

### 3.3 Durasi Cache

| Cache Key | TTL (revalidate) | Alasan |
|---|---|---|
| `dividen-summary:{userId}` | `false` (tidak expire) | Hanya invalid saat mutasi |
| `dividen-list:{userId}` | `false` (tidak expire) | Hanya invalid saat mutasi |

> **Catatan:** TTL `false` berarti cache tidak akan expired berdasarkan waktu — hanya akan di-clear ketika `revalidateTag()` dipanggil. Ini aman karena setiap aksi user (tambah/edit/hapus) pasti memanggil invalidasi.

---

## 4. Implementasi Teknis

### 4.1 Struktur File

```
app/
├── dashboard/
│   └── rekap-dividen/
│       ├── page.tsx               ← Server Component (ambil data)
│       └── _components/
│           ├── DividenTable.tsx   ← Client Component (filter, aksi)
│           └── SummaryCards.tsx   ← Client Component (display)
lib/
└── cache/
    └── dividen.ts                 ← Fungsi cache terpusat
```

### 4.2 Fungsi Cache Terpusat (`lib/cache/dividen.ts`)

```typescript
import { unstable_cache } from 'next/cache'
import { prisma } from '@/lib/prisma'

// ─── Cache Tag Constants ─────────────────────────────────────────────
export const CACHE_TAGS = {
  dividenSummary: (userId: string) => `dividen-summary:${userId}`,
  dividenList:    (userId: string) => `dividen-list:${userId}`,
} as const

// ─── Summary Cards (Total YTD) ───────────────────────────────────────
export function getCachedDividenSummary(userId: string) {
  return unstable_cache(
    async () => {
      const [terealisasi, estimasi] = await Promise.all([
        prisma.dividen.aggregate({
          where: { userId, status: 'DONE' },
          _sum: { total: true },
        }),
        prisma.dividen.aggregate({
          where: { userId, status: 'ESTIMASI' },
          _sum: { total: true },
        }),
      ])

      const totalTerealisasi = terealisasi._sum.total ?? 0
      const totalEstimasi    = estimasi._sum.total ?? 0

      return {
        totalTerealisasi,
        totalEstimasi,
        totalKeseluruhan: totalTerealisasi + totalEstimasi,
      }
    },
    [CACHE_TAGS.dividenSummary(userId)],
    {
      tags:       [CACHE_TAGS.dividenSummary(userId)],
      revalidate: false,
    }
  )()
}

// ─── List Entri Dividen ───────────────────────────────────────────────
export function getCachedDividenList(userId: string) {
  return unstable_cache(
    async () => {
      return prisma.dividen.findMany({
        where:   { userId },
        orderBy: [{ tahun: 'desc' }, { bulan: 'desc' }],
      })
    },
    [CACHE_TAGS.dividenList(userId)],
    {
      tags:       [CACHE_TAGS.dividenList(userId)],
      revalidate: false,
    }
  )()
}
```

### 4.3 Server Component — Page (`app/dashboard/rekap-dividen/page.tsx`)

```typescript
import { auth } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { getCachedDividenSummary, getCachedDividenList } from '@/lib/cache/dividen'
import SummaryCards from './_components/SummaryCards'
import DividenTable from './_components/DividenTable'

export default async function RekapDividenPage() {
  const session = await auth()
  if (!session?.user?.id) redirect('/login')

  const userId = session.user.id

  // Kedua query jalan paralel, hasil dari cache jika tersedia
  const [summary, dividenList] = await Promise.all([
    getCachedDividenSummary(userId),
    getCachedDividenList(userId),
  ])

  return (
    <div>
      <h1>Rekap Dividen</h1>
      <p>{dividenList.length} data tersimpan</p>
      <SummaryCards summary={summary} />
      <DividenTable data={dividenList} />
    </div>
  )
}
```

### 4.4 Invalidasi Cache — API Route

Setiap API route yang melakukan mutasi data dividen **wajib** memanggil `revalidateTag()` setelah operasi DB berhasil.

```typescript
// app/api/dividen/route.ts — POST (Tambah Dividen)
import { revalidateTag } from 'next/cache'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { CACHE_TAGS } from '@/lib/cache/dividen'

export async function POST(req: Request) {
  const session = await auth()
  if (!session?.user?.id) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const userId = session.user.id
  const body   = await req.json()

  await prisma.dividen.create({
    data: { ...body, userId },
  })

  // Invalidasi kedua cache sekaligus
  revalidateTag(CACHE_TAGS.dividenSummary(userId))
  revalidateTag(CACHE_TAGS.dividenList(userId))

  return Response.json({ success: true })
}
```

```typescript
// app/api/dividen/[id]/route.ts — PUT (Edit) & DELETE (Hapus)
export async function PUT(req: Request, { params }: { params: { id: string } }) {
  const session = await auth()
  if (!session?.user?.id) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const userId = session.user.id
  const body   = await req.json()

  await prisma.dividen.update({
    where: { id: params.id, userId }, // pastikan hanya milik user sendiri
    data:  body,
  })

  revalidateTag(CACHE_TAGS.dividenSummary(userId))
  revalidateTag(CACHE_TAGS.dividenList(userId))

  return Response.json({ success: true })
}

export async function DELETE(_: Request, { params }: { params: { id: string } }) {
  const session = await auth()
  if (!session?.user?.id) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const userId = session.user.id

  await prisma.dividen.delete({
    where: { id: params.id, userId },
  })

  revalidateTag(CACHE_TAGS.dividenSummary(userId))
  revalidateTag(CACHE_TAGS.dividenList(userId))

  return Response.json({ success: true })
}
```

### 4.5 Client-side: Filter Kode Saham & Status

Filter (kode saham, dropdown status) dilakukan **di sisi client** terhadap data yang sudah di-fetch dari server. Tidak perlu hit server ulang untuk filter — cukup filter array di memori.

```typescript
// _components/DividenTable.tsx
'use client'

import { useState, useMemo } from 'react'

export default function DividenTable({ data }) {
  const [filterKode, setFilterKode]     = useState('')
  const [filterStatus, setFilterStatus] = useState('SEMUA')

  const filtered = useMemo(() => {
    return data.filter(item => {
      const matchKode   = filterKode === '' || 
                          item.kode.toLowerCase().includes(filterKode.toLowerCase())
      const matchStatus = filterStatus === 'SEMUA' || item.status === filterStatus
      return matchKode && matchStatus
    })
  }, [data, filterKode, filterStatus])

  return (
    <div>
      <input
        placeholder="Filter kode saham..."
        value={filterKode}
        onChange={e => setFilterKode(e.target.value)}
      />
      <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)}>
        <option value="SEMUA">Semua Status</option>
        <option value="DONE">Done</option>
        <option value="ESTIMASI">Estimasi</option>
      </select>

      <p>{filtered.length} data</p>

      <table>
        {/* render filtered */}
      </table>
    </div>
  )
}
```

---

## 5. Alur Cache Lifecycle

```
User buka /rekap-dividen
        │
        ▼
Server Component memanggil getCachedDividenSummary(userId)
        │                   getCachedDividenList(userId)
        │
        ├── Cache HIT?  → Kembalikan data langsung (tanpa query DB)
        │
        └── Cache MISS? → Query DB via Prisma → Simpan ke cache → Return
                │
                ▼
        Halaman dirender dengan data dari cache
        
        
User melakukan aksi (Tambah / Edit / Hapus)
        │
        ▼
API Route → Prisma mutasi DB
        │
        ▼
revalidateTag('dividen-summary:{userId}')
revalidateTag('dividen-list:{userId}')
        │
        ▼
Cache dihapus. Request berikutnya = fresh data dari DB
```

---

## 6. Testing & Validasi

### 6.1 Checklist Fungsional

| Skenario | Expected Result | Status |
|---|---|---|
| Buka halaman pertama kali | Data tampil, cache MISS (log DB query) | ☐ |
| Refresh halaman | Data tampil, cache HIT (tidak ada DB query) | ☐ |
| Tambah dividen baru | Data fresh muncul, total YTD terupdate | ☐ |
| Edit entri dividen | Perubahan langsung terlihat setelah refresh | ☐ |
| Hapus entri dividen | Entri hilang, total YTD berkurang | ☐ |
| Filter kode saham | Filter bekerja tanpa reload halaman | ☐ |
| Login user berbeda | Tidak ada data user lain yang muncul (isolasi cache) | ☐ |

### 6.2 Cara Verifikasi Cache HIT/MISS

Tambahkan log sementara selama development:

```typescript
// Di dalam fungsi getCachedDividenList
async () => {
  console.log(`[DB QUERY] getDividenList for user: ${userId}`) // hanya muncul saat MISS
  return prisma.dividen.findMany({ ... })
}
```

Jika log ini tidak muncul pada request kedua → cache bekerja dengan benar.

---

## 7. Keamanan Cache

| Risiko | Mitigasi |
|---|---|
| Cache key tanpa userId → data bocor | Cache key selalu menyertakan `userId` sebagai bagian dari key dan tag |
| User hapus data lain karena bug | Query Prisma selalu filter `where: { userId }` |
| Cache tidak terhapus setelah logout | Tidak ada risiko — cache bersifat server-side, tidak disimpan di browser user |

---

## 8. Rencana Implementasi

| No | Task | Estimasi |
|---|---|---|
| 1 | Buat file `lib/cache/dividen.ts` | 30 menit |
| 2 | Refactor `page.tsx` untuk gunakan cached functions | 20 menit |
| 3 | Update API routes POST/PUT/DELETE + revalidateTag | 30 menit |
| 4 | Refactor filter ke client-side di `DividenTable.tsx` | 20 menit |
| 5 | Testing manual sesuai checklist | 30 menit |
| **Total** | | **~2.5 jam** |

---

## 9. Referensi

- [Next.js Data Cache — official docs](https://nextjs.org/docs/app/building-your-application/caching#data-cache)
- [unstable_cache API](https://nextjs.org/docs/app/api-reference/functions/unstable_cache)
- [revalidateTag API](https://nextjs.org/docs/app/api-reference/functions/revalidateTag)
- [Prisma with Next.js](https://www.prisma.io/nextjs)
