'use client'

import { useState, useEffect, useCallback } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
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
  requestedDate?: string | null
  foreign: InvestorFlowSide | null
  domestic: InvestorFlowSide | null
}

interface TopForeignBuyItem {
  stockCode: string
  stockName: string
  close: number
  value: number
  volume: number
  frequency: number
  foreignBuy: number
  foreignSell: number
  netForeignVolume: number
  estimatedNetForeignValue: number
  highNonRegular: boolean
}

interface TopForeignBuyResult {
  date: string | null
  data: TopForeignBuyItem[]
}

const rp = (v: number) => `Rp ${v.toLocaleString('id-ID')}`
const fmtDate = (d: string) => new Date(d + 'T00:00:00').toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })

/** Format ringkas ala Stockbit: 1.25T / 120.96B / 694.49K */
function fmtCompact(v: number): string {
  const sign = v < 0 ? '-' : ''
  const abs = Math.abs(v)
  if (abs >= 1e12) return `${sign}${(abs / 1e12).toFixed(2)}T`
  if (abs >= 1e9) return `${sign}${(abs / 1e9).toFixed(2)}B`
  if (abs >= 1e6) return `${sign}${(abs / 1e6).toFixed(2)}M`
  if (abs >= 1e3) return `${sign}${(abs / 1e3).toFixed(2)}K`
  return `${sign}${abs.toLocaleString('id-ID')}`
}
const rpCompact = (v: number) => `Rp ${fmtCompact(v)}`

const METRICS: { key: Metric; label: string }[] = [
  { key: 'value', label: 'Value' },
  { key: 'volume', label: 'Volume' },
  { key: 'frequency', label: 'Frekuensi' },
]

export default function DataIndexPage() {
  const { status } = useSession()
  const router = useRouter()

  const [proAccess, setProAccess] = useState<{ hasAccess: boolean } | null>(null)
  const [dates, setDates] = useState<string[]>([])
  const [selectedDate, setSelectedDate] = useState('')
  const [rankingTab, setRankingTab] = useState<'broker' | 'foreign-buy'>('broker')
  const [metric, setMetric] = useState<Metric>('value')
  const [result, setResult] = useState<BrokerTopResult | null>(null)
  const [loading, setLoading] = useState(false)
  const [flow, setFlow] = useState<InvestorFlowResult | null>(null)
  const [loadingFlow, setLoadingFlow] = useState(false)
  const [topForeignBuy, setTopForeignBuy] = useState<TopForeignBuyResult | null>(null)
  const [loadingTopForeignBuy, setLoadingTopForeignBuy] = useState(false)
  const [refreshing, setRefreshing] = useState(false)
  const [refreshMsg, setRefreshMsg] = useState<{ ok: boolean; text: string } | null>(null)

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

  const fetchTopForeignBuy = useCallback(async (date: string) => {
    setLoadingTopForeignBuy(true)
    try {
      const res = await fetch(`/api/stock-foreign/top-buy?date=${date}&limit=10`)
      if (res.ok) setTopForeignBuy(await res.json())
    } finally {
      setLoadingTopForeignBuy(false)
    }
  }, [])

  useEffect(() => {
    if (selectedDate) fetchTopForeignBuy(selectedDate)
  }, [selectedDate, fetchTopForeignBuy])

  const handleRefresh = useCallback(async () => {
    setRefreshing(true)
    setRefreshMsg(null)
    try {
      const res = await fetch('/api/data-transaksi/refresh', { method: 'POST' })
      const body = await res.json()
      if (!res.ok) {
        setRefreshMsg({ ok: false, text: body.error ?? 'Gagal memperbarui data.' })
        return
      }
      const { broker, foreign, domestic, stock } = body.results
      const failed = Object.entries(body.results).filter(([, r]: any) => !r.success)
      setRefreshMsg({
        ok: failed.length === 0,
        text: failed.length === 0
          ? `Berhasil — broker ${broker.count}, saham ${stock.count}, asing ${foreign.count}, domestik ${domestic.count} baris.`
          : `Sebagian gagal: ${failed.map(([name]) => name).join(', ')}.`,
      })
      const datesRes = await fetch('/api/brokers/dates')
      if (datesRes.ok) {
        const d = await datesRes.json()
        setDates(d.dates ?? [])
        if (d.dates?.length) setSelectedDate(d.dates[0])
      }
    } catch {
      setRefreshMsg({ ok: false, text: 'Gagal memperbarui data — coba lagi.' })
    } finally {
      setRefreshing(false)
    }
  }, [])

  if (status === 'loading' || proAccess === null) return null
  if (!proAccess.hasAccess) return <ProGate />

  const metricLabel = METRICS.find(m => m.key === metric)?.label ?? ''
  const formatMetric = (v: number) => metric === 'value' ? rp(v) : v.toLocaleString('id-ID')

  return (
    <div className="p-4 sm:p-6 lg:p-8 pt-16 lg:pt-8">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-2">
        <div className="flex items-center gap-2">
          <h1 className="text-xl font-bold text-gray-900">Data Index</h1>
          <span className="px-1.5 py-0.5 rounded text-xs font-bold bg-indigo-100 text-indigo-700">PRO</span>
        </div>
        <div className="flex items-center gap-2">
          {dates.length > 0 && (
            <select
              value={selectedDate}
              onChange={e => setSelectedDate(e.target.value)}
              className="border border-gray-300 rounded-md px-3 py-1.5 text-sm w-fit"
            >
              {dates.map(d => <option key={d} value={d}>Data per {fmtDate(d)}</option>)}
            </select>
          )}
          <button
            onClick={handleRefresh}
            disabled={refreshing}
            className="inline-flex items-center gap-1.5 border border-gray-300 rounded-md px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <svg className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            {refreshing ? 'Memperbarui...' : 'Perbarui Data'}
          </button>
        </div>
      </div>
      <p className="text-sm text-gray-500 mb-4">
        Ringkasan aktivitas broker dan transaksi asing/domestik <strong>market-wide</strong> (seluruh saham di market) per tanggal.
      </p>

      {refreshMsg && (
        <p className={`text-xs mb-4 ${refreshMsg.ok ? 'text-green-600' : 'text-red-600'}`}>{refreshMsg.text}</p>
      )}

      <div className="mb-6 bg-amber-50 border border-amber-200 rounded-lg px-4 py-3">
        <p className="text-sm text-amber-800">
          <strong>ⓘ</strong> Data di halaman ini bersifat market-wide, <strong>bukan</strong> spesifik per saham.
          Data broker per saham (sering disebut <em>bandarmology</em>) belum tersedia di Mutiara Investasi —
          lihat halaman <strong>Data Transaksi</strong> untuk data net asing yang memang spesifik per saham di portofolio kamu.
        </p>
      </div>

      {/* Transaksi Asing vs Domestik */}
      <div className="mb-6 bg-white shadow sm:rounded-lg overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-100">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Transaksi Asing (Foreign) vs Domestik</p>
          {flow?.date && flow.requestedDate && flow.date !== flow.requestedDate && (
            <p className="text-xs text-amber-600 mt-1">
              Data bulan untuk {fmtDate(flow.requestedDate)} belum dipublikasikan IDX — menampilkan data terakhir yang tersedia: <strong>{fmtDate(flow.date)}</strong>.
            </p>
          )}
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

      {/* Top Broker by Activity / Top Foreign Buy */}
      <div className="bg-white shadow sm:rounded-lg overflow-hidden">
        <div className="px-4 pt-3 border-b border-gray-100 flex items-center justify-between flex-wrap gap-2">
          <div className="flex gap-4">
            {([
              ['broker', 'Top Broker Activity'],
              ['foreign-buy', 'Top Foreign Buy'],
            ] as const).map(([key, label]) => (
              <button
                key={key}
                onClick={() => setRankingTab(key)}
                className={`pb-2.5 text-xs font-semibold uppercase tracking-wider border-b-2 transition-colors ${
                  rankingTab === key ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-gray-400 hover:text-gray-600'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
          {rankingTab === 'broker' && (
            <div className="flex gap-1 pb-2">
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
          )}
        </div>

        {rankingTab === 'broker' ? (
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
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm divide-y divide-gray-100">
              <thead className="bg-gray-50">
                <tr>
                  {['#', 'Saham', 'Net Foreign Buy', 'Value', 'Volume', 'Freq', 'Price'].map(h => (
                    <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {loadingTopForeignBuy ? (
                  <tr><td colSpan={7} className="px-4 py-10 text-center text-gray-400">Memuat data...</td></tr>
                ) : !topForeignBuy || topForeignBuy.data.length === 0 ? (
                  <tr><td colSpan={7} className="px-4 py-10 text-center text-gray-400">Belum ada net foreign buy untuk tanggal ini.</td></tr>
                ) : topForeignBuy.data.map((item, idx) => (
                  <tr key={item.stockCode} className="hover:bg-gray-50">
                    <td className="px-4 py-3 text-gray-400 text-xs">{idx + 1}</td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <span className="font-bold text-indigo-700">{item.stockCode}</span>
                      <span className="text-gray-500 ml-1.5">{item.stockName}</span>
                      {item.highNonRegular && (
                        <span
                          title="Volume non-reguler (negosiasi/block trade) signifikan pada saham ini — estimasi net value bisa jauh dari akurat karena dihitung pakai harga penutupan, bukan harga transaksi sebenarnya."
                          className="ml-1.5 inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-700 cursor-help"
                        >
                          ⚠ block trade
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 font-semibold text-green-600 whitespace-nowrap">
                      {rpCompact(item.estimatedNetForeignValue)}
                    </td>
                    <td className="px-4 py-3 text-gray-700 whitespace-nowrap">{rpCompact(item.value)}</td>
                    <td className="px-4 py-3 text-gray-700 whitespace-nowrap">{fmtCompact(item.volume)}</td>
                    <td className="px-4 py-3 text-gray-700 whitespace-nowrap">{fmtCompact(item.frequency)}</td>
                    <td className="px-4 py-3 text-gray-900 whitespace-nowrap">{rp(item.close)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {rankingTab === 'foreign-buy' && topForeignBuy && topForeignBuy.data.length > 0 && (
          <p className="px-4 py-3 text-xs text-gray-400 border-t border-gray-100">
            Diranking berdasarkan estimasi nilai net beli asing terbesar (net volume asing × harga penutupan) — <strong>perkiraan</strong>, bukan nilai transaksi presisi. Hanya menampilkan saham net buy (Foreign Buy &gt; Foreign Sell).
            Badge <span className="inline-flex items-center px-1 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-700">⚠ block trade</span> menandai saham dengan transaksi non-reguler (negosiasi) signifikan — untuk saham ini estimasi di atas <strong>kurang bisa diandalkan</strong> karena sebagian volume ditransaksikan di luar harga pasar reguler.
          </p>
        )}
      </div>
    </div>
  )
}
