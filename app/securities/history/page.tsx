'use client'

import { useState, useEffect, useCallback, Suspense } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from 'recharts'
import { ProGate } from '@/components/ProGate'

interface JournalRow {
  id: string
  journalDate: string
  detail: string
}

interface JournalDetail {
  keterangan: string
  saham: string
  hargaRata: number
  lot: number
  modal: number
  hargaTerakhir: number | null
  nilaiPasar: number | null
  floatRp: number | null
  floatPct: number | null
}

function parseStocks(detailStr: string): JournalDetail[] {
  try {
    const p = JSON.parse(detailStr)
    if (Array.isArray(p)) return p as JournalDetail[]
    return p.stocks ?? []
  } catch {
    return []
  }
}

interface AccountSnapshot {
  date: string
  jumlahSaham: number
  modal: number
  nilaiPasar: number
  floatRp: number
  floatPct: number
}

type Period = '1' | '3' | '5' | 'all'
const PERIOD_YEARS: Record<Exclude<Period, 'all'>, number> = { '1': 1, '3': 3, '5': 5 }

const rp = (v: number) => `Rp ${Math.round(v).toLocaleString('id-ID')}`
const pct = (v: number) => `${v >= 0 ? '+' : ''}${v.toFixed(2)}%`
const fmtDate = (d: string) => new Date(d + 'T00:00:00').toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })
const glC = (v: number) => v > 0 ? 'text-green-600' : v < 0 ? 'text-red-600' : 'text-gray-500'
const glBadge = (v: number) => v > 0 ? 'bg-green-100 text-green-700' : v < 0 ? 'bg-red-100 text-red-700' : 'bg-gray-100 text-gray-500'
const glLabel = (v: number) => v > 0 ? 'GAIN' : v < 0 ? 'LOSS' : 'FLAT'

function SecurityHistoryContent() {
  const { status } = useSession()
  const router = useRouter()
  const searchParams = useSearchParams()

  const nama = searchParams.get('nama') ?? ''
  const kode = searchParams.get('kode') ?? ''

  const [proAccess, setProAccess] = useState<{ hasAccess: boolean } | null>(null)
  const [journals, setJournals] = useState<JournalRow[]>([])
  const [loading, setLoading] = useState(false)
  const [period, setPeriod] = useState<Period>('1') // default YTD (tahun berjalan)
  const [page, setPage] = useState(1)
  const PAGE_SIZE = 10

  useEffect(() => { setPage(1) }, [period])

  useEffect(() => {
    if (status === 'unauthenticated') router.push('/login')
  }, [status, router])

  useEffect(() => {
    if (status !== 'authenticated') return
    fetch('/api/subscription/status').then(r => r.json()).then(setProAccess)
  }, [status])

  const fetchJournals = useCallback(async () => {
    setLoading(true)
    try {
      const currentYear = new Date().getFullYear()
      const years = Array.from({ length: 5 }, (_, i) => currentYear - i)
      const results = await Promise.all(
        years.map(y => fetch(`/api/portfolio/journal?year=${y}`).then(r => r.ok ? r.json() : []))
      )
      const merged: JournalRow[] = results.flat()
      merged.sort((a, b) => a.journalDate.localeCompare(b.journalDate))
      setJournals(merged)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (status === 'authenticated' && nama) fetchJournals()
  }, [status, nama, fetchJournals])

  if (status === 'loading' || proAccess === null) return null
  if (!proAccess.hasAccess) return <ProGate />

  if (!nama) {
    return (
      <div className="p-4 sm:p-6 lg:p-8 pt-16 lg:pt-8">
        <div className="bg-white rounded-lg shadow p-12 text-center text-gray-400">
          Parameter sekuritas tidak ditemukan.{' '}
          <Link href="/securities" className="text-indigo-600 hover:underline">Kembali ke Daftar Sekuritas</Link>
        </div>
      </div>
    )
  }

  const namaNormalized = nama.toUpperCase().trim()
  const currentYear = new Date().getFullYear()

  const journalsFiltered = period === 'all'
    ? journals
    : journals.filter(j => parseInt(j.journalDate.slice(0, 4)) > currentYear - PERIOD_YEARS[period])

  const snapshots: AccountSnapshot[] = journalsFiltered
    .map(j => {
      const stocks = parseStocks(j.detail).filter(s => s.keterangan === namaNormalized)
      if (stocks.length === 0) return null
      const modal = stocks.reduce((s, d) => s + Number(d.modal ?? 0), 0)
      const nilaiPasar = stocks.reduce((s, d) => s + Number(d.nilaiPasar ?? d.modal ?? 0), 0)
      const floatRp = nilaiPasar - modal
      const floatPct = modal > 0 ? (floatRp / modal) * 100 : 0
      return { date: j.journalDate, jumlahSaham: stocks.length, modal, nilaiPasar, floatRp, floatPct }
    })
    .filter((s): s is AccountSnapshot => s !== null)

  const first = snapshots[0]
  const last = snapshots[snapshots.length - 1]
  const growthRp = first && last ? last.nilaiPasar - first.nilaiPasar : null
  const growthPct = first && last && first.nilaiPasar > 0 ? (growthRp! / first.nilaiPasar) * 100 : null

  const chartData = snapshots.map(s => ({
    date: s.date.slice(5),
    modal: Math.round(s.modal / 1000),
    nilaiPasar: Math.round(s.nilaiPasar / 1000),
  }))

  const snapshotsDesc = [...snapshots].reverse()
  const totalPages = Math.ceil(snapshotsDesc.length / PAGE_SIZE)
  const pagedSnapshots = snapshotsDesc.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)

  return (
    <div className="p-4 sm:p-6 lg:p-8 pt-16 lg:pt-8">
      <Link href="/securities" className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700 mb-3">
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
        </svg>
        Kembali ke Daftar Sekuritas
      </Link>

      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-1">
        <div>
          <h1 className="text-xl font-bold text-gray-900">{nama}</h1>
          {kode && <p className="text-xs text-gray-500 mt-0.5">Kode: {kode}</p>}
        </div>
        <div className="flex gap-1">
          {([['1', 'YTD'], ['3', '3 Tahun'], ['5', '5 Tahun'], ['all', 'All Time']] as const).map(([key, label]) => (
            <button
              key={key}
              onClick={() => setPeriod(key)}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap ${
                period === key ? 'bg-indigo-600 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>
      <p className="text-sm text-gray-500 mb-6">
        Riwayat performa (naik/turun) akun sekuritas ini berdasarkan snapshot data Jurnal di tab Portofolio.
      </p>

      {loading ? (
        <div className="bg-white rounded-lg shadow p-16 text-center text-gray-400">Memuat data jurnal...</div>
      ) : snapshots.length === 0 ? (
        <div className="bg-white rounded-lg shadow p-16 text-center text-gray-400">
          Belum ada data jurnal untuk akun sekuritas ini pada periode yang dipilih.<br />
          <span className="text-sm">Buat jurnal di tab Portofolio → Jurnal terlebih dahulu.</span>
        </div>
      ) : (
        <>
          {/* Summary cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
            <div className="bg-white rounded-lg shadow p-3">
              <p className="text-xs text-gray-500 mb-1">Snapshot Terakhir</p>
              <p className="text-sm font-bold text-gray-900">{fmtDate(last.date)}</p>
            </div>
            <div className="bg-white rounded-lg shadow p-3">
              <p className="text-xs text-gray-500 mb-1">Nilai Pasar Terakhir</p>
              <p className="text-base font-bold text-gray-900">{rp(last.nilaiPasar)}</p>
            </div>
            <div className="bg-white rounded-lg shadow p-3">
              <p className="text-xs text-gray-500 mb-1">Floating G/L Terakhir</p>
              <p className={`text-base font-bold ${glC(last.floatRp)}`}>{rp(last.floatRp)}</p>
              <p className={`text-xs font-semibold ${glC(last.floatPct)}`}>{pct(last.floatPct)}</p>
            </div>
            <div className="bg-white rounded-lg shadow p-3">
              <p className="text-xs text-gray-500 mb-1">Pertumbuhan Periode Ini</p>
              <p className={`text-base font-bold ${glC(growthRp ?? 0)}`}>{growthRp != null ? rp(growthRp) : '—'}</p>
              <p className={`text-xs font-semibold ${glC(growthPct ?? 0)}`}>{growthPct != null ? pct(growthPct) : '—'}</p>
            </div>
          </div>

          {/* Chart tren modal vs nilai pasar */}
          <div className="bg-white rounded-lg shadow p-4 mb-6">
            <p className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-3">Tren Modal vs Nilai Pasar</p>
            <div style={{ height: 260 }}>
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={chartData} margin={{ top: 5, right: 10, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis dataKey="date" tick={{ fontSize: 10 }} />
                  <YAxis tick={{ fontSize: 10 }} tickFormatter={v => `${v}rb`} width={60} />
                  <Tooltip formatter={(v: number, name: string) => [`Rp ${(v * 1000).toLocaleString('id-ID')}`, name === 'modal' ? 'Modal' : 'Nilai Pasar']} />
                  <Legend verticalAlign="top" height={30} formatter={v => v === 'modal' ? 'Modal' : 'Nilai Pasar'} />
                  <Line type="monotone" dataKey="modal" stroke="#9CA3AF" strokeWidth={2} dot={false} />
                  <Line type="monotone" dataKey="nilaiPasar" stroke={last.floatRp >= 0 ? '#16a34a' : '#dc2626'} strokeWidth={2} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Tabel riwayat */}
          <div className="bg-white shadow sm:rounded-lg overflow-hidden">
            <div className="px-4 py-3 border-b border-gray-100">
              <p className="text-xs font-bold text-gray-500 uppercase tracking-wider">Riwayat Snapshot Jurnal</p>
            </div>
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm divide-y divide-gray-100">
                <thead className="bg-gray-50">
                  <tr>
                    {['Tanggal', 'Jml Saham', 'Modal', 'Nilai Pasar', 'G/L (Rp)', 'G/L (%)', 'Status'].map(h => (
                      <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider whitespace-nowrap">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {pagedSnapshots.map(s => (
                    <tr key={s.date} className="hover:bg-gray-50">
                      <td className="px-4 py-3 text-gray-900 whitespace-nowrap">{fmtDate(s.date)}</td>
                      <td className="px-4 py-3 text-gray-600 text-center">{s.jumlahSaham}</td>
                      <td className="px-4 py-3 text-gray-900 whitespace-nowrap">{rp(s.modal)}</td>
                      <td className="px-4 py-3 text-gray-900 whitespace-nowrap">{rp(s.nilaiPasar)}</td>
                      <td className={`px-4 py-3 font-semibold whitespace-nowrap ${glC(s.floatRp)}`}>{rp(s.floatRp)}</td>
                      <td className={`px-4 py-3 font-semibold whitespace-nowrap ${glC(s.floatPct)}`}>{pct(s.floatPct)}</td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <span className={`px-2 py-0.5 rounded text-xs font-bold ${glBadge(s.floatPct)}`}>{glLabel(s.floatPct)}</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="bg-white px-4 py-3 flex items-center justify-between border-t border-gray-200">
                <div className="text-sm text-gray-700">
                  Menampilkan{' '}
                  <span className="font-medium">{(page - 1) * PAGE_SIZE + 1}</span>
                  {' '}–{' '}
                  <span className="font-medium">{Math.min(page * PAGE_SIZE, snapshotsDesc.length)}</span>
                  {' '}dari{' '}
                  <span className="font-medium">{snapshotsDesc.length}</span> snapshot
                </div>
                <div className="flex gap-1">
                  <button onClick={() => setPage(1)} disabled={page === 1}
                    className="px-2 py-1 text-sm border rounded disabled:opacity-40 hover:bg-gray-50">«</button>
                  <button onClick={() => setPage(p => p - 1)} disabled={page === 1}
                    className="px-3 py-1 text-sm border rounded disabled:opacity-40 hover:bg-gray-50">Prev</button>
                  {Array.from({ length: totalPages }, (_, i) => i + 1)
                    .filter(p => Math.abs(p - page) <= 2)
                    .map(p => (
                      <button key={p} onClick={() => setPage(p)}
                        className={`px-3 py-1 text-sm border rounded ${p === page ? 'bg-indigo-600 text-white border-indigo-600' : 'hover:bg-gray-50'}`}>
                        {p}
                      </button>
                    ))}
                  <button onClick={() => setPage(p => p + 1)} disabled={page === totalPages}
                    className="px-3 py-1 text-sm border rounded disabled:opacity-40 hover:bg-gray-50">Next</button>
                  <button onClick={() => setPage(totalPages)} disabled={page === totalPages}
                    className="px-2 py-1 text-sm border rounded disabled:opacity-40 hover:bg-gray-50">»</button>
                </div>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  )
}

export default function SecurityHistoryPage() {
  return (
    <Suspense fallback={null}>
      <SecurityHistoryContent />
    </Suspense>
  )
}
