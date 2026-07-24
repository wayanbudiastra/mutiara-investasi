'use client'

import { useState, useEffect, useCallback } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter, useParams } from 'next/navigation'
import Link from 'next/link'
import { ProGate } from '@/components/ProGate'

interface StockForeignRow {
  date: string
  close: number
  volume: number
  foreignBuy: number
  foreignSell: number
  netForeignVolume: number
  estimatedNetForeignValue: number
  highNonRegular: boolean
}

const rp = (v: number) => `Rp ${v.toLocaleString('id-ID')}`
const fmtDate = (d: string) => new Date(d + 'T00:00:00').toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })

export default function DataTransaksiDetailPage() {
  const { status } = useSession()
  const router = useRouter()
  const params = useParams()
  const kode = String(params.kode ?? '').toUpperCase()

  const [proAccess, setProAccess] = useState<{ hasAccess: boolean } | null>(null)
  const [history, setHistory] = useState<StockForeignRow[]>([])
  const [loadingHistory, setLoadingHistory] = useState(false)
  const [refreshing, setRefreshing] = useState(false)
  const [refreshMsg, setRefreshMsg] = useState<{ ok: boolean; text: string } | null>(null)

  useEffect(() => {
    if (status === 'unauthenticated') router.push('/login')
  }, [status, router])

  useEffect(() => {
    if (status !== 'authenticated') return
    fetch('/api/subscription/status').then(r => r.json()).then(setProAccess)
  }, [status])

  const fetchHistory = useCallback(async (code: string) => {
    setLoadingHistory(true)
    try {
      const res = await fetch(`/api/stock-foreign/history?kode=${code}&days=30`)
      if (res.ok) {
        const body = await res.json()
        setHistory(body.data ?? [])
      }
    } finally {
      setLoadingHistory(false)
    }
  }, [])

  useEffect(() => {
    if (status === 'authenticated' && kode) fetchHistory(kode)
  }, [status, kode, fetchHistory])

  const handleRefresh = useCallback(async () => {
    setRefreshing(true)
    setRefreshMsg(null)
    try {
      const res = await fetch(`/api/data-transaksi/refresh?kode=${kode}`, { method: 'POST' })
      const body = await res.json()
      if (!res.ok) {
        setRefreshMsg({ ok: false, text: body.error ?? 'Gagal memperbarui data.' })
        return
      }
      const { stock } = body.results
      setRefreshMsg(
        stock.success
          ? { ok: true, text: stock.count > 0 ? `Data ${kode} berhasil diperbarui.` : `Saham ${kode} tidak ditemukan di data IDX untuk hari ini.` }
          : { ok: false, text: `Gagal memperbarui: ${stock.error}` },
      )
      await fetchHistory(kode)
    } catch {
      setRefreshMsg({ ok: false, text: 'Gagal memperbarui data — coba lagi.' })
    } finally {
      setRefreshing(false)
    }
  }, [kode, fetchHistory])

  if (status === 'loading' || proAccess === null) return null
  if (!proAccess.hasAccess) return <ProGate />

  return (
    <div className="p-4 sm:p-6 lg:p-8 pt-16 lg:pt-8">
      <Link href="/data-transaksi" className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700 mb-3">
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
        </svg>
        Kembali
      </Link>

      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-2">
        <h1 className="text-xl font-bold text-gray-900">{kode}</h1>
        <button
          onClick={handleRefresh}
          disabled={refreshing}
          className="inline-flex items-center gap-1.5 border border-gray-300 rounded-md px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <svg className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
          {refreshing ? `Memperbarui ${kode}...` : `Perbarui Data ${kode}`}
        </button>
      </div>

      {refreshMsg && (
        <p className={`text-xs mb-4 ${refreshMsg.ok ? 'text-green-600' : 'text-red-600'}`}>{refreshMsg.text}</p>
      )}

      {/* Net Asing per saham ini — spesifik untuk {kode}, 30 hari terakhir */}
      <div className="mb-6 bg-white shadow sm:rounded-lg overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-100">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Net Asing pada Saham {kode} — 30 Hari Terakhir</p>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm divide-y divide-gray-100">
            <thead className="bg-gray-50">
              <tr>
                {['Tanggal', 'Close', 'Volume', 'Foreign Buy', 'Foreign Sell', 'Net Volume', 'Estimasi Net Value'].map(h => (
                  <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {loadingHistory ? (
                <tr><td colSpan={7} className="px-4 py-10 text-center text-gray-400">Memuat data...</td></tr>
              ) : history.length === 0 ? (
                <tr><td colSpan={7} className="px-4 py-10 text-center text-gray-400">Belum ada data foreign flow untuk saham ini. Coba klik &quot;Perbarui Data {kode}&quot;.</td></tr>
              ) : history.map(row => (
                <tr key={row.date} className="hover:bg-gray-50">
                  <td className="px-4 py-3 text-gray-700 whitespace-nowrap">
                    {fmtDate(row.date)}
                    {row.highNonRegular && (
                      <span
                        title="Volume non-reguler (negosiasi/block trade) signifikan pada tanggal ini — estimasi net value bisa jauh dari akurat karena dihitung pakai harga penutupan, bukan harga transaksi sebenarnya."
                        className="ml-1.5 inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-700 cursor-help"
                      >
                        ⚠
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-gray-900 whitespace-nowrap">{rp(row.close)}</td>
                  <td className="px-4 py-3 text-gray-700 whitespace-nowrap">{row.volume.toLocaleString('id-ID')}</td>
                  <td className="px-4 py-3 text-gray-700 whitespace-nowrap">{row.foreignBuy.toLocaleString('id-ID')}</td>
                  <td className="px-4 py-3 text-gray-700 whitespace-nowrap">{row.foreignSell.toLocaleString('id-ID')}</td>
                  <td className={`px-4 py-3 font-semibold whitespace-nowrap ${row.netForeignVolume >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                    {row.netForeignVolume >= 0 ? '+' : ''}{row.netForeignVolume.toLocaleString('id-ID')}
                  </td>
                  <td className={`px-4 py-3 font-semibold whitespace-nowrap ${row.estimatedNetForeignValue >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                    {row.estimatedNetForeignValue >= 0 ? '+' : ''}{rp(row.estimatedNetForeignValue)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {history.length > 0 && (
          <p className="px-4 py-3 text-xs text-gray-400 border-t border-gray-100">
            Estimasi Net Value = net volume asing × harga penutupan hari itu — <strong>perkiraan</strong>, bukan nilai transaksi asing yang presisi (harga transaksi sebenarnya bervariasi sepanjang hari).
            Tanggal dengan badge <span className="inline-flex items-center px-1 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-700">⚠</span> punya transaksi non-reguler (negosiasi) signifikan — estimasi pada baris itu <strong>kurang bisa diandalkan</strong>.
          </p>
        )}
      </div>

      <p className="text-sm text-gray-500">
        Ringkasan aktivitas broker market-wide dan transaksi asing/domestik market-wide kini ada di menu{' '}
        <Link href="/data-index" className="text-indigo-600 hover:underline font-medium">Data Index</Link>.
      </p>
    </div>
  )
}
