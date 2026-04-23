'use client'

import { useEffect, useState } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

interface StatusData {
  hasAccess: boolean
  isAdmin: boolean
  expiredAt?: string
}

export default function SubscriptionPage() {
  const { status } = useSession()
  const router = useRouter()
  const [data, setData] = useState<StatusData | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (status === 'unauthenticated') router.push('/login')
  }, [status, router])

  useEffect(() => {
    if (status !== 'authenticated') return
    fetch('/api/subscription/status')
      .then(r => r.json())
      .then(setData)
      .finally(() => setLoading(false))
  }, [status])

  if (status === 'loading' || loading) return null

  const isActive = data?.hasAccess && !data?.isAdmin
  const isAdmin  = data?.isAdmin

  const expiredDate = data?.expiredAt
    ? new Date(data.expiredAt).toLocaleDateString('id-ID', {
        day: 'numeric', month: 'long', year: 'numeric'
      })
    : null

  const daysLeft = data?.expiredAt
    ? Math.ceil((new Date(data.expiredAt).getTime() - Date.now()) / 86400000)
    : null

  return (
    <div className="min-h-screen bg-gray-50 py-10">
      <div className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8">

        <div className="mb-8">
          <h1 className="text-2xl font-bold text-gray-900">Status Langganan</h1>
          <p className="mt-1 text-sm text-gray-500">Kelola paket Pro Anda</p>
        </div>

        {/* Status card */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 mb-6">
          {isAdmin ? (
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-indigo-100 rounded-full flex items-center justify-center flex-shrink-0">
                <svg className="w-6 h-6 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                    d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                </svg>
              </div>
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-base font-bold text-gray-900">Super Admin</span>
                  <span className="px-2 py-0.5 rounded text-xs font-bold bg-indigo-100 text-indigo-700">ADMIN</span>
                </div>
                <p className="text-sm text-gray-500">Akses penuh ke semua fitur tanpa batas waktu</p>
              </div>
            </div>
          ) : isActive ? (
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center flex-shrink-0">
                <svg className="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-base font-bold text-gray-900">Paket Pro Aktif</span>
                  <span className="px-2 py-0.5 rounded text-xs font-bold bg-green-100 text-green-700">AKTIF</span>
                </div>
                <p className="text-sm text-gray-500">
                  Berlaku hingga <strong>{expiredDate}</strong>
                  {daysLeft !== null && (
                    <span className={`ml-2 font-medium ${daysLeft <= 7 ? 'text-red-500' : 'text-gray-500'}`}>
                      ({daysLeft} hari lagi)
                    </span>
                  )}
                </p>
              </div>
            </div>
          ) : (
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-gray-100 rounded-full flex items-center justify-center flex-shrink-0">
                <svg className="w-6 h-6 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                    d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                </svg>
              </div>
              <div>
                <span className="text-base font-bold text-gray-900">Belum Berlangganan</span>
                <p className="text-sm text-gray-500 mt-0.5">Aktifkan paket Pro untuk mengakses semua fitur</p>
              </div>
            </div>
          )}
        </div>

        {/* CTA */}
        {!isAdmin && (
          <div className="bg-indigo-50 border border-indigo-200 rounded-xl p-5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <p className="text-sm font-semibold text-indigo-900">
                {isActive ? 'Perpanjang Langganan' : 'Mulai Berlangganan'}
              </p>
              <p className="text-xs text-indigo-700 mt-0.5">
                {isActive
                  ? 'Perpanjang sebelum masa aktif habis agar tidak terputus'
                  : 'Pilih paket yang sesuai, mulai dari Rp 15.000 / bulan'}
              </p>
            </div>
            <Link
              href="/pricing"
              className="inline-flex items-center justify-center px-5 py-2.5 bg-indigo-600 text-white text-sm font-semibold rounded-lg hover:bg-indigo-700 whitespace-nowrap"
            >
              {isActive ? 'Perpanjang' : 'Lihat Paket'}
            </Link>
          </div>
        )}

      </div>
    </div>
  )
}
