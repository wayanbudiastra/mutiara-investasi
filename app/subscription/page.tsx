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

interface PaymentRow {
  orderId: string
  amount: number
  status: string
  midtransTxId: string | null
  createdAt: string
  plan: string
  expiredAt: string
}

const PLAN_LABELS: Record<string, string> = {
  FREE_TRIAL: 'Free Trial',
  MONTHLY: 'Bulanan', QUARTERLY: 'Kuartalan', SEMESTER: 'Semester', YEARLY: 'Tahunan',
}

const STATUS_STYLE: Record<string, string> = {
  PAID:    'bg-green-100 text-green-800',
  PENDING: 'bg-yellow-100 text-yellow-800',
  FAILED:  'bg-red-100 text-red-800',
}

const rp = (v: number) => `Rp ${v.toLocaleString('id-ID')}`

export default function SubscriptionPage() {
  const { status } = useSession()
  const router = useRouter()
  const [data, setData]       = useState<StatusData | null>(null)
  const [history, setHistory] = useState<PaymentRow[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (status === 'unauthenticated') router.push('/login')
  }, [status, router])

  useEffect(() => {
    if (status !== 'authenticated') return
    Promise.all([
      fetch('/api/subscription/status').then(r => r.json()),
      fetch('/api/payment/history').then(r => r.json()),
    ]).then(([statusData, historyData]) => {
      setData(statusData)
      setHistory(Array.isArray(historyData) ? historyData : [])
    }).finally(() => setLoading(false))
  }, [status])

  if (status === 'loading' || loading) return null

  const isActive    = data?.hasAccess && !data?.isAdmin
  const isAdmin     = data?.isAdmin
  const isTrial     = isActive && history.some(h => h.status === 'PAID' ? false : h.plan === 'FREE_TRIAL')
  const activePlan  = history.find(h => h.plan !== 'FREE_TRIAL' && h.status === 'PAID')

  const expiredDate = data?.expiredAt
    ? new Date(data.expiredAt).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })
    : null

  const daysLeft = data?.expiredAt
    ? Math.ceil((new Date(data.expiredAt).getTime() - Date.now()) / 86400000)
    : null

  return (
    <div className="min-h-screen bg-gray-50 py-10">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">

        <div className="mb-8">
          <h1 className="text-2xl font-bold text-gray-900">Status Langganan</h1>
          <p className="mt-1 text-sm text-gray-500">Kelola paket Pro dan riwayat pembayaran Anda</p>
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
              <div className={`w-12 h-12 rounded-full flex items-center justify-center flex-shrink-0 ${isTrial ? 'bg-amber-100' : 'bg-green-100'}`}>
                <svg className={`w-6 h-6 ${isTrial ? 'text-amber-600' : 'text-green-600'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-base font-bold text-gray-900">
                    {isTrial ? 'Free Trial' : `Pro — ${PLAN_LABELS[activePlan?.plan ?? ''] ?? 'Aktif'}`}
                  </span>
                  <span className={`px-2 py-0.5 rounded text-xs font-bold ${isTrial ? 'bg-amber-100 text-amber-700' : 'bg-green-100 text-green-700'}`}>
                    {isTrial ? 'TRIAL' : 'AKTIF'}
                  </span>
                </div>
                <p className="text-sm text-gray-500">
                  Berlaku hingga <strong>{expiredDate}</strong>
                  {daysLeft !== null && (
                    <span className={`ml-2 font-medium ${daysLeft <= 7 ? 'text-red-500' : 'text-gray-500'}`}>
                      ({daysLeft} hari lagi)
                    </span>
                  )}
                </p>
                {isTrial && (
                  <p className="text-xs text-amber-600 mt-1">
                    Setelah trial berakhir, berlangganan Pro untuk tetap akses semua fitur.
                  </p>
                )}
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
          <div className="bg-indigo-50 border border-indigo-200 rounded-xl p-5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-8">
            <div>
              <p className="text-sm font-semibold text-indigo-900">
                {isActive ? 'Perpanjang Langganan' : 'Mulai Berlangganan'}
              </p>
              <p className="text-xs text-indigo-700 mt-0.5">
                {isActive
                  ? 'Perpanjang sebelum masa aktif habis'
                  : 'Mulai dari Rp 15.000 / bulan'}
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

        {/* Payment History */}
        {history.length > 0 && (
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-100">
              <h2 className="text-sm font-bold text-gray-900">Riwayat Pembayaran</h2>
            </div>
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead className="bg-gray-50">
                  <tr>
                    {['Order ID', 'Paket', 'Nominal', 'Status', 'Berlaku Hingga', 'Tanggal'].map(h => (
                      <th key={h} className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {history.map(row => (
                    <tr key={row.orderId} className="hover:bg-gray-50">
                      <td className="px-4 py-3 text-xs text-gray-500 font-mono">{row.orderId}</td>
                      <td className="px-4 py-3 text-gray-900 whitespace-nowrap">
                        {PLAN_LABELS[row.plan] ?? row.plan}
                      </td>
                      <td className="px-4 py-3 text-gray-900 whitespace-nowrap">{rp(row.amount)}</td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-bold ${STATUS_STYLE[row.status] ?? 'bg-gray-100 text-gray-600'}`}>
                          {row.status}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-gray-700 whitespace-nowrap">
                        {row.expiredAt
                          ? new Date(row.expiredAt).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })
                          : '—'}
                      </td>
                      <td className="px-4 py-3 text-gray-500 whitespace-nowrap">
                        {new Date(row.createdAt).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

      </div>
    </div>
  )
}
