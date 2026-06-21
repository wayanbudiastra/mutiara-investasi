'use client'

import { useState, useEffect } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { ProGate } from '@/components/ProGate'

interface PortfolioRow {
  id: string
  keterangan: string
  saham: string
  hargaRata: number
  lot: number
}

export default function DataTransaksiPage() {
  const { status } = useSession()
  const router = useRouter()

  const [proAccess, setProAccess] = useState<{ hasAccess: boolean } | null>(null)
  const [rows, setRows] = useState<PortfolioRow[]>([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (status === 'unauthenticated') router.push('/login')
  }, [status, router])

  useEffect(() => {
    if (status !== 'authenticated') return
    fetch('/api/subscription/status').then(r => r.json()).then(setProAccess)
  }, [status])

  useEffect(() => {
    if (status !== 'authenticated') return
    setLoading(true)
    fetch('/api/portfolio')
      .then(r => r.ok ? r.json() : [])
      .then(setRows)
      .finally(() => setLoading(false))
  }, [status])

  if (status === 'loading' || proAccess === null) return null
  if (!proAccess.hasAccess) return <ProGate />

  const sahamList = Array.from(
    rows.reduce((map, r) => map.set(r.saham, (map.get(r.saham) ?? 0) + r.lot), new Map<string, number>())
  )
    .map(([saham, lot]) => ({ saham, lot }))
    .sort((a, b) => a.saham.localeCompare(b.saham))

  return (
    <div className="p-4 sm:p-6 lg:p-8 pt-16 lg:pt-8">
      <div className="mb-1 flex items-center gap-2">
        <h1 className="text-xl font-bold text-gray-900">Data Transaksi</h1>
        <span className="px-1.5 py-0.5 rounded text-xs font-bold bg-indigo-100 text-indigo-700">PRO</span>
      </div>
      <p className="text-sm text-gray-500 mb-6">
        Pilih saham dari portofolio kamu untuk melihat ringkasan aktivitas broker harian.
      </p>

      {loading ? (
        <div className="bg-white rounded-lg shadow p-16 text-center text-gray-400">Memuat data...</div>
      ) : sahamList.length === 0 ? (
        <div className="bg-white rounded-lg shadow p-16 text-center text-gray-400">
          Belum ada saham di portofolio kamu.<br />
          <Link href="/portfolio" className="text-indigo-600 hover:underline text-sm">
            Tambah saham ke portofolio →
          </Link>
        </div>
      ) : (
        <div className="bg-white shadow sm:rounded-lg divide-y divide-gray-100 overflow-hidden">
          {sahamList.map(item => (
            <Link
              key={item.saham}
              href={`/data-transaksi/${item.saham}`}
              className="flex items-center justify-between px-4 py-3 hover:bg-gray-50 transition-colors"
            >
              <div>
                <p className="font-bold text-indigo-700">{item.saham}</p>
                <p className="text-xs text-gray-500">{item.lot} lot</p>
              </div>
              <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
