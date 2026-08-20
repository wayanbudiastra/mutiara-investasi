'use client'

import { useState, useEffect, useMemo, useCallback, Suspense } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter, useSearchParams } from 'next/navigation'
import { ProGate } from '@/components/ProGate'
import {
  calculateAvgDownPlan, TIMEFRAME_PRESETS,
  STAGES_MIN, STAGES_MAX, INTERVAL_PCT_MIN, INTERVAL_PCT_MAX,
  type Timeframe, type AllocationMethod,
} from '@/lib/avgDown'

interface DividendEstimate {
  yearUsed: number
  dividenPerLembar: number
  isFallbackYear: boolean
  jumlahEvent: number
}

interface SavedPlan {
  id: string
  namaRencana: string
  kode: string
  currentPrice: number
  capital: number
  timeframe: Timeframe
  allocationMethod: AllocationMethod
  manualOverride: boolean
  stages: number
  intervalPct: number
  initialAvgPrice: number | null
  initialLot: number
  createdAt: string
  updatedAt: string
}

const rp = (v: number) => `Rp ${Math.round(v).toLocaleString('id-ID')}`
const pct = (v: number) => `${v >= 0 ? '+' : ''}${v.toFixed(2)}%`
const fmtDateTime = (d: string) => new Date(d).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })

const TIMEFRAMES: { key: Timeframe; label: string }[] = [
  { key: 'short', label: 'Pendek' },
  { key: 'medium', label: 'Menengah' },
  { key: 'long', label: 'Panjang' },
]

function AvgDownContent() {
  const { status } = useSession()
  const router = useRouter()
  const searchParams = useSearchParams()

  const [proAccess, setProAccess] = useState<{ hasAccess: boolean } | null>(null)
  const [bannerCollapsed, setBannerCollapsed] = useState(false)
  const [tab, setTab] = useState<'kalkulator' | 'tersimpan'>('kalkulator')

  const [kode, setKode] = useState('')
  const [currentPrice, setCurrentPrice] = useState<number>(0)
  const [capital, setCapital] = useState<number>(0)
  const [timeframe, setTimeframeState] = useState<Timeframe>('medium')
  const [allocationMethod, setAllocationMethod] = useState<AllocationMethod>('pyramid')
  const [initialAvgPrice, setInitialAvgPrice] = useState<number>(0)
  const [initialLot, setInitialLot] = useState<number>(0)

  const [manualOverride, setManualOverride] = useState(false)
  const [stages, setStages] = useState<number>(TIMEFRAME_PRESETS.medium.stages)
  const [intervalPct, setIntervalPct] = useState<number>(TIMEFRAME_PRESETS.medium.intervalPct)

  const [loadingPrefill, setLoadingPrefill] = useState(false)
  const [prefillMsg, setPrefillMsg] = useState('')
  const [dividendEstimate, setDividendEstimate] = useState<DividendEstimate | null>(null)
  const [dividendChecked, setDividendChecked] = useState(false)

  // Simpan / rencana tersimpan
  const [currentPlanId, setCurrentPlanId] = useState<string | null>(null)
  const [currentPlanName, setCurrentPlanName] = useState<string | null>(null)
  const [savedPlans, setSavedPlans] = useState<SavedPlan[]>([])
  const [loadingSaved, setLoadingSaved] = useState(false)
  const [showSaveModal, setShowSaveModal] = useState(false)
  const [namaRencanaInput, setNamaRencanaInput] = useState('')
  const [saving, setSaving] = useState(false)
  const [saveMsg, setSaveMsg] = useState<{ ok: boolean; text: string } | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)

  useEffect(() => {
    if (status === 'unauthenticated') router.push('/login')
  }, [status, router])

  useEffect(() => {
    if (status !== 'authenticated') return
    fetch('/api/subscription/status').then(r => r.json()).then(setProAccess)
  }, [status])

  // Ganti jangka waktu (klik langsung user) -> reset override ke preset (F12)
  const handleTimeframeChange = (tf: Timeframe) => {
    setTimeframeState(tf)
    const preset = TIMEFRAME_PRESETS[tf]
    setStages(preset.stages)
    setIntervalPct(preset.intervalPct)
  }

  const applyPlan = useCallback((p: SavedPlan) => {
    setCurrentPlanId(p.id)
    setCurrentPlanName(p.namaRencana)
    setKode(p.kode)
    setCurrentPrice(p.currentPrice)
    setCapital(p.capital)
    setTimeframeState(p.timeframe)
    setAllocationMethod(p.allocationMethod)
    setManualOverride(p.manualOverride)
    setStages(p.stages)
    setIntervalPct(p.intervalPct)
    setInitialAvgPrice(p.initialAvgPrice ?? 0)
    setInitialLot(p.initialLot ?? 0)
    setPrefillMsg('')
    setDividendEstimate(null)
    setDividendChecked(false)
    setSaveMsg(null)
    setTab('kalkulator')
  }, [])

  const fetchSavedPlans = useCallback(async () => {
    setLoadingSaved(true)
    try {
      const res = await fetch('/api/avg-down/plans')
      if (res.ok) setSavedPlans(await res.json())
    } finally {
      setLoadingSaved(false)
    }
  }, [])

  useEffect(() => {
    if (status === 'authenticated' && tab === 'tersimpan') fetchSavedPlans()
  }, [status, tab, fetchSavedPlans])

  // Buka rencana lewat ?planId= (mis. dari link luar)
  useEffect(() => {
    const planId = searchParams.get('planId')
    if (!planId || status !== 'authenticated') return
    fetch(`/api/avg-down/plans/${planId}`)
      .then(r => r.ok ? r.json() : null)
      .then(p => { if (p) applyPlan(p) })
  }, [searchParams, status, applyPlan])

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
      setDividendEstimate(body.dividendEstimate ?? null)
      setDividendChecked(true)
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

  const buildPayload = () => ({
    kode: kode.trim().toUpperCase(),
    currentPrice,
    capital,
    timeframe,
    allocationMethod,
    manualOverride,
    stages: plan?.stagesUsed ?? stages,
    intervalPct: plan?.intervalPctUsed ?? intervalPct,
    initialAvgPrice: initialLot > 0 ? initialAvgPrice : null,
    initialLot,
  })

  const openSaveModal = () => {
    setNamaRencanaInput(currentPlanName ?? `${kode || 'Saham'} - ${new Date().toLocaleDateString('id-ID')}`)
    setShowSaveModal(true)
  }

  const handleSaveAsNew = async () => {
    if (!namaRencanaInput.trim() || !plan) return
    setSaving(true)
    try {
      const res = await fetch('/api/avg-down/plans', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ namaRencana: namaRencanaInput.trim(), ...buildPayload() }),
      })
      const body = await res.json()
      if (!res.ok) {
        setSaveMsg({ ok: false, text: body.error ?? 'Gagal menyimpan rencana.' })
        return
      }
      setCurrentPlanId(body.id)
      setCurrentPlanName(namaRencanaInput.trim())
      setSaveMsg({ ok: true, text: `Rencana "${namaRencanaInput.trim()}" berhasil disimpan.` })
      setShowSaveModal(false)
    } catch {
      setSaveMsg({ ok: false, text: 'Gagal menyimpan rencana — coba lagi.' })
    } finally {
      setSaving(false)
    }
  }

  const handleUpdate = async () => {
    if (!currentPlanId || !currentPlanName || !plan) return
    setSaving(true)
    try {
      const res = await fetch(`/api/avg-down/plans/${currentPlanId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ namaRencana: currentPlanName, ...buildPayload() }),
      })
      const body = await res.json()
      if (!res.ok) {
        setSaveMsg({ ok: false, text: body.error ?? 'Gagal memperbarui rencana.' })
        return
      }
      setSaveMsg({ ok: true, text: `Rencana "${currentPlanName}" berhasil diperbarui.` })
    } catch {
      setSaveMsg({ ok: false, text: 'Gagal memperbarui rencana — coba lagi.' })
    } finally {
      setSaving(false)
    }
  }

  const handleDeletePlan = async (id: string, nama: string) => {
    if (!confirm(`Hapus rencana "${nama}"?`)) return
    setDeletingId(id)
    try {
      const res = await fetch(`/api/avg-down/plans/${id}`, { method: 'DELETE' })
      if (res.ok) {
        setSavedPlans(prev => prev.filter(p => p.id !== id))
        if (currentPlanId === id) {
          setCurrentPlanId(null)
          setCurrentPlanName(null)
        }
      }
    } finally {
      setDeletingId(null)
    }
  }

  const handleNewPlan = () => {
    setCurrentPlanId(null)
    setCurrentPlanName(null)
    setKode('')
    setCurrentPrice(0)
    setCapital(0)
    setTimeframeState('medium')
    setAllocationMethod('pyramid')
    setManualOverride(false)
    setStages(TIMEFRAME_PRESETS.medium.stages)
    setIntervalPct(TIMEFRAME_PRESETS.medium.intervalPct)
    setInitialAvgPrice(0)
    setInitialLot(0)
    setPrefillMsg('')
    setDividendEstimate(null)
    setDividendChecked(false)
    setSaveMsg(null)
    setTab('kalkulator')
  }

  if (status === 'loading' || proAccess === null) return null
  if (!proAccess.hasAccess) return <ProGate />

  return (
    <div className="p-4 sm:p-6 lg:p-8 pt-16 lg:pt-8">
      <div className="flex items-center justify-between gap-2 mb-1 print:hidden">
        <div className="flex items-center gap-2">
          <h1 className="text-xl font-bold text-gray-900">Strategi Average Down</h1>
          <span className="px-1.5 py-0.5 rounded text-xs font-bold bg-indigo-100 text-indigo-700">PRO</span>
        </div>
      </div>
      <p className="text-sm text-gray-500 mb-4 print:hidden">
        Susun rencana average down bertahap sebelum harga bergerak — level harga, alokasi modal, dan proyeksi harga rata-rata baru.
      </p>

      {/* Print-only header */}
      <div className="hidden print:block mb-4">
        <h1 className="text-xl font-bold text-gray-900">Rencana Average Down — {kode || '-'}</h1>
        <p className="text-xs text-gray-500">{currentPlanName ? `${currentPlanName} · ` : ''}Dicetak {new Date().toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}</p>
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200 mb-6 print:hidden">
        <nav className="flex gap-6">
          {([['kalkulator', 'Kalkulator'], ['tersimpan', 'Rencana Tersimpan']] as const).map(([key, label]) => (
            <button
              key={key}
              onClick={() => setTab(key)}
              className={`pb-3 text-sm font-medium border-b-2 transition-colors ${
                tab === key ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              {label}
              {key === 'tersimpan' && savedPlans.length > 0 && (
                <span className="ml-1.5 text-xs text-gray-400">({savedPlans.length})</span>
              )}
            </button>
          ))}
        </nav>
      </div>

      {/* Disclaimer permanen — F8 (interaktif, disembunyikan saat print) */}
      <div className="mb-6 bg-amber-50 border border-amber-200 rounded-lg print:hidden">
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
      {/* Versi statis disclaimer khusus untuk print — selalu tampil penuh */}
      <p className="hidden print:block mb-4 text-xs text-gray-600 border-t border-b border-gray-200 py-2">
        <strong>Catatan:</strong> Ini adalah kalkulator/perencana mekanis, bukan rekomendasi beli/jual, dan tidak menilai kelayakan saham untuk di-average down.
        Perhitungan mengabaikan fee broker/pajak transaksi.
      </p>

      {tab === 'tersimpan' ? (
        <div className="bg-white shadow sm:rounded-lg overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Rencana Tersimpan</p>
            <button
              onClick={handleNewPlan}
              className="text-xs text-indigo-600 hover:text-indigo-800 font-medium"
            >
              + Rencana Baru
            </button>
          </div>
          {loadingSaved ? (
            <div className="p-12 text-center text-gray-400">Memuat...</div>
          ) : savedPlans.length === 0 ? (
            <div className="p-12 text-center text-gray-400">
              Belum ada rencana tersimpan. Buat rencana di tab Kalkulator lalu klik Simpan.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm divide-y divide-gray-100">
                <thead className="bg-gray-50">
                  <tr>
                    {['Nama Rencana', 'Saham', 'Harga Saat Disimpan', 'Modal', 'Jangka Waktu', 'Terakhir Diubah', 'Aksi'].map(h => (
                      <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider whitespace-nowrap">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {savedPlans.map(p => (
                    <tr key={p.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3 font-medium text-gray-900 whitespace-nowrap">{p.namaRencana}</td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold bg-indigo-100 text-indigo-800">{p.kode}</span>
                      </td>
                      <td className="px-4 py-3 text-gray-700 whitespace-nowrap">{rp(p.currentPrice)}</td>
                      <td className="px-4 py-3 text-gray-700 whitespace-nowrap">{rp(p.capital)}</td>
                      <td className="px-4 py-3 text-gray-700 whitespace-nowrap">{TIMEFRAME_PRESETS[p.timeframe]?.label ?? p.timeframe}</td>
                      <td className="px-4 py-3 text-gray-500 whitespace-nowrap">{fmtDateTime(p.updatedAt)}</td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <div className="flex items-center gap-3">
                          <button onClick={() => applyPlan(p)} className="text-xs text-indigo-600 hover:text-indigo-800 font-medium">Buka</button>
                          <button
                            onClick={() => handleDeletePlan(p.id, p.namaRencana)}
                            disabled={deletingId === p.id}
                            className="text-xs text-red-600 hover:text-red-800 disabled:opacity-50"
                          >
                            {deletingId === p.id ? '...' : 'Hapus'}
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      ) : (
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 print:block">
        {/* Form */}
        <div className="lg:col-span-1 print:hidden">
          <div className="bg-white shadow sm:rounded-lg overflow-hidden sticky top-8">
            <div className="px-4 py-3 border-b border-gray-100">
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
                Input Rencana{currentPlanName ? ` — ${currentPlanName}` : ''}
              </p>
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
                      onClick={() => handleTimeframeChange(tf.key)}
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

              {/* Aksi: simpan / update / cetak */}
              <div className="pt-3 border-t border-gray-100 space-y-2">
                {saveMsg && (
                  <p className={`text-xs ${saveMsg.ok ? 'text-green-600' : 'text-red-600'}`}>{saveMsg.text}</p>
                )}
                <div className="flex gap-2">
                  {currentPlanId && (
                    <button
                      onClick={handleUpdate}
                      disabled={!plan || saving}
                      className="flex-1 px-3 py-2 bg-indigo-600 text-white text-sm font-medium rounded-md hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {saving ? 'Menyimpan...' : 'Update Rencana'}
                    </button>
                  )}
                  <button
                    onClick={openSaveModal}
                    disabled={!plan || saving}
                    className={`flex-1 px-3 py-2 text-sm font-medium rounded-md disabled:opacity-50 disabled:cursor-not-allowed ${
                      currentPlanId
                        ? 'border border-gray-300 text-gray-700 hover:bg-gray-50'
                        : 'bg-indigo-600 text-white hover:bg-indigo-700'
                    }`}
                  >
                    {currentPlanId ? 'Simpan sebagai Baru' : 'Simpan Rencana'}
                  </button>
                </div>
                <button
                  onClick={() => window.print()}
                  disabled={!plan}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed inline-flex items-center justify-center gap-1.5"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
                  </svg>
                  Cetak PDF
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Hasil */}
        <div className="lg:col-span-2 print:col-span-3 space-y-6">
          {!plan ? (
            <div className="bg-white rounded-lg shadow p-16 text-center text-gray-400 print:hidden">
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

              {/* Estimasi dividen — bukan angka pasti */}
              {dividendEstimate && (
                <div className="bg-white shadow sm:rounded-lg overflow-hidden">
                  <div className="px-4 py-3 border-b border-gray-100">
                    <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Estimasi Dividen Tahunan (Bukan Angka Pasti)</p>
                  </div>
                  <div className="p-4">
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                      <div>
                        <p className="text-xs text-gray-500">Dividen/Lembar Tahun {dividendEstimate.yearUsed}</p>
                        <p className="text-base font-bold text-gray-900">{rp(dividendEstimate.dividenPerLembar)}</p>
                      </div>
                      <div>
                        <p className="text-xs text-gray-500">Total Lot (jika semua tahap tereksekusi)</p>
                        <p className="text-base font-bold text-gray-900">{plan.totalLots.toLocaleString('id-ID')}</p>
                      </div>
                      <div>
                        <p className="text-xs text-gray-500">Estimasi Total Dividen Setahun</p>
                        <p className="text-lg font-bold text-green-600">{rp(dividendEstimate.dividenPerLembar * plan.totalLots * 100)}</p>
                      </div>
                    </div>
                    <p className="text-xs text-gray-400 mt-3">
                      Dihitung dari riwayat dividen (status DONE) yang kamu catat di Rekap Dividen untuk {kode} tahun {dividendEstimate.yearUsed}
                      {dividendEstimate.isFallbackYear ? ' (tahun terakhir dengan data tersedia)' : ''} ({dividendEstimate.jumlahEvent} pembagian),
                      dikalikan proyeksi total lot akhir rencana ini. <strong>Ini hanya estimasi, bukan angka pasti</strong> — dividen aktual
                      tergantung kebijakan emiten dan tidak dijamin berulang atau sebesar tahun sebelumnya.
                    </p>
                  </div>
                </div>
              )}
              {!dividendEstimate && dividendChecked && (
                <p className="text-xs text-gray-400">
                  Belum ada riwayat dividen (status DONE) untuk {kode} di Rekap Dividen — estimasi dividen tidak tersedia.
                </p>
              )}
            </>
          )}
        </div>
      </div>
      )}

      {/* Modal simpan */}
      {showSaveModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center print:hidden">
          <div className="fixed inset-0 bg-black/40" onClick={() => setShowSaveModal(false)} />
          <div className="relative z-50 bg-white rounded-xl shadow-2xl w-full max-w-sm mx-4 p-6">
            <h2 className="text-lg font-bold text-gray-900 mb-4">Simpan Rencana</h2>
            <label className="block text-xs font-medium text-gray-700 mb-1">Nama Rencana</label>
            <input
              type="text"
              autoFocus
              value={namaRencanaInput}
              onChange={e => setNamaRencanaInput(e.target.value)}
              placeholder="mis. BBCA - Rencana Juli 2026"
              className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:ring-indigo-500 focus:border-indigo-500"
            />
            <div className="mt-6 flex gap-3 justify-end">
              <button
                onClick={() => setShowSaveModal(false)}
                className="px-4 py-2 text-sm font-medium text-gray-700 border border-gray-300 rounded-md hover:bg-gray-50"
              >
                Batal
              </button>
              <button
                onClick={handleSaveAsNew}
                disabled={saving || !namaRencanaInput.trim()}
                className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-md hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {saving ? 'Menyimpan...' : 'Simpan'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default function AvgDownPage() {
  return (
    <Suspense fallback={null}>
      <AvgDownContent />
    </Suspense>
  )
}
