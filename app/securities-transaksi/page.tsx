'use client'

import { useState, useEffect, useCallback } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { ProGate } from '@/components/ProGate'

interface PortfolioRow {
  id: string
  keterangan: string
  saham: string
  hargaRata: number
  lot: number
  lastPrice: number | null
  lastPriceAt: string | null
}

interface Security {
  id: string
  nama: string
  kode: string
  status: string
}

const rp = (v: number) => `Rp ${v.toLocaleString('id-ID')}`
const pct = (v: number) => `${v >= 0 ? '+' : ''}${v.toFixed(2)}%`

export default function SecuritiesTransaksiPage() {
  const { data: session, status } = useSession()
  const router = useRouter()

  const [proAccess, setProAccess] = useState<{ hasAccess: boolean } | null>(null)
  const [securities, setSecurities] = useState<Security[]>([])
  const [rows, setRows] = useState<PortfolioRow[]>([])
  const [loading, setLoading] = useState(false)
  const [selectedKet, setSelectedKet] = useState('')

  useEffect(() => {
    if (status === 'unauthenticated') router.push('/login')
  }, [status, router])

  const fetchSecurities = useCallback(async (userId: string) => {
    try {
      const res = await fetch(`/api/securities?userId=${userId}&limit=100`)
      if (res.ok) {
        const json = await res.json()
        const list: Security[] = json.securities ?? json
        setSecurities(list.filter(s => s.status === 'ACTIVE'))
      }
    } catch { /* silently fail */ }
  }, [])

  const fetchPortfolio = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/portfolio')
      if (res.ok) setRows(await res.json())
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (status !== 'authenticated') return
    fetch('/api/subscription/status').then(r => r.json()).then(setProAccess)
    const userId = (session?.user as any)?.id
    if (userId) fetchSecurities(userId)
    fetchPortfolio()
  }, [status, session, fetchSecurities, fetchPortfolio])

  if (status === 'loading' || proAccess === null) return null
  if (!proAccess.hasAccess) return <ProGate />

  const keterangans = Array.from(new Set(rows.map(r => r.keterangan))).sort()
  const filtered = selectedKet ? rows.filter(r => r.keterangan === selectedKet) : rows

  const totalModal = filtered.reduce((s, r) => s + r.hargaRata * r.lot * 100, 0)
  const totalNilaiPasar = filtered.reduce((s, r) => s + (r.lastPrice ?? r.hargaRata) * r.lot * 100, 0)
  const totalFloatRp = totalNilaiPasar - totalModal
  const totalFloatPct = totalModal > 0 ? (totalFloatRp / totalModal) * 100 : 0

  return (
    <div className="p-4 sm:p-6 lg:p-8 pt-16 lg:pt-8">
      <div className="mb-6">
        <h1 className="text-xl font-bold text-gray-900">Daftar Sekuritas & Transaksi</h1>
        <p className="text-sm text-gray-500 mt-1">
          Daftar saham yang dimiliki pada setiap akun sekuritas di portofolio Anda.
        </p>
      </div>

      {/* Filter Akun Sekuritas */}
      <div className="mb-4 flex items-center gap-3">
        <select
          value={selectedKet}
          onChange={e => setSelectedKet(e.target.value)}
          className="border border-gray-300 rounded-md px-3 py-1.5 text-sm focus:ring-indigo-500 focus:border-indigo-500"
        >
          <option value="">Semua Akun Sekuritas</option>
          {keterangans.map(k => <option key={k} value={k}>{k}</option>)}
        </select>
        {selectedKet && (
          <button onClick={() => setSelectedKet('')}
            className="px-3 py-1.5 bg-gray-100 text-gray-600 text-sm rounded-md hover:bg-gray-200">
            Reset
          </button>
        )}
        <span className="ml-auto text-xs text-gray-400">{filtered.length} posisi</span>
      </div>

      {/* Ringkasan */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        <div className="bg-white rounded-lg shadow p-4">
          <p className="text-xs text-gray-500">Total Modal</p>
          <p className="text-lg font-bold text-gray-900">{rp(totalModal)}</p>
        </div>
        <div className="bg-white rounded-lg shadow p-4">
          <p className="text-xs text-gray-500">Total Nilai Pasar</p>
          <p className="text-lg font-bold text-gray-900">{rp(totalNilaiPasar)}</p>
        </div>
        <div className="bg-white rounded-lg shadow p-4">
          <p className="text-xs text-gray-500">Float</p>
          <p className={`text-lg font-bold ${totalFloatRp >= 0 ? 'text-green-600' : 'text-red-600'}`}>
            {rp(totalFloatRp)} <span className="text-sm">({pct(totalFloatPct)})</span>
          </p>
        </div>
      </div>

      {/* Tabel */}
      <div className="bg-white shadow sm:rounded-lg overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm divide-y divide-gray-100">
            <thead className="bg-gray-50">
              <tr>
                {['Akun Sekuritas', 'Kode Saham', 'Harga Rata', 'Lot', 'Harga Terakhir', 'Nilai Pasar', 'Float'].map(h => (
                  <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {loading ? (
                <tr><td colSpan={7} className="px-4 py-10 text-center text-gray-400">Memuat data...</td></tr>
              ) : filtered.length === 0 ? (
                <tr><td colSpan={7} className="px-4 py-10 text-center text-gray-400">Belum ada data saham di portofolio.</td></tr>
              ) : filtered.map(row => {
                const modal = row.hargaRata * row.lot * 100
                const hargaTerakhir = row.lastPrice ?? row.hargaRata
                const nilaiPasar = hargaTerakhir * row.lot * 100
                const floatRp = nilaiPasar - modal
                const floatPct = modal > 0 ? (floatRp / modal) * 100 : 0
                return (
                  <tr key={row.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 text-gray-700 whitespace-nowrap">{row.keterangan}</td>
                    <td className="px-4 py-3 font-bold text-indigo-700 whitespace-nowrap">{row.saham}</td>
                    <td className="px-4 py-3 text-gray-900 whitespace-nowrap">{rp(row.hargaRata)}</td>
                    <td className="px-4 py-3 text-gray-900 whitespace-nowrap">{row.lot}</td>
                    <td className="px-4 py-3 text-gray-900 whitespace-nowrap">
                      {row.lastPrice != null ? rp(row.lastPrice) : <span className="text-gray-300">—</span>}
                    </td>
                    <td className="px-4 py-3 text-gray-900 whitespace-nowrap">{rp(nilaiPasar)}</td>
                    <td className={`px-4 py-3 whitespace-nowrap font-semibold ${floatRp >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                      {rp(floatRp)} ({pct(floatPct)})
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
