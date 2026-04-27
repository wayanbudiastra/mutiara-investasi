# Issue Tracker — Manajemen Member Akses Khusus

---

## ISSUE-M001 · Fitur Granted Access — Super Admin Berikan Akses Pro Gratis ke User Pilihan

**Modul:** Admin — Manajemen Member  
**Prioritas:** Tinggi  
**Status:** Open

---

### Deskripsi

Super Admin dapat memberikan akses **Pro penuh** kepada user terpilih tanpa mewajibkan pembayaran. Akses ini tetap dibatasi dengan tanggal kadaluarsa yang ditentukan oleh Admin. Fitur ini berguna untuk:

- Memberikan akses ke mitra / kolega
- Masa percobaan diperpanjang khusus
- Reward / hadiah untuk user tertentu
- Beta tester atau early adopter

---

### Perbedaan dengan Free Trial Otomatis

| Aspek | Free Trial (Otomatis) | Granted Access (Admin) |
|-------|----------------------|------------------------|
| Siapa yang memberikan | Sistem (saat registrasi) | Super Admin secara manual |
| Durasi | Tetap 30 hari | Fleksibel, ditentukan Admin |
| Bisa diperpanjang | Tidak | Ya, Admin bisa extend kapanpun |
| Tampilan status | Badge TRIAL | Badge GRANTED |
| Bisa dicabut | Tidak | Ya, Admin bisa revoke |
| Terlihat di monitoring | Ya | Ya, dengan keterangan khusus |

---

### User Flow

#### Admin Side

```
Admin login
  ↓
Buka halaman Monitor User (/admin)
  ↓
Cari user berdasarkan nama / email
  ↓
Klik tombol "Berikan Akses" pada baris user
  ↓
Muncul modal: pilih durasi (7 hari / 30 hari / 90 hari / custom tanggal)
  ↓
Tambahkan catatan / keterangan (opsional)
  ↓
Klik "Konfirmasi" → akses langsung aktif
  ↓
User tampil badge GRANTED di tabel monitoring
```

#### User Side

```
User login
  ↓
Semua fitur Pro dapat diakses penuh
  ↓
Halaman Langganan Saya menampilkan:
  - Status: "Akses Khusus"
  - Badge GRANTED (warna ungu)
  - Berlaku hingga: [tanggal]
  - Sisa hari
  ↓
Saat mendekati expired (≤ 7 hari):
  - Notifikasi banner kuning di halaman Langganan
  - "Akses khusus Anda akan berakhir dalam X hari"
  ↓
Setelah expired → tampil ProGate normal
  → CTA berlangganan paket Pro berbayar
```

---

### Scope Pengerjaan

---

#### 1. Database — Perubahan Tabel `subscriptions`

Tambah kolom berikut ke tabel `subscriptions`:

```sql
ALTER TABLE "subscriptions"
  ADD COLUMN IF NOT EXISTS "grantedBy"   TEXT,     -- userId admin yang memberikan akses
  ADD COLUMN IF NOT EXISTS "grantNote"   TEXT,     -- catatan dari admin (opsional)
  ADD COLUMN IF NOT EXISTS "isGranted"   BOOLEAN NOT NULL DEFAULT FALSE;
```

> Tabel `subscriptions` sudah ada. `plan` akan diisi `'GRANTED'` untuk membedakan dari paket berbayar.

---

#### 2. API Routes Baru

| Route | Method | Fungsi |
|-------|--------|--------|
| `GET /api/admin/members` | GET | List semua user yang pernah mendapat granted access |
| `POST /api/admin/members/grant` | POST | Berikan granted access ke user tertentu |
| `PUT /api/admin/members/revoke` | PUT | Cabut granted access sebelum expired |
| `PUT /api/admin/members/extend` | PUT | Perpanjang durasi granted access |

**Request body `POST /api/admin/members/grant`:**
```json
{
  "targetUserId": "user-id-tujuan",
  "durationDays": 30,
  "note": "Akses untuk beta tester"
}
```

**Request body `PUT /api/admin/members/revoke`:**
```json
{
  "subscriptionId": "sub-id"
}
```

**Request body `PUT /api/admin/members/extend`:**
```json
{
  "subscriptionId": "sub-id",
  "additionalDays": 30
}
```

---

#### 3. Perubahan Halaman Admin (`/admin`)

Tambahkan kolom **Aksi** pada tabel Monitor User:

- Tombol **"Berikan Akses"** → buka modal grant
- Tombol **"Cabut"** (muncul jika user punya granted access aktif)
- Tombol **"Perpanjang"** (muncul jika user punya granted access aktif)
- Badge **GRANTED** (ungu) pada kolom paket untuk user yang mendapat akses khusus

**Modal "Berikan Akses":**
```
┌─────────────────────────────────────────┐
│ Berikan Akses Khusus                    │
│                                         │
│ User: [nama] ([email])                  │
│                                         │
│ Durasi Akses:                           │
│ ○ 7 hari    ○ 30 hari    ○ 90 hari      │
│ ○ Custom: [date picker]                 │
│                                         │
│ Catatan (opsional):                     │
│ [textarea]                              │
│                                         │
│         [Batal]  [Berikan Akses]        │
└─────────────────────────────────────────┘
```

---

#### 4. Perubahan Halaman Langganan User (`/subscription`)

Tambahkan kondisi untuk status `GRANTED`:

- Badge berwarna **ungu**: `AKSES KHUSUS`
- Label: "Akses Khusus dari Admin"
- Info durasi dan tanggal expired
- Banner peringatan ≤ 7 hari sebelum expired
- Tidak tampilkan CTA "Lihat Paket" selama masih aktif

---

#### 5. Perubahan `checkProAccess`

`GRANTED` subscription diperlakukan sama dengan `ACTIVE` subscription lainnya — user mendapat akses penuh selama `expiredAt > now()`.

Tidak perlu perubahan logika karena sudah handle semua plan dengan status `ACTIVE`.

---

#### 6. Halaman `/admin/members` (Opsional — Phase 2)

Halaman dedicated untuk melihat riwayat semua granted access:

| Kolom | Keterangan |
|-------|-----------|
| User | Nama + email penerima |
| Diberikan Oleh | Admin yang memberikan |
| Tanggal Pemberian | Kapan akses diberikan |
| Berlaku Hingga | Tanggal expired |
| Status | AKTIF / EXPIRED / DICABUT |
| Catatan | Note dari admin |
| Aksi | Cabut / Perpanjang |

---

### Acceptance Criteria

#### Database
- [ ] Kolom `grantedBy`, `grantNote`, `isGranted` berhasil ditambahkan ke tabel `subscriptions`
- [ ] Migration script diupdate untuk handle kolom baru

#### API
- [ ] `POST /api/admin/members/grant` hanya bisa diakses admin (403 jika bukan admin)
- [ ] Grant berhasil membuat subscription baru dengan `plan='GRANTED'`, `status='ACTIVE'`, `isGranted=true`
- [ ] Jika user sudah punya granted access aktif, yang lama di-expire dulu sebelum buat baru
- [ ] `PUT /api/admin/members/revoke` mengubah status subscription menjadi `EXPIRED`
- [ ] `PUT /api/admin/members/extend` menambahkan hari ke `expiredAt` yang ada

#### Halaman Admin
- [ ] Tombol "Berikan Akses" muncul di setiap baris user di tabel Monitor User
- [ ] Modal grant menampilkan pilihan durasi: 7 / 30 / 90 hari + custom date
- [ ] Setelah grant berhasil, badge GRANTED langsung muncul di tabel tanpa reload penuh
- [ ] Tombol "Cabut" dan "Perpanjang" muncul untuk user yang punya granted access aktif
- [ ] Konfirmasi sebelum cabut akses

#### Halaman User
- [ ] Status "Akses Khusus" dengan badge ungu tampil di `/subscription`
- [ ] Banner peringatan muncul jika sisa ≤ 7 hari
- [ ] Setelah expired, ProGate muncul normal

---

### Catatan Teknis

- `plan = 'GRANTED'` ditambahkan ke type `PlanId` di `lib/subscription.ts`
- Query admin monitoring diupdate untuk include `isGranted` info
- Semua endpoint admin wajib validasi `ADMIN_USER_IDS` di server side
- `NEXT_PUBLIC_ADMIN_USER_IDS` digunakan untuk hide/show tombol di UI
- Tidak ada email notifikasi untuk phase 1 (bisa ditambahkan phase 2)

---

### Out of Scope (Phase 2)

- Email notifikasi ke user saat mendapat / hampir expired granted access
- Halaman riwayat lengkap granted access (`/admin/members`)
- Limit berapa kali admin bisa grant ke satu user
- Auto-extend jika user sedang aktif menggunakan aplikasi

---
