'use client'

import { useState, useEffect, useCallback } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter, useParams } from 'next/navigation'
import Link from 'next/link'
import { ProGate } from '@/components/ProGate'

type Metric = 'value' | 'volume' | 'frequency'

interface BrokerTopItem {
  brokerCode: string
  brokerName: string
  volume: number
  value: number
  frequency: number
  share: number
}

interface BrokerTopResult {
  date: string | null
  metric: Metric
  total: number
  data: BrokerTopItem[]
}

interface InvestorFlowSide {
  buyValue: number
  sellValue: number
  buyVolume: number
  sellVolume: number
  buyFrequency: number
  sellFrequency: number
}

interface InvestorFlowResult {
  date: string | null
  foreign: InvestorFlowSide | null
  domestic: InvestorFlowSide | null
}

interface StockForeignData {
  stockName: string | null
  close: number
  volume: number
  value: number
  foreignBuy: number
  foreignSell: number
  netForeignVolume: number
  estimatedNetForeignValue: number
}

interface StockForeignResult {
  date: string | null
  data: StockForeignData | null
}

const rp = (v: number) => `Rp ${v.toLocaleString('id-ID')}`
const fmtDate = (d: string) => new Date(d + 'T00:00:00').toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })

const METRICS: { key: Metric; label: string }[] = [
  { key: 'value', label: 'Value' },
  { key: 'volume', label: 'Volume' },
  { key: 'frequency', label: 'Frekuensi' },
]

export default function DataTransaksiDetailPage() {
  const { status } = useSession()
  const router = useRouter()
  const params = useParams()
  const kode = String(params.kode ?? '').toUpperCase()

  const [proAccess, setProAccess] = useState<{ hasAccess: boolean } | null>(null)
  const [dates, setDates] = useState<string[]>([])
  const [selectedDate, setSelectedDate] = useState('')
  const [metric, setMetric] = useState<Metric>('value')
  const [result, setResult] = useState<BrokerTopResult | null>(null)
  const [flow, setFlow] = useState<InvestorFlowResult | null>(null)
  const [loadingFlow, setLoadingFlow] = useState(false)
  const [stockForeign, setStockForeign] = useState<StockForeignResult | null>(null)
  const [loadingStockForeign, setLoadingStockForeign] = useState(false)
  const [loading, setLoading] = useState(false)
  const [bannerCollapsed, setBannerCollapsed] = useState(false)

  useEffect(() => {
    if (status === 'unauthenticated') router.push('/login')
  }, [status, router])

  useEffect(() => {
    if (status !== 'authenticated') return
    fetch('/api/subscription/status').then(r => r.json()).then(setProAccess)
  }, [status])

  useEffect(() => {
    if (status !== 'authenticated') return
    fetch('/api/brokers/dates')
      .then(r => r.ok ? r.json() : { dates: [] })
      .then(d => {
        setDates(d.dates ?? [])
        if (d.dates?.length) setSelectedDate(d.dates[0])
      })
  }, [status])

  const fetchTop = useCallback(async (date: string, m: Metric) => {
    setLoading(true)
    try {
      const res = await fetch(`/api/brokers/top?date=${date}&metric=${m}&limit=20`)
      if (res.ok) setResult(await res.json())
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (selectedDate) fetchTop(selectedDate, metric)
  }, [selectedDate, metric, fetchTop])

  const fetchFlow = useCallback(async (date: string) => {
    setLoadingFlow(true)
    try {
      const res = await fetch(`/api/investor-flow?date=${date}`)
      if (res.ok) setFlow(await res.json())
    } finally {
      setLoadingFlow(false)
    }
  }, [])

  useEffect(() => {
    if (selectedDate) fetchFlow(selectedDate)
  }, [selectedDate, fetchFlow])

  const fetchStockForeign = useCallback(async (date: string, code: string) => {
    setLoadingStockForeign(true)
    try {
      const res = await fetch(`/api/stock-foreign?kode=${code}&date=${date}`)
      if (res.ok) setStockForeign(await res.json())
    } finally {
      setLoadingStockForeign(false)
    }
  }, [])

  useEffect(() => {
    if (selectedDate && kode) fetchStockForeign(selectedDate, kode)
  }, [selectedDate, kode, fetchStockForeign])

  if (status === 'loading' || proAccess === null) return null
  if (!proAccess.hasAccess) return <ProGate />

  const metricLabel = METRICS.find(m => m.key === metric)?.label ?? ''
  const formatMetric = (v: number) => metric === 'value' ? rp(v) : v.toLocaleString('id-ID')

  return (
    <div className="p-4 sm:p-6 lg:p-8 pt-16 lg:pt-8">
      <Link href="/data-transaksi" className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700 mb-3">
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
        </svg>
        Kembali
      </Link>

      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
        <h1 className="text-xl font-bold text-gray-900">{kode}</h1>
        {dates.length > 0 && (
          <select
            value={selectedDate}
            onChange={e => setSelectedDate(e.target.value)}
            className="border border-gray-300 rounded-md px-3 py-1.5 text-sm w-fit"
          >
            {dates.map(d => <option key={d} value={d}>Data per {fmtDate(d)}</option>)}
          </select>
        )}
      </div>

      {/* Net Asing per saham ini — genuinely spesifik untuk {kode}, beda dari data market-wide di bawah */}
      <div className="mb-6 bg-white shadow sm:rounded-lg overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-100">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Net Asing pada Saham {kode}</p>
        </div>
        <div className="p-4">
          {loadingStockForeign ? (
            <p className="text-sm text-gray-400">Memuat data...</p>
          ) : !stockForeign?.data ? (
            <p className="text-sm text-gray-400">Belum ada data foreign flow untuk saham ini pada tanggal yang dipilih.</p>
          ) : (
            <>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-3">
                <div>
                  <p className="text-xs text-gray-500">Foreign Buy</p>
                  <p className="font-semibold text-gray-900">{stockForeign.data.foreignBuy.toLocaleString('id-ID')} lembar</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500">Foreign Sell</p>
                  <p className="font-semibold text-gray-900">{stockForeign.data.foreignSell.toLocaleString('id-ID')} lembar</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500">Net Volume</p>
                  <p className={`font-bold ${stockForeign.data.netForeignVolume >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                    {stockForeign.data.netForeignVolume >= 0 ? '+' : ''}{stockForeign.data.netForeignVolume.toLocaleString('id-ID')} lembar
                  </p>
                </div>
                <div>
                  <p className="text-xs text-gray-500">Estimasi Net Value</p>
                  <p className={`font-bold ${stockForeign.data.estimatedNetForeignValue >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                    {stockForeign.data.estimatedNetForeignValue >= 0 ? '+' : ''}{rp(stockForeign.data.estimatedNetForeignValue)}
                  </p>
                </div>
              </div>
              <p className="text-xs text-gray-400">
                Estimasi Net Value = net volume asing × harga penutupan (Rp {stockForeign.data.close.toLocaleString('id-ID')}) — <strong>perkiraan</strong>, bukan nilai transaksi asing yang presisi (harga transaksi sebenarnya bervariasi sepanjang hari).
              </p>
            </>
          )}
        </div>
      </div>

      {/* Disclaimer — wajib selalu ada indikator, boleh collapse (tidak bisa dismiss permanen) */}
      <div className="mb-6 bg-amber-50 border border-amber-200 rounded-lg">
        <button
          onClick={() => setBannerCollapsed(c => !c)}
          className="w-full flex items-center gap-2 px-4 py-2.5 text-left"
        >
          <span className="flex-shrink-0 w-5 h-5 rounded-full bg-amber-400 text-white text-xs font-bold flex items-center justify-center">i</span>
          <span className="text-sm font-medium text-amber-900 flex-1">
            {bannerCollapsed ? 'Dua bagian di bawah ini market-wide, bukan spesifik saham ini' : 'Tentang dua bagian di bawah ini'}
          </span>
          <svg className={`w-4 h-4 text-amber-600 transition-transform ${bannerCollapsed ? '' : 'rotate-180'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </button>
        {!bannerCollapsed && (
          <p className="px-4 pb-3 text-sm text-amber-800">
            Tabel Top Broker dan ringkasan Asing vs Domestik di bawah ini adalah aktivitas <strong>market-wide</strong>
            (seluruh saham di market) pada tanggal yang dipilih — <strong>bukan</strong> aktivitas yang spesifik pada {kode}.
            Data broker per saham (sering disebut <em>bandarmology</em>) belum tersedia di Mutiara Investasi.
            (Net asing per saham {kode} di atas berbeda — itu memang data spesifik saham ini.)
          </p>
        )}
      </div>

      {/* Transaksi Asing vs Domestik — market-wide, sama seperti tabel broker di bawah */}
      <div className="mb-6 bg-white shadow sm:rounded-lg overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-100">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Transaksi Asing (Foreign) vs Domestik</p>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 divide-y sm:divide-y-0 sm:divide-x divide-gray-100">
          {([
            ['Asing (Foreign)', flow?.foreign] as const,
            ['Domestik', flow?.domestic] as const,
          ]).map(([label, side]) => {
            const net = side ? side.buyValue - side.sellValue : 0
            return (
              <div key={label} className="p-4">
                <p className="text-sm font-bold text-gray-900 mb-3">{label}</p>
                {loadingFlow ? (
                  <p className="text-sm text-gray-400">Memuat data...</p>
                ) : !side ? (
                  <p className="text-sm text-gray-400">Belum ada data untuk tanggal ini.</p>
                ) : (
                  <div className="space-y-1.5 text-sm">
                    <div className="flex justify-between">
                      <span className="text-gray-500">Beli (Buy)</span>
                      <span className="font-semibold text-gray-900">{rp(side.buyValue)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-500">Jual (Sell)</span>
                      <span className="font-semibold text-gray-900">{rp(side.sellValue)}</span>
                    </div>
                    <div className="flex justify-between pt-1.5 border-t border-gray-100">
                      <span className="text-gray-500">Net</span>
                      <span className={`font-bold ${net >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                        {net >= 0 ? '+' : ''}{rp(net)}
                      </span>
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </div>

      <div className="bg-white shadow sm:rounded-lg overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between flex-wrap gap-2">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Top Broker by Activity</p>
          <div className="flex gap-1">
            {METRICS.map(m => (
              <button
                key={m.key}
                onClick={() => setMetric(m.key)}
                className={`px-3 py-1 rounded-md text-xs font-medium transition-colors ${
                  metric === m.key ? 'bg-indigo-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                {m.label}
              </button>
            ))}
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full text-sm divide-y divide-gray-100">
            <thead className="bg-gray-50">
              <tr>
                {['#', 'Broker', `Total ${metricLabel}`, 'Share'].map(h => (
                  <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {loading ? (
                <tr><td colSpan={4} className="px-4 py-10 text-center text-gray-400">Memuat data...</td></tr>
              ) : !result || result.data.length === 0 ? (
                <tr><td colSpan={4} className="px-4 py-10 text-center text-gray-400">Belum ada data broker untuk tanggal ini.</td></tr>
              ) : result.data.map((item, idx) => (
                <tr key={item.brokerCode} className="hover:bg-gray-50">
                  <td className="px-4 py-3 text-gray-400 text-xs">{idx + 1}</td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    <span className="font-bold text-indigo-700">{item.brokerCode}</span>
                    <span className="text-gray-500 ml-1.5">{item.brokerName}</span>
                  </td>
                  <td className="px-4 py-3 text-gray-900 whitespace-nowrap">{formatMetric(item[metric])}</td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    <div className="flex items-center gap-2">
                      <div className="flex-1 bg-gray-100 rounded-full h-1.5 max-w-20">
                        <div className="h-1.5 rounded-full bg-indigo-500" style={{ width: `${Math.min(item.share, 100)}%` }} />
                      </div>
                      <span className="font-semibold text-gray-700 text-xs">{item.share}%</span>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
