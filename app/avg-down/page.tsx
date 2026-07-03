'use client'

import { useState, useEffect, useMemo, useCallback } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { ProGate } from '@/components/ProGate'
import {
  calculateAvgDownPlan, TIMEFRAME_PRESETS,
  STAGES_MIN, STAGES_MAX, INTERVAL_PCT_MIN, INTERVAL_PCT_MAX,
  type Timeframe, type AllocationMethod,
} from '@/lib/avgDown'

interface ForeignContextRow {
  date: string
  netForeignVolume: number
  estimatedNetForeignValue: number
  highNonRegular: boolean
}

const rp = (v: number) => `Rp ${Math.round(v).toLocaleString('id-ID')}`
const pct = (v: number) => `${v >= 0 ? '+' : ''}${v.toFixed(2)}%`
const fmtDate = (d: string) => new Date(d + 'T00:00:00').toLocaleDateString('id-ID', { day: 'numeric', month: 'short' })

const TIMEFRAMES: { key: Timeframe; label: string }[] = [
  { key: 'short', label: 'Pendek' },
  { key: 'medium', label: 'Menengah' },
  { key: 'long', label: 'Panjang' },
]

export default function AvgDownPage() {
  const { status } = useSession()
  const router = useRouter()

  const [proAccess, setProAccess] = useState<{ hasAccess: boolean } | null>(null)
  const [bannerCollapsed, setBannerCollapsed] = useState(false)

  const [kode, setKode] = useState('')
  const [currentPrice, setCurrentPrice] = useState<number>(0)
  const [capital, setCapital] = useState<number>(0)
  const [timeframe, setTimeframe] = useState<Timeframe>('medium')
  const [allocationMethod, setAllocationMethod] = useState<AllocationMethod>('pyramid')
  const [initialAvgPrice, setInitialAvgPrice] = useState<number>(0)
  const [initialLot, setInitialLot] = useState<number>(0)

  const [manualOverride, setManualOverride] = useState(false)
  const [stages, setStages] = useState<number>(TIMEFRAME_PRESETS.medium.stages)
  const [intervalPct, setIntervalPct] = useState<number>(TIMEFRAME_PRESETS.medium.intervalPct)

  const [loadingPrefill, setLoadingPrefill] = useState(false)
  const [prefillMsg, setPrefillMsg] = useState('')
  const [foreignContext, setForeignContext] = useState<ForeignContextRow[]>([])

  useEffect(() => {
    if (status === 'unauthenticated') router.push('/login')
  }, [status, router])

  useEffect(() => {
    if (status !== 'authenticated') return
    fetch('/api/subscription/status').then(r => r.json()).then(setProAccess)
  }, [status])

  // Ganti jangka waktu -> reset override ke preset (F12)
  useEffect(() => {
    const preset = TIMEFRAME_PRESETS[timeframe]
    setStages(preset.stages)
    setIntervalPct(preset.intervalPct)
  }, [timeframe])

  const handlePrefill = useCallback(async () => {
    if (!kode.trim()) return
    setLoadingPrefill(true)
    setPrefillMsg('')
    try {
      const res = await fetch(`/api/avg-down/prefill?kode=${kode.trim().toUpperCase()}`)
      const body = await res.json()
      if (!res.ok) {
        setPrefillMsg(body.error ?? 'Gagal mengambil data.')
        return
      }
      if (body.currentPrice != null) setCurrentPrice(body.currentPrice)
      if (body.initialAvgPrice != null) setInitialAvgPrice(body.initialAvgPrice)
      if (body.initialLot) setInitialLot(body.initialLot)
      setForeignContext(body.foreignContext ?? [])
      setPrefillMsg(
        body.currentPrice != null
          ? `Harga terkini berhasil diambil.${body.initialLot > 0 ? ` Posisi awal terdeteksi: ${body.initialLot} lot @ ${rp(body.initialAvgPrice)}.` : ''}`
          : 'Harga tidak ditemukan — isi manual.',
      )
    } catch {
      setPrefillMsg('Gagal mengambil data — coba lagi atau isi manual.')
    } finally {
      setLoadingPrefill(false)
    }
  }, [kode])

  const plan = useMemo(() => {
    if (currentPrice <= 0 || capital <= 0) return null
    return calculateAvgDownPlan({
      currentPrice,
      capital,
      timeframe,
      stages: manualOverride ? stages : undefined,
      intervalPct: manualOverride ? intervalPct : undefined,
      allocationMethod,
      initialAvgPrice: initialLot > 0 ? initialAvgPrice : undefined,
      initialLot,
    })
  }, [currentPrice, capital, timeframe, manualOverride, stages, intervalPct, allocationMethod, initialAvgPrice, initialLot])

  if (status === 'loading' || proAccess === null) return null
  if (!proAccess.hasAccess) return <ProGate />

  return (
    <div className="p-4 sm:p-6 lg:p-8 pt-16 lg:pt-8">
      <div className="flex items-center gap-2 mb-1">
        <h1 className="text-xl font-bold text-gray-900">Strategi Average Down</h1>
        <span className="px-1.5 py-0.5 rounded text-xs font-bold bg-indigo-100 text-indigo-700">PRO</span>
      </div>
      <p className="text-sm text-gray-500 mb-4">
        Susun rencana average down bertahap sebelum harga bergerak — level harga, alokasi modal, dan proyeksi harga rata-rata baru.
      </p>

      {/* Disclaimer permanen — F8 */}
      <div className="mb-6 bg-amber-50 border border-amber-200 rounded-lg">
        <button
          onClick={() => setBannerCollapsed(c => !c)}
          className="w-full flex items-center gap-2 px-4 py-2.5 text-left"
        >
          <span className="flex-shrink-0 w-5 h-5 rounded-full bg-amber-400 text-white text-xs font-bold flex items-center justify-center">i</span>
          <span className="text-sm font-medium text-amber-900 flex-1">
            {bannerCollapsed ? 'Ini alat bantu hitung, bukan rekomendasi beli' : 'Tentang halaman ini'}
          </span>
          <svg className={`w-4 h-4 text-amber-600 transition-transform ${bannerCollapsed ? '' : 'rotate-180'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </button>
        {!bannerCollapsed && (
          <p className="px-4 pb-3 text-sm text-amber-800">
            Halaman ini adalah <strong>kalkulator/perencana mekanis</strong> — menghitung level harga, alokasi modal, dan
            harga rata-rata hasil berdasarkan angka yang kamu masukkan. Halaman ini <strong>tidak</strong> memprediksi arah
            harga dan <strong>tidak</strong> menilai apakah saham tertentu layak di-average down. Average down menambah
            eksposur pada saham yang sedang turun — untuk saham dengan fundamental memburuk, ini bisa memperbesar kerugian.
            Perhitungan mengabaikan fee broker/pajak transaksi.
          </p>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Form */}
        <div className="lg:col-span-1">
          <div className="bg-white shadow sm:rounded-lg overflow-hidden sticky top-8">
            <div className="px-4 py-3 border-b border-gray-100">
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Input Rencana</p>
            </div>
            <div className="p-4 space-y-4">
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Kode Saham</label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={kode}
                    onChange={e => setKode(e.target.value.toUpperCase())}
                    placeholder="mis. BBCA"
                    className="flex-1 border border-gray-300 rounded-md px-3 py-2 text-sm focus:ring-indigo-500 focus:border-indigo-500"
                  />
                  <button
                    onClick={handlePrefill}
                    disabled={loadingPrefill || !kode.trim()}
                    className="px-3 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap"
                  >
                    {loadingPrefill ? 'Memuat...' : 'Ambil Data'}
                  </button>
                </div>
                {prefillMsg && <p className="text-xs text-gray-500 mt-1">{prefillMsg}</p>}
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Harga Saat Ini (Rp)</label>
                <input
                  type="number"
                  value={currentPrice || ''}
                  onChange={e => setCurrentPrice(parseFloat(e.target.value) || 0)}
                  placeholder="mis. 6300"
                  min="0"
                  className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:ring-indigo-500 focus:border-indigo-500"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Jumlah Modal Average Down (Rp)</label>
                <input
                  type="number"
                  value={capital || ''}
                  onChange={e => setCapital(parseFloat(e.target.value) || 0)}
                  placeholder="mis. 10000000"
                  min="0"
                  className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:ring-indigo-500 focus:border-indigo-500"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Jangka Waktu</label>
                <div className="flex gap-1">
                  {TIMEFRAMES.map(tf => (
                    <button
                      key={tf.key}
                      onClick={() => setTimeframe(tf.key)}
                      className={`flex-1 py-2 px-2 text-xs font-medium rounded-md transition-colors ${
                        timeframe === tf.key ? 'bg-indigo-600 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                      }`}
                    >
                      {tf.label}
                    </button>
                  ))}
                </div>
                <p className="text-xs text-gray-400 mt-1">{TIMEFRAME_PRESETS[timeframe].label}</p>
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Metode Alokasi Modal</label>
                <div className="flex gap-1">
                  {([['pyramid', 'Piramida'], ['equal', 'Rata']] as const).map(([key, label]) => (
                    <button
                      key={key}
                      onClick={() => setAllocationMethod(key)}
                      className={`flex-1 py-2 px-2 text-xs font-medium rounded-md transition-colors ${
                        allocationMethod === key ? 'bg-indigo-600 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                      }`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Mode lanjutan — override manual (F12) */}
              <div className="pt-2 border-t border-gray-100">
                <label className="flex items-center gap-2 text-xs font-medium text-gray-700 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={manualOverride}
                    onChange={e => setManualOverride(e.target.checked)}
                    className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                  />
                  Atur manual (jumlah tahap & interval)
                </label>
                {manualOverride && (
                  <div className="grid grid-cols-2 gap-2 mt-2">
                    <div>
                      <label className="block text-xs text-gray-500 mb-1">Jumlah Tahap</label>
                      <input
                        type="number"
                        value={stages}
                        onChange={e => setStages(parseInt(e.target.value) || STAGES_MIN)}
                        min={STAGES_MIN}
                        max={STAGES_MAX}
                        className="w-full border border-gray-300 rounded-md px-2 py-1.5 text-sm focus:ring-indigo-500 focus:border-indigo-500"
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-gray-500 mb-1">Interval Turun (%)</label>
                      <input
                        type="number"
                        value={intervalPct}
                        onChange={e => setIntervalPct(parseFloat(e.target.value) || INTERVAL_PCT_MIN)}
                        min={INTERVAL_PCT_MIN}
                        max={INTERVAL_PCT_MAX}
                        className="w-full border border-gray-300 rounded-md px-2 py-1.5 text-sm focus:ring-indigo-500 focus:border-indigo-500"
                      />
                    </div>
                  </div>
                )}
              </div>

              {/* Posisi awal opsional */}
              <div className="pt-2 border-t border-gray-100">
                <p className="text-xs font-medium text-gray-700 mb-2">Posisi Awal (opsional)</p>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">Harga Rata-rata</label>
                    <input
                      type="number"
                      value={initialAvgPrice || ''}
                      onChange={e => setInitialAvgPrice(parseFloat(e.target.value) || 0)}
                      min="0"
                      className="w-full border border-gray-300 rounded-md px-2 py-1.5 text-sm focus:ring-indigo-500 focus:border-indigo-500"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">Lot</label>
                    <input
                      type="number"
                      value={initialLot || ''}
                      onChange={e => setInitialLot(parseInt(e.target.value) || 0)}
                      min="0"
                      className="w-full border border-gray-300 rounded-md px-2 py-1.5 text-sm focus:ring-indigo-500 focus:border-indigo-500"
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Hasil */}
        <div className="lg:col-span-2 space-y-6">
          {!plan ? (
            <div className="bg-white rounded-lg shadow p-16 text-center text-gray-400">
              Isi harga saat ini dan jumlah modal untuk melihat rencana average down.
            </div>
          ) : (
            <>
              {/* Ringkasan */}
              <div className="bg-white shadow sm:rounded-lg overflow-hidden">
                <div className="px-4 py-3 border-b border-gray-100">
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Ringkasan Jika Semua Tahap Tereksekusi</p>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 p-4">
                  <div>
                    <p className="text-xs text-gray-500">Total Lot Akhir</p>
                    <p className="text-lg font-bold text-gray-900">{plan.totalLots.toLocaleString('id-ID')}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500">Modal Terpakai</p>
                    <p className="text-lg font-bold text-gray-900">{rp(plan.totalCapitalUsed)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500">Harga Rata-rata Akhir</p>
                    <p className="text-lg font-bold text-indigo-600">{rp(plan.finalAvgPrice)}</p>
                    {plan.initialAvgPrice != null && (
                      <p className="text-xs text-gray-400">dari {rp(plan.initialAvgPrice)}</p>
                    )}
                  </div>
                  <div>
                    <p className="text-xs text-gray-500">Modal Tidak Terpakai</p>
                    <p className="text-lg font-bold text-gray-900">{rp(plan.unallocatedCapital)}</p>
                  </div>
                </div>
                <p className="px-4 pb-3 text-xs text-gray-400">
                  {plan.stagesUsed} tahap, interval -{plan.intervalPctUsed}% per tahap, metode {plan.allocationMethod === 'pyramid' ? 'piramida' : 'rata'}.
                  Modal tidak terpakai berasal dari pembulatan ke kelipatan 1 lot (100 lembar).
                </p>
              </div>

              {/* Tabel rencana per tahap */}
              <div className="bg-white shadow sm:rounded-lg overflow-hidden">
                <div className="px-4 py-3 border-b border-gray-100">
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Rencana per Tahap</p>
                </div>
                <div className="overflow-x-auto">
                  <table className="min-w-full text-sm divide-y divide-gray-100">
                    <thead className="bg-gray-50">
                      <tr>
                        {['Tahap', 'Level Harga', 'Turun dari Awal', 'Lot Dibeli', 'Modal Terpakai', 'Avg Baru', 'Penurunan Avg', 'Jarak Break-even'].map(h => (
                          <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider whitespace-nowrap">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {plan.stages.map(s => (
                        <tr key={s.stage} className="hover:bg-gray-50">
                          <td className="px-4 py-3 text-gray-900 font-semibold whitespace-nowrap">#{s.stage}</td>
                          <td className="px-4 py-3 text-gray-900 whitespace-nowrap">{rp(s.levelPrice)}</td>
                          <td className="px-4 py-3 text-red-600 whitespace-nowrap">-{s.dropFromCurrentPct.toFixed(2)}%</td>
                          <td className="px-4 py-3 text-gray-700 whitespace-nowrap">{s.lots.toLocaleString('id-ID')}</td>
                          <td className="px-4 py-3 text-gray-700 whitespace-nowrap">{rp(s.capitalUsed)}</td>
                          <td className="px-4 py-3 text-indigo-700 font-semibold whitespace-nowrap">{rp(s.avgPriceAfter)}</td>
                          <td className="px-4 py-3 text-green-600 whitespace-nowrap">-{s.avgDropPct.toFixed(2)}%</td>
                          <td className="px-4 py-3 text-gray-700 whitespace-nowrap">{pct(s.breakEvenDistancePct)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Konteks — bukan sinyal */}
              {foreignContext.length > 0 && (
                <div className="bg-white shadow sm:rounded-lg overflow-hidden">
                  <div className="px-4 py-3 border-b border-gray-100">
                    <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Konteks — Bukan Sinyal Beli/Jual</p>
                    <p className="text-xs text-gray-400 mt-1">Net asing {kode || 'saham ini'} beberapa hari terakhir, hanya sebagai informasi tambahan.</p>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="min-w-full text-sm divide-y divide-gray-100">
                      <thead className="bg-gray-50">
                        <tr>
                          {['Tanggal', 'Net Volume Asing', 'Estimasi Net Value'].map(h => (
                            <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider whitespace-nowrap">{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100">
                        {foreignContext.map(row => (
                          <tr key={row.date} className="hover:bg-gray-50">
                            <td className="px-4 py-3 text-gray-700 whitespace-nowrap">
                              {fmtDate(row.date)}
                              {row.highNonRegular && (
                                <span title="Volume non-reguler (block trade) signifikan — estimasi kurang bisa diandalkan" className="ml-1.5 text-amber-600 cursor-help">⚠</span>
                              )}
                            </td>
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
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  )
}
