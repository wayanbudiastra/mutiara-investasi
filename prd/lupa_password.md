# PRD — Fitur Lupa Password

**Modul:** Autentikasi — Reset Password  
**Prioritas:** Tinggi  
**Status:** Open

---

## 1. Latar Belakang

Saat ini user yang lupa password tidak memiliki cara mandiri untuk mereset password mereka. Satu-satunya opsi adalah menghubungi admin secara manual. Fitur **Lupa Password** memungkinkan user mereset password secara mandiri melalui email verifikasi.

---

## 2. Konfigurasi Email

| Parameter | Nilai |
|-----------|-------|
| Pengirim | `no-reply@mutiarainvestasi.com` |
| Nama Pengirim | `Mutiara Investasi` |
| Provider | SMTP (konfigurasi via Hostinger Mail atau SMTP provider) |
| Library | `nodemailer` (sudah terinstall di project) |

---

## 3. User Flow

```
User buka halaman Login
  ↓
Klik link "Lupa Password?"
  ↓
Halaman /forgot-password
  ↓
User input email terdaftar → klik "Kirim Link Reset"
  ↓
Sistem cek email di database:
  ├── TIDAK ADA → tampilkan pesan sukses palsu (anti user enumeration)
  └── ADA → generate token unik → simpan ke DB dengan expired 1 jam
             → kirim email berisi link reset
  ↓
User buka email → klik link reset
  ↓
Halaman /reset-password?token=xxx
  ↓
Sistem validasi token:
  ├── TIDAK VALID / EXPIRED → tampilkan error + tombol kirim ulang
  └── VALID → form input password baru + konfirmasi
  ↓
User submit password baru
  ↓
Sistem hash password → update ke DB → invalidate token
  ↓
Redirect ke /login dengan pesan sukses
```

---

## 4. Struktur Data

### Tabel `password_reset_tokens`

```sql
CREATE TABLE IF NOT EXISTS "password_reset_tokens" (
  "id"        TEXT NOT NULL PRIMARY KEY,
  "userId"    TEXT NOT NULL,
  "token"     TEXT NOT NULL UNIQUE,
  "expiredAt" TEXT NOT NULL,
  "usedAt"    TEXT,
  "createdAt" TEXT NOT NULL
)
```

| Kolom | Keterangan |
|-------|-----------|
| `token` | Random string 64 karakter (hex), disimpan sebagai hash SHA-256 |
| `expiredAt` | ISO timestamp, 1 jam setelah dibuat |
| `usedAt` | Diisi saat token dipakai — null = belum dipakai |

> **Keamanan:** Token yang disimpan di DB adalah **hash SHA-256** dari token asli. Token asli hanya ada di URL email dan tidak disimpan plaintext.

---

## 5. Template Email Reset Password

**Subject:** Reset Password — Mutiara Investasi

**Body (HTML):**

```
Halo [Nama User],

Kami menerima permintaan reset password untuk akun Mutiara Investasi
yang terdaftar dengan email ini.

Klik tombol di bawah untuk membuat password baru:

[Reset Password]  ← link ke /reset-password?token=xxx

Link ini berlaku selama 1 jam dan hanya dapat digunakan sekali.

Jika Anda tidak meminta reset password, abaikan email ini.
Password Anda tidak akan berubah.

Salam,
Tim Mutiara Investasi
```

---

## 6. API Routes

| Route | Method | Fungsi |
|-------|--------|--------|
| `POST /api/auth/forgot-password` | POST | Validasi email, generate token, kirim email |
| `POST /api/auth/reset-password` | POST | Validasi token, update password baru |
| `GET /api/auth/reset-password` | GET | Validasi token (cek valid/expired sebelum tampil form) |

### POST `/api/auth/forgot-password`

**Request:**
```json
{ "email": "user@example.com" }
```

**Logic:**
1. Cari user by email
2. Jika tidak ditemukan → return 200 OK (pesan sukses palsu — anti enumeration)
3. Generate token: `crypto.randomBytes(32).toString('hex')` → 64 karakter hex
4. Hash token: `crypto.createHash('sha256').update(token).digest('hex')`
5. Simpan hash + expiredAt (now + 1 jam) ke `password_reset_tokens`
6. Invalidate token lama yang belum dipakai milik user ini
7. Kirim email via nodemailer dengan link: `{NEXTAUTH_URL}/reset-password?token={token}`
8. Return 200 OK

**Response (selalu 200 — anti enumeration):**
```json
{ "message": "Jika email terdaftar, link reset akan dikirim." }
```

---

### GET `/api/auth/reset-password?token=xxx`

**Logic:**
1. Hash token dari query param
2. Cari di DB: hash cocok + `usedAt IS NULL` + `expiredAt > now()`
3. Return `{ valid: true }` atau `{ valid: false, reason: "expired|invalid" }`

---

### POST `/api/auth/reset-password`

**Request:**
```json
{
  "token": "xxx",
  "password": "passwordBaru123",
  "confirmPassword": "passwordBaru123"
}
```

**Logic:**
1. Hash token → cari di DB
2. Validasi: token ada, belum dipakai, belum expired
3. Validasi password: min 8 karakter
4. Konfirmasi password cocok
5. Hash password baru dengan `bcryptjs`
6. Update `users.password`
7. Set `password_reset_tokens.usedAt = now()`
8. Return 200 OK

**Response error:**
```json
{ "error": "Token tidak valid atau sudah kedaluwarsa" }
```

---

## 7. Halaman Baru

### `/forgot-password`

```
┌─────────────────────────────────────────┐
│         Lupa Password                   │
│                                         │
│  Masukkan email yang terdaftar.         │
│  Kami akan mengirim link reset password.│
│                                         │
│  Email *                                │
│  [________________________]             │
│                                         │
│          [Kirim Link Reset]             │
│                                         │
│  ← Kembali ke Login                    │
└─────────────────────────────────────────┘
```

**Setelah submit (berhasil):**
```
✓ Jika email Anda terdaftar, link reset password
  telah dikirim. Periksa folder inbox atau spam.

  Link berlaku selama 1 jam.
```

---

### `/reset-password?token=xxx`

**State: token valid**
```
┌─────────────────────────────────────────┐
│         Reset Password                  │
│                                         │
│  Password Baru *                        │
│  [________________________]  👁          │
│  Min. 8 karakter                        │
│                                         │
│  Konfirmasi Password *                  │
│  [________________________]  👁          │
│                                         │
│          [Simpan Password Baru]         │
└─────────────────────────────────────────┘
```

**State: token expired/invalid**
```
✗ Link reset password tidak valid atau
  sudah kedaluwarsa (berlaku 1 jam).

  [Kirim Ulang Link Reset]
```

---

## 8. Perubahan Halaman Login

Tambahkan link "Lupa Password?" di bawah field password:

```
Password
[________________________]
                Lupa Password?  ← link ke /forgot-password
```

---

## 9. Konfigurasi Environment Variables

Tambahkan ke `.env.local` dan Hostinger/Vercel:

```env
# SMTP untuk kirim email reset password
SMTP_HOST=mail.mutiarainvestasi.com
SMTP_PORT=465
SMTP_SECURE=true
SMTP_USER=no-reply@mutiarainvestasi.com
SMTP_PASS=password-email-anda
SMTP_FROM="Mutiara Investasi <no-reply@mutiarainvestasi.com>"
```

> **Cara dapat konfigurasi SMTP Hostinger:**
> hPanel → Email → Email Accounts → `no-reply@mutiarainvestasi.com`
> → lihat detail SMTP (host, port, username, password)

---

## 10. Acceptance Criteria

### Forgot Password
- [ ] Halaman `/forgot-password` dapat diakses dari halaman login
- [ ] Form menerima input email dengan validasi format
- [ ] Selalu menampilkan pesan sukses meski email tidak terdaftar (anti enumeration)
- [ ] Email reset dikirim hanya ke email yang terdaftar di database
- [ ] Email berisi link dengan token unik yang berlaku 1 jam
- [ ] Token lama user diinvalidasi saat request baru dibuat

### Reset Password
- [ ] Halaman `/reset-password?token=xxx` memvalidasi token sebelum tampilkan form
- [ ] Token expired/invalid menampilkan pesan error + tombol kirim ulang
- [ ] Password baru minimal 8 karakter
- [ ] Konfirmasi password harus cocok
- [ ] Setelah reset berhasil: redirect ke login dengan pesan sukses
- [ ] Token hanya bisa dipakai sekali (`usedAt` diisi setelah dipakai)

### Email
- [ ] Email terkirim dari `no-reply@mutiarainvestasi.com`
- [ ] Subject: "Reset Password — Mutiara Investasi"
- [ ] Link di email mengarah ke halaman reset yang benar
- [ ] Tampilan email HTML rapi di semua mail client

### Keamanan
- [ ] Token disimpan sebagai hash SHA-256 di database (bukan plaintext)
- [ ] Token expired setelah 1 jam
- [ ] Token hanya bisa dipakai sekali
- [ ] Anti user enumeration: response selalu 200 meski email tidak terdaftar

---

## 11. Catatan Teknis

- `nodemailer` sudah terinstall di project — tidak perlu install ulang
- Tabel `password_reset_tokens` dibuat via raw SQL (`CREATE TABLE IF NOT EXISTS`)
- Tambahkan ke `scripts/migrate-raw-tables.mjs`
- Halaman `/forgot-password` dan `/reset-password` **tidak** perlu autentikasi (publik)
- Tambahkan kedua path ke `proxy.ts` matcher agar tidak di-block middleware
- SMTP port 465 = SSL, port 587 = STARTTLS — sesuaikan dengan konfigurasi Hostinger

---

## 12. Out of Scope

- Login via Google / OAuth
- Magic link login (login tanpa password)
- SMS OTP untuk reset password
- Rate limiting request reset (dapat ditambahkan Phase 2)
- Notifikasi email ke user saat password berhasil diubah

---
