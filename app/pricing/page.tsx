'use client'

import { useState } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { PLANS } from '@/lib/subscription'

const FEATURES = [
  'Rekap Dividen lengkap',
  'Rekap Chart per tahun',
  'Rekap By Sekuritas',
  'Rekap Portofolio',
  'Daftar Sekuritas',
]

export default function PricingPage() {
  const { status } = useSession()
  const router = useRouter()
  const [loading, setLoading] = useState<string | null>(null)
  const [info, setInfo] = useState('')

  if (status === 'unauthenticated') {
    router.push('/login')
    return null
  }

  const handleSelect = async (planId: string) => {
    setLoading(planId)
    setInfo('')
    try {
      const res = await fetch('/api/subscription/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ planId }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Gagal membuat pesanan')
      setInfo(`Pesanan berhasil dibuat (${data.orderId}). Hubungi admin untuk aktivasi.`)
    } catch (e) {
      setInfo((e as Error).message)
    } finally {
      setLoading(null)
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 py-12">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">

        {/* Header */}
        <div className="text-center mb-12">
          <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-bold bg-indigo-600 text-white mb-4">
            PAKET PRO
          </span>
          <h1 className="text-3xl font-bold text-gray-900 mb-3">Pilih Paket Langganan</h1>
          <p className="text-gray-500 max-w-xl mx-auto">
            Akses penuh ke semua fitur Pro. Makin panjang berlangganan, makin hemat per bulannya.
          </p>
        </div>

        {info && (
          <div className="mb-8 rounded-lg bg-blue-50 border border-blue-200 px-4 py-3 text-sm text-blue-800 text-center">
            {info}
          </div>
        )}

        {/* Plan cards — 4 kolom */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5 mb-10">
          {PLANS.map((plan) => {
            const isPopular = plan.id === 'YEARLY'
            const perBulan  = Math.round(plan.price / plan.months)
            return (
              <div
                key={plan.id}
                className={`relative bg-white rounded-2xl shadow-sm border-2 p-5 flex flex-col ${
                  isPopular ? 'border-indigo-500' : 'border-gray-200'
                }`}
              >
                {isPopular && (
                  <span className="absolute -top-3 left-1/2 -translate-x-1/2 inline-flex items-center px-3 py-1 rounded-full text-xs font-bold bg-indigo-600 text-white whitespace-nowrap">
                    Paling Hemat
                  </span>
                )}

                {/* Label & durasi */}
                <div className="mb-4">
                  <h3 className="text-base font-bold text-gray-900 mb-0.5">{plan.label}</h3>
                  <p className="text-xs text-gray-400">{plan.months} bulan akses penuh</p>
                </div>

                {/* Harga */}
                <div className="mb-5">
                  <div className="flex items-baseline gap-1">
                    <span className="text-2xl font-extrabold text-gray-900">{plan.priceLabel}</span>
                  </div>
                  <p className="text-xs text-gray-400 mt-0.5">
                    / {plan.months === 1 ? 'bulan' : `${plan.months} bulan`}
                  </p>
                  {plan.months > 1 && (
                    <p className="text-xs text-green-600 mt-1 font-semibold">
                      ≈ Rp {perBulan.toLocaleString('id-ID')} / bulan
                    </p>
                  )}
                </div>

                {/* Fitur */}
                <ul className="space-y-1.5 mb-6 flex-1">
                  {FEATURES.map(f => (
                    <li key={f} className="flex items-center gap-2 text-xs text-gray-600">
                      <svg className="w-3.5 h-3.5 text-green-500 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                      </svg>
                      {f}
                    </li>
                  ))}
                </ul>

                <button
                  onClick={() => handleSelect(plan.id)}
                  disabled={!!loading || status === 'loading'}
                  className={`w-full py-2.5 rounded-lg text-sm font-semibold transition-colors disabled:opacity-60 disabled:cursor-not-allowed ${
                    isPopular
                      ? 'bg-indigo-600 text-white hover:bg-indigo-700'
                      : 'bg-gray-100 text-gray-800 hover:bg-gray-200'
                  }`}
                >
                  {loading === plan.id ? 'Memproses...' : 'Pilih Paket'}
                </button>
              </div>
            )
          })}
        </div>

        {/* Coming soon notice */}
        <div className="bg-amber-50 border border-amber-200 rounded-lg px-5 py-4 flex items-start gap-3">
          <svg className="w-5 h-5 text-amber-500 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <div>
            <p className="text-sm font-medium text-amber-800">Pembayaran via Midtrans segera hadir</p>
            <p className="text-xs text-amber-700 mt-0.5">
              Sistem pembayaran sedang dalam persiapan. Hubungi admin untuk aktivasi manual sementara.
            </p>
          </div>
        </div>

      </div>
    </div>
  )
}
