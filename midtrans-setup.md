# PRD (Product Requirements Document)

## Integrasi Midtrans Sandbox untuk Fitur Berlangganan Paket Pro – Next.js Project

---

# 1. Informasi Umum

## Nama Project

Integrasi Payment Gateway Midtrans Sandbox untuk Sistem Berlangganan Paket Pro

## Platform

Web Application berbasis Next.js (Fullstack)

## Tujuan Utama

Mengintegrasikan layanan payment gateway Midtrans Sandbox agar user dapat melakukan pembayaran paket langanan Pro secara otomatis, aman, dan terverifikasi.

## Target User

* Investor retail pengguna aplikasi saham
* User yang ingin upgrade dari Free Plan ke Pro Plan
* Admin pengelola transaksi langganan

---

# 2. Background

Saat ini aplikasi memiliki fitur premium (Pro) namun belum memiliki sistem pembayaran otomatis.

Proses upgrade masih manual sehingga:

* Tidak efisien
* Sulit tracking pembayaran
* Risiko human error tinggi
* Tidak scalable

Solusi yang dibutuhkan adalah integrasi dengan Midtrans Sandbox untuk simulasi pembayaran sebelum production deployment.

---

# 3. Scope Project

## In Scope

### User Side

* Halaman pricing paket langganan
* Tombol pilih paket
* Checkout pembayaran
* Integrasi Midtrans Snap Popup
* Status pembayaran otomatis
* Upgrade akun ke Pro setelah pembayaran sukses
* Riwayat langanan user

### Admin Side

* Monitoring transaksi pembayaran
* Status transaksi
* Validasi webhook Midtrans
* Manajemen paket langganan

---

## Out of Scope (Phase 2)

* Auto recurring subscription
* Refund automation
* Promo code / voucher
* Affiliate referral
* Multi payment gateway
* Invoice PDF

---

# 4. Paket Berlangganan

## Paket Available

| Paket     |   Durasi |      Harga |
| --------- | -------: | ---------: |
| Bulanan   |  1 Bulan |  Rp 15.000 |
| Kuartalan |  3 Bulan |  Rp 35.000 |
| Semester  |  6 Bulan |  Rp 55.000 |
| Tahunan   | 12 Bulan | Rp 100.000 |

---

# 5. User Flow

## Flow Pembayaran

### Step 1

User login ke sistem

↓

### Step 2

Masuk ke halaman Pricing

↓

### Step 3

Klik tombol “Pilih Paket”

↓

### Step 4

Sistem membuat Order ID unik

↓

### Step 5

Server request token ke Midtrans Snap API

↓

### Step 6

Snap Popup Midtrans muncul

↓

### Step 7

User memilih metode pembayaran

↓

### Step 8

Midtrans mengirim callback notification

↓

### Step 9

Sistem verifikasi payment status

↓

### Step 10

Jika sukses:

* akun upgrade ke Pro
* masa aktif subscription bertambah
* transaksi dicatat

↓

### Step 11

User melihat status aktif Pro

---

# 6. Functional Requirements

---

## FR-01 Halaman Pricing

### Deskripsi

Menampilkan seluruh paket Pro.

### Acceptance Criteria

* Harga tampil jelas
* Benefit paket tampil
* Highlight paket rekomend
* CTA “Pilih Paket”

---

## FR-02 Generate Payment

### Deskripsi

Saat user klik paket, sistem membuat transaksi baru.

### Acceptance Criteria

* Generate unique order_id
* Simpan transaksi ke database
* Status awal: pending

---

## FR-03 Midtrans Snap Integration

### Deskripsi

Server membuat Snap Token.

### Acceptance Criteria

* Menggunakan Midtrans Sandbox
* Snap token valid
* Token dikirim ke frontend

---

## FR-04 Payment Popup

### Deskripsi

Popup pembayaran muncul.

### Acceptance Criteria

* Snap popup berjalan normal
* Redirect success/pending/error

---

## FR-05 Webhook Callback

### Deskripsi

Midtrans mengirim payment notification.

### Acceptance Criteria

* Endpoint webhook aman
* Signature key validation
* Status transaksi terupdate

---

## FR-06 Upgrade Subscription

### Deskripsi

Setelah pembayaran sukses, akun berubah menjadi Pro.

### Acceptance Criteria

* Role updated
* Expired date calculated
* Multiple subscription handled properly

---

## FR-07 Payment History

### Deskripsi

User dapat melihat histori pembayaran.

### Acceptance Criteria

* Paket
* Nominal
* Status
* Tanggal
* Expired subscription

---

# 7. Non Functional Requirements

## Security

* Signature key validation wajib
* Secret key tidak expose ke frontend
* Environment variable aman

## Performance

* Checkout < 3 detik

## Reliability

* Retry webhook handling

## Scalability

* Support 10.000+ transaksi

---

# 8. Database Design

---

## Table: subscriptions

| Field          | Type             |
| -------------- | ---------------- |
| id             | UUID             |
| user_id        | UUID             |
| package_name   | string           |
| duration_month | integer          |
| price          | decimal          |
| start_date     | datetime         |
| end_date       | datetime         |
| status         | active / expired |

---

## Table: transactions

| Field                   | Type                       |
| ----------------------- | -------------------------- |
| id                      | UUID                       |
| user_id                 | UUID                       |
| order_id                | string                     |
| package_name            | string                     |
| gross_amount            | decimal                    |
| payment_type            | string                     |
| transaction_status      | pending / success / failed |
| midtrans_transaction_id | string                     |
| payment_url             | text                       |
| created_at              | datetime                   |

---

# 9. API Requirements

---

## POST /api/payment/create

### Function

Generate transaksi + snap token

### Response

```json
{
  "snapToken": "xxxxxx",
  "orderId": "INV-2026-001"
}
```

---

## POST /api/payment/webhook

### Function

Receive Midtrans notification

### Validation

* signature key
* transaction status

---

## GET /api/payment/history

### Function

User payment history

---

# 10. Midtrans Configuration

## Environment Variables

```env
MIDTRANS_SERVER_KEY=
MIDTRANS_CLIENT_KEY=
MIDTRANS_IS_PRODUCTION=false
MIDTRANS_MERCHANT_ID=
NEXT_PUBLIC_MIDTRANS_CLIENT_KEY=
```

---

# 11. Technical Stack

## Frontend

* Next.js
* Tailwind CSS
* Shadcn UI
* Midtrans Snap JS



# 12. Development Priority

## Priority 1 (MVP)

* Pricing page
* Midtrans sandbox
* Snap popup
* Callback webhook
* Upgrade Pro account

## Priority 2

* Payment history
* Admin transaction monitoring

## Priority 3

* Auto renewal
* Invoice PDF


---

# 13. Success Metrics

## KPI

* Payment success rate > 90%
* Failed payment < 5%
* Checkout completion time < 3 menit
* Manual admin validation = 0

---

# 14. Risk Assessment

| Risk               | Solution               |
| ------------------ | ---------------------- |
| Webhook gagal      | Retry mechanism        |
| Duplicate callback | Idempotent validation  |
| Payment fraud      | Signature verification |
| Expired token      | Token regeneration     |

---

# 15. Final Deliverables

* Fully working Midtrans Sandbox integration
* Production-ready payment flow
* Secure webhook system
* Subscription automation
* Admin monitoring dashboard
* Deployment-ready architecture

---

# Catatan Penting Developer

Gunakan:

## Midtrans Snap API

(BUKAN Core API terlebih dahulu jika sudah berhasil baru menggunakan production)

karena:

* lebih cepat implementasi
* UI pembayaran sudah siap
* cocok untuk MVP
* lebih aman untuk early production

---

