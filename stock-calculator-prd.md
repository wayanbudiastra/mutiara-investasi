# Kalkulator Saham — Product Requirements Document

## Overview

Aplikasi web kalkulator potensi untung dan rugi saham berbasis **Next.js** dengan penyimpanan data menggunakan **Prisma ORM** dan database **SQLite**. Pengguna dapat menghitung estimasi keuntungan/kerugian investasi saham secara real-time, menyimpan riwayat kalkulasi, dan mengelola portofolio simulasi.

---

## Tech Stack

| Layer | Teknologi |
|---|---|
| Framework | Next.js 14+ (App Router) |
| Bahasa | TypeScript |
| ORM | Prisma |
| Database | SQLite (via `prisma-client`) |
| Autentikasi | NextAuth.js v5 (Auth.js) |
| Password Hashing | bcryptjs |
| Email (Forgot Password) | Nodemailer + SMTP / Resend |
| Styling | Tailwind CSS |
| State Management | React `useState` / `useReducer` |
| Validasi | Zod |
| Testing | Jest + React Testing Library |

---

## Struktur Proyek

```
stock-calculator/
├── app/
│   ├── layout.tsx
│   ├── page.tsx                        # Halaman utama kalkulator (protected)
│   ├── history/
│   │   └── page.tsx                    # Riwayat kalkulasi (protected)
│   ├── (auth)/                         # Route group — tidak ada shared layout
│   │   ├── login/
│   │   │   └── page.tsx               # Halaman login
│   │   ├── register/
│   │   │   └── page.tsx               # Halaman register
│   │   └── forgot-password/
│   │       ├── page.tsx               # Form input email
│   │       └── reset/
│   │           └── page.tsx           # Form reset password (via token)
│   ├── profile/
│   │   └── page.tsx                    # Halaman profil & edit data user
│   └── api/
│       ├── auth/
│       │   └── [...nextauth]/
│       │       └── route.ts           # NextAuth handler
│       ├── register/
│       │   └── route.ts               # POST — registrasi user baru
│       ├── forgot-password/
│       │   └── route.ts               # POST — kirim email reset
│       ├── reset-password/
│       │   └── route.ts               # POST — simpan password baru
│       ├── profile/
│       │   └── route.ts               # GET & PATCH — data profil user
│       ├── calculations/
│       │   ├── route.ts               # GET (list) & POST (simpan)
│       │   └── [id]/
│       │       └── route.ts           # GET (detail) & DELETE
│       └── watchlist/
│           └── route.ts               # GET & POST saham favorit
├── components/
│   ├── Auth/
│   │   ├── LoginForm.tsx
│   │   ├── RegisterForm.tsx
│   │   ├── ForgotPasswordForm.tsx
│   │   └── ResetPasswordForm.tsx
│   ├── Calculator/
│   │   ├── InputPanel.tsx
│   │   ├── ModeToggle.tsx
│   │   ├── ResultPanel.tsx
│   │   └── FeeDetail.tsx
│   ├── History/
│   │   ├── HistoryList.tsx
│   │   └── HistoryCard.tsx
│   ├── Layout/
│   │   ├── Navbar.tsx                 # Navbar dengan info user & logout
│   │   └── AuthGuard.tsx             # Wrapper redirect jika belum login
│   └── ui/
│       ├── Button.tsx
│       ├── Input.tsx
│       └── Badge.tsx
├── lib/
│   ├── prisma.ts                      # Prisma client singleton
│   ├── auth.ts                        # NextAuth config
│   ├── password.ts                    # bcrypt hash & compare
│   ├── mailer.ts                      # Nodemailer / Resend helper
│   ├── calculations.ts                # Logic kalkulasi murni
│   └── validators.ts                  # Zod schemas
├── middleware.ts                       # Proteksi route — redirect ke /login
├── prisma/
│   ├── schema.prisma
│   └── migrations/
└── types/
    └── index.ts
```

---

## Prisma Schema

```prisma
// prisma/schema.prisma

generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "sqlite"
  url      = env("DATABASE_URL")
}

// ─── USER & AUTH ──────────────────────────────────────────────

model User {
  id          String   @id @default(cuid())
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  name        String
  email       String   @unique
  whatsapp    String?              // Format: 628xxxxxxxxxx
  password    String               // bcrypt hash
  isVerified  Boolean  @default(false)
  role        String   @default("user")  // "user" | "admin"

  // Relasi
  sessions             Session[]
  passwordResetTokens  PasswordResetToken[]
  calculations         Calculation[]
  watchlist            Watchlist[]

  @@map("users")
}

model Session {
  id        String   @id @default(cuid())
  userId    String
  token     String   @unique
  expiresAt DateTime
  createdAt DateTime @default(now())

  user User @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@map("sessions")
}

model PasswordResetToken {
  id        String   @id @default(cuid())
  userId    String
  token     String   @unique          // UUID / random token
  expiresAt DateTime                  // berlaku 1 jam
  used      Boolean  @default(false)
  createdAt DateTime @default(now())

  user User @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@map("password_reset_tokens")
}

// ─── KALKULASI ────────────────────────────────────────────────

model Calculation {
  id          String   @id @default(cuid())
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  userId      String                   // relasi ke user
  user        User     @relation(fields: [userId], references: [id], onDelete: Cascade)

  label       String?
  stockCode   String?
  inputMode   String                   // "lot" | "modal"
  pricePerShare Float
  lot         Int?
  modalInput  Float?
  modalUsed   Float

  targetProfit Float
  stopLoss     Float
  feeBuy      Float
  feeSell     Float

  grossProfit  Float
  netProfit    Float
  netProfitPct Float
  grossLoss    Float
  netLoss      Float
  netLossPct   Float
  totalFeeBuy  Float
  totalFeeSell Float

  @@map("calculations")
}

// ─── WATCHLIST ────────────────────────────────────────────────

model Watchlist {
  id          String   @id @default(cuid())
  createdAt   DateTime @default(now())

  userId      String
  user        User     @relation(fields: [userId], references: [id], onDelete: Cascade)

  stockCode   String
  stockName   String?
  notes       String?

  @@unique([userId, stockCode])       // satu user tidak bisa duplikat kode saham
  @@map("watchlist")
}
```

---

## Environment Variables

```env
# .env

# Database
DATABASE_URL="file:./dev.db"

# NextAuth
NEXTAUTH_SECRET="ganti-dengan-random-string-panjang"
NEXTAUTH_URL="http://localhost:3000"

# Email (pilih salah satu: SMTP atau Resend)

# Opsi A — SMTP (Gmail / Mailgun / dll)
SMTP_HOST="smtp.gmail.com"
SMTP_PORT="587"
SMTP_USER="emailkamu@gmail.com"
SMTP_PASS="app-password-gmail"
SMTP_FROM="Kalkulator Saham <emailkamu@gmail.com>"

# Opsi B — Resend (lebih mudah untuk production)
RESEND_API_KEY="re_xxxxxxxxxx"
EMAIL_FROM="Kalkulator Saham <noreply@domainmu.com>"

# URL Aplikasi (untuk link reset password di email)
APP_URL="http://localhost:3000"
```

---

## Prisma Client Singleton

```typescript
// lib/prisma.ts
import { PrismaClient } from '@prisma/client'

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: ['query'],
  })

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma
```

---

## Auth Config (NextAuth.js v5)

```typescript
// lib/auth.ts
import NextAuth from 'next-auth'
import Credentials from 'next-auth/providers/credentials'
import { prisma } from '@/lib/prisma'
import { comparePassword } from '@/lib/password'

export const { handlers, auth, signIn, signOut } = NextAuth({
  providers: [
    Credentials({
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Password', type: 'password' },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) return null

        const user = await prisma.user.findUnique({
          where: { email: credentials.email as string },
        })
        if (!user) return null

        const valid = await comparePassword(
          credentials.password as string,
          user.password
        )
        if (!valid) return null

        return {
          id: user.id,
          name: user.name,
          email: user.email,
          whatsapp: user.whatsapp,
        }
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id
        token.whatsapp = (user as any).whatsapp
      }
      return token
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.id as string
        session.user.whatsapp = token.whatsapp as string
      }
      return session
    },
  },
  pages: {
    signIn: '/login',
    error: '/login',
  },
  session: { strategy: 'jwt' },
})
```

---

## Password Helper

```typescript
// lib/password.ts
import bcrypt from 'bcryptjs'

export async function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, 12)
}

export async function comparePassword(
  plain: string,
  hashed: string
): Promise<boolean> {
  return bcrypt.compare(plain, hashed)
}
```

---

## Mailer Helper

```typescript
// lib/mailer.ts
import nodemailer from 'nodemailer'

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: Number(process.env.SMTP_PORT),
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
})

export async function sendResetPasswordEmail(
  to: string,
  name: string,
  token: string
) {
  const resetUrl = `${process.env.APP_URL}/forgot-password/reset?token=${token}`

  await transporter.sendMail({
    from: process.env.SMTP_FROM,
    to,
    subject: 'Reset Password — Kalkulator Saham',
    html: `
      <p>Halo <strong>${name}</strong>,</p>
      <p>Klik link berikut untuk mereset password kamu. Link berlaku selama <strong>1 jam</strong>.</p>
      <a href="${resetUrl}" style="display:inline-block;padding:10px 20px;background:#2563eb;color:#fff;border-radius:6px;text-decoration:none;">
        Reset Password
      </a>
      <p>Jika kamu tidak merasa meminta reset password, abaikan email ini.</p>
    `,
  })
}
```

---

## Middleware (Route Protection)

```typescript
// middleware.ts
import { auth } from '@/lib/auth'
import { NextResponse } from 'next/server'

const PUBLIC_PATHS = ['/login', '/register', '/forgot-password']

export default auth((req) => {
  const { pathname } = req.nextUrl
  const isPublic = PUBLIC_PATHS.some((p) => pathname.startsWith(p))

  if (!req.auth && !isPublic) {
    return NextResponse.redirect(new URL('/login', req.url))
  }

  if (req.auth && isPublic) {
    return NextResponse.redirect(new URL('/', req.url))
  }

  return NextResponse.next()
})

export const config = {
  matcher: ['/((?!api|_next/static|_next/image|favicon.ico).*)'],
}
```

---

## API Routes — Autentikasi

### `POST /api/register` — Registrasi user baru

**Request body:**
```json
{
  "name": "Budi Santoso",
  "email": "budi@email.com",
  "whatsapp": "628123456789",
  "password": "MinimalEnamKarakter",
  "confirmPassword": "MinimalEnamKarakter"
}
```

**Response `201`:**
```json
{
  "message": "Registrasi berhasil. Silakan login."
}
```

**Response `409` — email sudah terdaftar:**
```json
{ "error": "Email sudah digunakan." }
```

---

### `POST /api/auth/[...nextauth]` — Login

Ditangani oleh NextAuth. Form login cukup gunakan `signIn('credentials', { email, password, redirect: false })` dari `next-auth/react`.

**Response sukses** → session JWT di-set otomatis via cookie.

**Response gagal:**
```json
{ "error": "Email atau password salah." }
```

---

### `POST /api/forgot-password` — Kirim email reset

**Request body:**
```json
{ "email": "budi@email.com" }
```

**Response `200`** (selalu 200 meski email tidak ditemukan, untuk keamanan):
```json
{ "message": "Jika email terdaftar, link reset telah dikirim." }
```

**Flow:**
1. Cari user by email di database
2. Generate token unik (`crypto.randomUUID()`) + simpan ke tabel `PasswordResetToken` (expire 1 jam)
3. Kirim email via `sendResetPasswordEmail()`

---

### `POST /api/reset-password` — Simpan password baru

**Request body:**
```json
{
  "token": "uuid-token-dari-email",
  "password": "PasswordBaru123",
  "confirmPassword": "PasswordBaru123"
}
```

**Response `200`:**
```json
{ "message": "Password berhasil diubah. Silakan login." }
```

**Response `400` — token tidak valid / sudah dipakai / expired:**
```json
{ "error": "Token tidak valid atau sudah kadaluarsa." }
```

**Flow:**
1. Cari token di `PasswordResetToken` — pastikan `used = false` dan `expiresAt > now()`
2. Hash password baru dengan bcrypt
3. Update `user.password`, tandai `token.used = true`

---

### `GET /api/profile` — Data profil user

**Header:** `Authorization: Bearer <session-token>` (dikelola NextAuth otomatis)

**Response `200`:**
```json
{
  "id": "clxxxxx",
  "name": "Budi Santoso",
  "email": "budi@email.com",
  "whatsapp": "628123456789",
  "createdAt": "2025-01-01T00:00:00.000Z"
}
```

---

### `PATCH /api/profile` — Update profil user

**Request body (semua field opsional):**
```json
{
  "name": "Budi S.",
  "whatsapp": "628987654321",
  "currentPassword": "PasswordLama",
  "newPassword": "PasswordBaru123"
}
```

**Response `200`:**
```json
{ "message": "Profil berhasil diperbarui." }
```

> Jika `newPassword` dikirim, `currentPassword` wajib ada dan cocok dengan hash di database.

---

## API Routes — Kalkulasi

**Request body:**
```json
{
  "label": "BBCA Maret 2025",
  "stockCode": "BBCA",
  "inputMode": "lot",
  "pricePerShare": 9500,
  "lot": 10,
  "modalInput": null,
  "targetProfit": 10,
  "stopLoss": 5,
  "feeBuy": 0.19,
  "feeSell": 0.29
}
```

**Response `201`:**
```json
{
  "id": "clxxxxx",
  "netProfit": 843750,
  "netProfitPct": 8.88,
  "netLoss": -534625,
  "netLossPct": -5.63
}
```

---

### `GET /api/calculations` — List riwayat

**Query params:** `?page=1&limit=20&stockCode=BBCA`

**Response `200`:**
```json
{
  "data": [...],
  "total": 42,
  "page": 1,
  "limit": 20
}
```

---

### `DELETE /api/calculations/[id]` — Hapus kalkulasi

**Response `200`:**
```json
{ "success": true }
```

---

## Kalkulasi Logic

```typescript
// lib/calculations.ts

export interface CalcInput {
  pricePerShare: number
  modalUsed: number
  lot: number
  targetProfit: number  // persen
  stopLoss: number      // persen
  feeBuy: number        // persen, default 0.19
  feeSell: number       // persen, default 0.29
}

export interface CalcResult {
  modalUsed: number
  totalOut: number
  feeBuyNom: number
  // Skenario untung
  grossSellProfit: number
  grossProfit: number
  feeSellNomProfit: number
  netProfit: number
  netProfitPct: number
  // Skenario rugi
  grossSellLoss: number
  grossLoss: number
  feeSellNomLoss: number
  netLoss: number
  netLossPct: number
}

export function calculate(input: CalcInput): CalcResult {
  const { modalUsed, targetProfit, stopLoss, feeBuy, feeSell } = input

  const feeBuyNom = modalUsed * (feeBuy / 100)
  const totalOut = modalUsed + feeBuyNom

  // Skenario untung
  const grossProfit = modalUsed * (targetProfit / 100)
  const grossSellProfit = modalUsed + grossProfit
  const feeSellNomProfit = grossSellProfit * (feeSell / 100)
  const netProfit = grossProfit - feeBuyNom - feeSellNomProfit
  const netProfitPct = (netProfit / modalUsed) * 100

  // Skenario rugi
  const grossLoss = modalUsed * (stopLoss / 100)
  const grossSellLoss = modalUsed - grossLoss
  const feeSellNomLoss = grossSellLoss * (feeSell / 100)
  const netLoss = -grossLoss - feeBuyNom - feeSellNomLoss
  const netLossPct = (netLoss / modalUsed) * 100

  return {
    modalUsed,
    totalOut,
    feeBuyNom,
    grossSellProfit,
    grossProfit,
    feeSellNomProfit,
    netProfit,
    netProfitPct,
    grossSellLoss,
    grossLoss,
    feeSellNomLoss,
    netLoss,
    netLossPct,
  }
}

export function calcFromLot(pricePerShare: number, lot: number): number {
  return pricePerShare * lot * 100
}

export function calcFromModal(pricePerShare: number, modalInput: number): {
  lot: number
  modalUsed: number
} {
  const lembar = Math.floor(modalInput / pricePerShare)
  const lot = Math.floor(lembar / 100)
  const modalUsed = lot * 100 * pricePerShare
  return { lot, modalUsed }
}
```

---

## Zod Validators

```typescript
// lib/validators.ts
import { z } from 'zod'

// ─── AUTH ─────────────────────────────────────────────────────

export const RegisterSchema = z
  .object({
    name: z.string().min(2, 'Nama minimal 2 karakter').max(100),
    email: z.string().email('Format email tidak valid'),
    whatsapp: z
      .string()
      .regex(/^62\d{9,13}$/, 'Format WhatsApp: 628xxxxxxxxxx')
      .optional()
      .or(z.literal('')),
    password: z.string().min(6, 'Password minimal 6 karakter'),
    confirmPassword: z.string(),
  })
  .refine((d) => d.password === d.confirmPassword, {
    message: 'Password tidak cocok',
    path: ['confirmPassword'],
  })

export const LoginSchema = z.object({
  email: z.string().email('Format email tidak valid'),
  password: z.string().min(1, 'Password wajib diisi'),
})

export const ForgotPasswordSchema = z.object({
  email: z.string().email('Format email tidak valid'),
})

export const ResetPasswordSchema = z
  .object({
    token: z.string().min(1),
    password: z.string().min(6, 'Password minimal 6 karakter'),
    confirmPassword: z.string(),
  })
  .refine((d) => d.password === d.confirmPassword, {
    message: 'Password tidak cocok',
    path: ['confirmPassword'],
  })

export const UpdateProfileSchema = z.object({
  name: z.string().min(2).max(100).optional(),
  whatsapp: z
    .string()
    .regex(/^62\d{9,13}$/, 'Format WhatsApp: 628xxxxxxxxxx')
    .optional()
    .or(z.literal('')),
  currentPassword: z.string().optional(),
  newPassword: z.string().min(6).optional(),
})

// ─── KALKULASI ────────────────────────────────────────────────

export const CalcInputSchema = z.object({
  label: z.string().max(100).optional(),
  stockCode: z.string().max(10).toUpperCase().optional(),
  inputMode: z.enum(['lot', 'modal']),
  pricePerShare: z.number().positive(),
  lot: z.number().int().positive().optional(),
  modalInput: z.number().positive().optional(),
  targetProfit: z.number().min(0).max(1000),
  stopLoss: z.number().min(0).max(100),
  feeBuy: z.number().min(0).max(5).default(0.19),
  feeSell: z.number().min(0).max(5).default(0.29),
})

export type RegisterType = z.infer<typeof RegisterSchema>
export type LoginType = z.infer<typeof LoginSchema>
export type CalcInputType = z.infer<typeof CalcInputSchema>
```

---

## Fitur Aplikasi

### MVP (Fase 1)

- [x] Form kalkulator dengan dua mode input (lot & nominal modal)
- [x] Kalkulasi real-time untung/rugi bruto dan net
- [x] Rincian fee beli dan jual
- [x] Registrasi akun (nama, email, no WhatsApp, password)
- [x] Login dengan email & password
- [x] Forgot password via email (link token 1 jam)
- [x] Reset password dengan token
- [x] Halaman profil — edit nama, WhatsApp, ganti password
- [x] Route protection via middleware (redirect ke /login)
- [x] Simpan hasil kalkulasi per user ke SQLite via Prisma
- [x] Halaman riwayat kalkulasi dengan pagination
- [x] Hapus riwayat kalkulasi

### Fase 2

- [ ] Input kode saham & nama perusahaan
- [ ] Watchlist / daftar saham favorit
- [ ] Export riwayat ke CSV
- [ ] Filter & search riwayat berdasarkan kode saham atau tanggal
- [ ] Perbandingan dua skenario saham berbeda

### Fase 3

- [ ] Autentikasi pengguna (NextAuth.js)
- [ ] Multi-user support
- [ ] Grafik performa simulasi portofolio
- [ ] Integrasi harga saham real-time (via API publik)

---

## Setup & Instalasi

```bash
# 1. Buat proyek Next.js
npx create-next-app@latest stock-calculator --typescript --tailwind --app

cd stock-calculator

# 2. Install dependencies
npm install prisma @prisma/client zod
npm install next-auth@beta
npm install bcryptjs nodemailer
npm install -D @types/bcryptjs @types/nodemailer

# 3. Init Prisma dengan SQLite
npx prisma init --datasource-provider sqlite

# 4. Salin schema di atas ke prisma/schema.prisma
# Lalu jalankan migrasi pertama
npx prisma migrate dev --name init_with_auth

# 5. Generate Prisma client
npx prisma generate

# 6. Generate NEXTAUTH_SECRET
openssl rand -base64 32
# Salin output ke .env → NEXTAUTH_SECRET="..."

# 7. Jalankan dev server
npm run dev
```

---

## Catatan Penting

- **1 lot = 100 lembar saham** (standar Bursa Efek Indonesia)
- Fee beli default **0.19%**, fee jual default **0.29%** (umum di sekuritas Indonesia, bisa disesuaikan per broker)
- Modal efektif yang digunakan saat input via nominal akan dibulatkan ke kelipatan lot terdekat ke bawah
- Semua nilai kalkulasi disimpan ke database agar halaman riwayat tidak perlu re-kalkulasi
- Gunakan **Prisma singleton pattern** untuk menghindari koneksi berlebih di development (hot reload Next.js)
- Password disimpan sebagai **bcrypt hash** dengan salt rounds 12 — jangan pernah simpan plain text
- Token reset password berlaku **1 jam** dan hanya bisa dipakai **sekali** (`used = true` setelah dipakai)
- Response endpoint `forgot-password` selalu `200` meski email tidak ditemukan — ini disengaja untuk mencegah **user enumeration attack**
- Format WhatsApp yang diterima: **`628xxxxxxxxxx`** (kode negara Indonesia tanpa `+`)
- Gunakan `openssl rand -base64 32` untuk generate `NEXTAUTH_SECRET` yang aman
- Untuk production, ganti SQLite dengan **PostgreSQL** dan deploy email via **Resend** atau **AWS SES**
