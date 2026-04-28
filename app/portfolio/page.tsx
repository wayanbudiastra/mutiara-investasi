'use client'

import { useState, useEffect, useCallback } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { ProGate } from '@/components/ProGate'
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer,
} from 'recharts'

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

interface JournalRow {
  id: string
  journalDate: string
  totalModal: number
  totalNilaiPasar: number
  totalFloatRp: number
  totalFloatPct: number
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

const emptyForm = { saham: '', hargaRata: '', lot: '' }

const rp  = (v: number) => `Rp ${v.toLocaleString('id-ID')}`
const pct = (v: number) => `${v >= 0 ? '+' : ''}${v.toFixed(2)}%`
const fmtDate = (d: string) => new Date(d + 'T00:00:00').toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })

export default function PortfolioPage() {
  const { data: session, status } = useSession()
  const router = useRouter()

  const [proAccess, setProAccess]       = useState<{ hasAccess: boolean } | null>(null)
  const [activeTab, setActiveTab]       = useState<'portofolio' | 'jurnal' | 'gainloss'>('portofolio')
  const [glFilterKet, setGlFilterKet]   = useState('')
  const [glJournalYear, setGlJournalYear] = useState(new Date().getFullYear())
  const [rows, setRows]                 = useState<PortfolioRow[]>([])
  const [prices, setPrices]             = useState<Record<string, { price: number | null; isCache: boolean; lastPriceAt: string | null }>>({})
  const [loadingData, setLoadingData]   = useState(false)
  const [loadingPrice, setLoadingPrice] = useState(false)
  const [securities, setSecurities]     = useState<Security[]>([])
  const [filterKet, setFilterKet]       = useState('')

  // Jurnal states
  const [journals, setJournals]             = useState<JournalRow[]>([])
  const [journalYear, setJournalYear]       = useState(new Date().getFullYear())
  const [journalPage, setJournalPage]       = useState(1)
  const JOURNAL_PAGE_SIZE = 10
  const [loadingJournal, setLoadingJournal] = useState(false)
  const [savingJournal, setSavingJournal]   = useState(false)
  const [todayJournal, setTodayJournal]     = useState<JournalRow | null | undefined>(undefined)
  const [showConfirm, setShowConfirm]       = useState(false)
  const [previewData, setPreviewData]       = useState<JournalDetail[]>([])
  const [detailJournal, setDetailJournal]   = useState<JournalRow | null>(null)

  const [showModal, setShowModal]   = useState(false)
  const [editItem, setEditItem]     = useState<PortfolioRow | null>(null)
  const [form, setForm]             = useState(emptyForm)
  const [saving, setSaving]         = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)

  // Sekuritas combobox
  const [selectedSecId, setSelectedSecId]     = useState('')
  const [secSearch, setSecSearch]             = useState('')
  const [secDropdownOpen, setSecDropdownOpen] = useState(false)

  useEffect(() => {
    if (status === 'unauthenticated') router.push('/login')
  }, [status, router])

  const fetchPortfolio = useCallback(async () => {
    setLoadingData(true)
    try {
      const res = await fetch('/api/portfolio')
      if (res.ok) {
        const data: PortfolioRow[] = await res.json()
        setRows(data)
        // Build prices state dari lastPrice di DB — tidak hit Yahoo Finance
        const initial: Record<string, { price: number | null; isCache: boolean; lastPriceAt: string | null }> = {}
        data.forEach(r => {
          if (!initial[r.saham]) {
            initial[r.saham] = {
              price:       r.lastPrice ?? null,
              isCache:     r.lastPrice != null,
              lastPriceAt: r.lastPriceAt ?? null,
            }
          }
        })
        setPrices(initial)
      }
    } finally {
      setLoadingData(false)
    }
  }, [])

  // Refresh manual — satu-satunya trigger Yahoo Finance
  const fetchPrices = useCallback(async (data: PortfolioRow[]) => {
    const uniqueSymbols = Array.from(new Set(data.map(r => r.saham)))
    if (uniqueSymbols.length === 0) return
    setLoadingPrice(true)
    try {
      const res = await fetch(`/api/portfolio/price?symbols=${uniqueSymbols.join(',')}`)
      if (res.ok) setPrices(await res.json())
    } finally {
      setLoadingPrice(false)
    }
  }, [])

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

  useEffect(() => {
    if (status !== 'authenticated') return
    fetch('/api/subscription/status').then(r => r.json()).then(setProAccess)
    const userId = (session?.user as any)?.id
    fetchPortfolio()
    if (userId) fetchSecurities(userId)
  }, [status, session, fetchPortfolio, fetchSecurities])

  // Auto-fetch dihapus — harga hanya diperbarui saat user klik "Refresh Harga"

  // ── Modal helpers ──────────────────────────────────────────────────────────

  const resetModal = () => {
    setSelectedSecId('')
    setSecSearch('')
    setSecDropdownOpen(false)
  }

  const openAdd = () => {
    setEditItem(null)
    setForm(emptyForm)
    resetModal()
    setShowModal(true)
  }

  const openEdit = (row: PortfolioRow) => {
    setEditItem(row)
    setForm({ saham: row.saham, hargaRata: String(row.hargaRata), lot: String(row.lot) })
    // pre-select: cocokkan keterangan (uppercase) dengan s.nama (uppercase)
    const match = securities.find(s => s.nama.toUpperCase().trim() === row.keterangan)
    setSelectedSecId(match?.id ?? '')
    setSecSearch('')
    setSecDropdownOpen(false)
    setShowModal(true)
  }

  const closeModal = () => {
    setShowModal(false)
    setEditItem(null)
    resetModal()
  }

  const handleSecSelect = (sec: Security) => {
    setSelectedSecId(sec.id)
    setSecDropdownOpen(false)
    setSecSearch('')
  }

  // ── Save / Delete ──────────────────────────────────────────────────────────

  const selectedSec = securities.find(s => s.id === selectedSecId)

  const handleSave = async () => {
    if (!selectedSecId || !form.saham || !form.hargaRata || !form.lot) return
    setSaving(true)
    try {
      const payload = {
        keterangan: selectedSec!.nama,
        saham:      form.saham,
        hargaRata:  parseFloat(form.hargaRata),
        lot:        parseInt(form.lot),
      }
      const res = await fetch(editItem ? `/api/portfolio/${editItem.id}` : '/api/portfolio', {
        method:  editItem ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify(payload),
      })
      if (res.ok) {
        // Untuk posisi baru: API sudah fetch harga dari Yahoo Finance
        // Update prices state langsung dari response tanpa reload penuh
        if (!editItem) {
          const data = await res.json()
          if (data.lastPrice != null) {
            setPrices(prev => ({
              ...prev,
              [form.saham.toUpperCase()]: {
                price: data.lastPrice,
                isCache: true,
                lastPriceAt: data.lastPriceAt,
              }
            }))
          }
        }
        closeModal()
        await fetchPortfolio()
      }
    } finally { setSaving(false) }
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Hapus posisi ini?')) return
    setDeletingId(id)
    try {
      const res = await fetch(`/api/portfolio/${id}`, { method: 'DELETE' })
      if (res.ok) await fetchPortfolio()
    } finally { setDeletingId(null) }
  }

  // ── Journal helpers ────────────────────────────────────────────────────────

  const fetchJournals = useCallback(async (year: number) => {
    setLoadingJournal(true)
    setJournalPage(1)
    try {
      const res = await fetch(`/api/portfolio/journal?year=${year}`)
      if (res.ok) {
        const data: JournalRow[] = await res.json()
        setJournals(data)
        // Cek apakah ada jurnal hari ini
        const today = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Jakarta' })
        const found = data.find(j => j.journalDate === today) ?? null
        setTodayJournal(found)
      }
    } finally {
      setLoadingJournal(false)
    }
  }, [])

  useEffect(() => {
    if (status === 'authenticated' && activeTab === 'jurnal') {
      fetchJournals(journalYear)
    }
  }, [status, activeTab, journalYear, fetchJournals])

  const handleBuatJurnal = async () => {
    if (rows.length === 0) return
    setSavingJournal(true)
    try {
      // Ambil harga terkini
      const symbols = Array.from(new Set(rows.map(r => r.saham)))
      const priceRes = await fetch(`/api/portfolio/price?symbols=${symbols.join(',')}`)
      const livePriceRaw: Record<string, { price: number | null; isCache: boolean }> = priceRes.ok ? await priceRes.json() : {}

      // Susun detail snapshot — jurnal selalu gunakan harga terkini (cache atau live)
      const detail: JournalDetail[] = rows.map(r => {
        const modal      = r.hargaRata * r.lot * 100
        const hargaAkhir = livePriceRaw[r.saham]?.price ?? null
        const nilaiPasar = hargaAkhir != null ? hargaAkhir * r.lot * 100 : null
        const floatRp    = nilaiPasar != null ? nilaiPasar - modal : null
        const floatPct   = floatRp != null && modal > 0 ? (floatRp / modal) * 100 : null
        return { keterangan: r.keterangan, saham: r.saham, hargaRata: r.hargaRata, lot: r.lot, modal, hargaTerakhir: hargaAkhir, nilaiPasar, floatRp, floatPct }
      })

      const totalModal      = detail.reduce((s, d) => s + d.modal, 0)
      const totalNilaiPasar = detail.reduce((s, d) => s + (d.nilaiPasar ?? d.modal), 0)
      const totalFloatRp    = totalNilaiPasar - totalModal
      const totalFloatPct   = totalModal > 0 ? (totalFloatRp / totalModal) * 100 : 0

      setPreviewData(detail)
      setShowConfirm(true)
      setSavingJournal(false)

      // Simpan state untuk konfirmasi
      ;(window as any).__journalPayload = { totalModal, totalNilaiPasar, totalFloatRp, totalFloatPct, detail }
    } catch {
      setSavingJournal(false)
    }
  }

  const handleKonfirmasiJurnal = async () => {
    const payload = (window as any).__journalPayload
    if (!payload) return
    setSavingJournal(true)
    try {
      const res = await fetch('/api/portfolio/journal', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      if (res.status === 409) {
        alert('Jurnal hari ini sudah dibuat.')
      } else if (res.ok) {
        setShowConfirm(false)
        await fetchJournals(journalYear)
      }
    } finally {
      setSavingJournal(false)
    }
  }

  // ── Render guard ───────────────────────────────────────────────────────────

  if (status === 'loading' || proAccess === null) return null
  if (!proAccess.hasAccess) return <ProGate />

  // ── Derived data ───────────────────────────────────────────────────────────

  const keterangans  = Array.from(new Set(rows.map(r => r.keterangan))).sort()
  const filtered     = filterKet ? rows.filter(r => r.keterangan === filterKet) : rows

  const getPrice = (saham: string) => prices[saham]?.price ?? null
  const getIsCache = (saham: string) => prices[saham]?.isCache ?? false
  const getCacheAt = (saham: string) => prices[saham]?.lastPriceAt ?? null

  const calc = (row: PortfolioRow) => {
    const modal      = row.hargaRata * row.lot * 100
    const hargaAkhir = getPrice(row.saham)
    const isCache    = getIsCache(row.saham)
    const cacheAt    = getCacheAt(row.saham)
    const nilaiPasar = hargaAkhir != null ? hargaAkhir * row.lot * 100 : null
    const floatRp    = nilaiPasar != null ? nilaiPasar - modal : null
    const floatPct   = floatRp != null && modal > 0 ? (floatRp / modal) * 100 : null
    return { modal, hargaAkhir, isCache, cacheAt, nilaiPasar, floatRp, floatPct }
  }

  const totalModal      = filtered.reduce((s, r) => s + r.hargaRata * r.lot * 100, 0)
  const totalNilaiPasar = filtered.reduce((s, r) => {
    const h = getPrice(r.saham); return h != null ? s + h * r.lot * 100 : s
  }, 0)
  const totalFloatRp  = totalNilaiPasar - totalModal
  const totalFloatPct = totalModal > 0 ? (totalFloatRp / totalModal) * 100 : 0
  const hasAllPrices  = filtered.length > 0 && filtered.every(r => getPrice(r.saham) != null)
  const allFromCache  = hasAllPrices && filtered.every(r => getIsCache(r.saham))

  const floatColor = (v: number | null) =>
    v == null ? 'text-gray-400' : v > 0 ? 'text-green-600' : v < 0 ? 'text-red-600' : 'text-gray-600'

  const rowBg = (v: number | null) =>
    v == null ? '' : v > 0 ? 'bg-green-50 hover:bg-green-100' : v < 0 ? 'bg-red-50 hover:bg-red-100' : 'hover:bg-gray-50'

  const canSave = !!(selectedSecId && form.saham && form.hargaRata && form.lot)

  // ── JSX ────────────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">

        {/* Header */}
        <div className="mb-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Rekap Portofolio</h1>
            <p className="mt-1 text-sm text-gray-500">{rows.length} posisi tersimpan</p>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex flex-col items-end gap-0.5">
              <button
                onClick={() => fetchPrices(rows)}
                disabled={loadingPrice || rows.length === 0}
                className="inline-flex items-center gap-2 px-4 py-2 bg-white border border-gray-300 text-gray-700 text-sm font-medium rounded-md hover:bg-gray-50 disabled:opacity-50"
              >
                <svg className={`w-4 h-4 ${loadingPrice ? 'animate-spin' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                    d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
                {loadingPrice ? 'Memperbarui...' : 'Refresh Harga'}
              </button>
              {(() => {
                const latest = Object.values(prices)
                  .map(p => p.lastPriceAt)
                  .filter(Boolean)
                  .sort()
                  .pop()
                return latest ? (
                  <span className="text-xs text-gray-400">
                    Update: {new Date(latest).toLocaleString('id-ID', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Jakarta' })} WIB
                  </span>
                ) : null
              })()}
            </div>
            <button
              onClick={openAdd}
              className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white text-sm font-medium rounded-md hover:bg-indigo-700"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              Tambah Posisi
            </button>
          </div>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
          {[
            { label: 'Total Modal',      val: rp(totalModal),      color: 'text-gray-900',           show: true },
            { label: 'Total Nilai Pasar', val: rp(totalNilaiPasar), color: 'text-gray-900',           show: hasAllPrices },
            { label: 'Floating P/L',      val: rp(totalFloatRp),    color: floatColor(hasAllPrices ? totalFloatRp : null), show: hasAllPrices },
            { label: 'Floating P/L (%)',  val: pct(totalFloatPct),  color: floatColor(hasAllPrices ? totalFloatPct : null), show: hasAllPrices },
          ].map(c => (
            <div key={c.label} className="bg-white rounded-lg shadow p-4">
              <p className="text-xs text-gray-500 mb-1">{c.label}</p>
              <p className={`text-lg font-bold ${c.color}`}>
                {c.show ? c.val : <span className="text-gray-400 text-sm">—</span>}
              </p>
            </div>
          ))}
        </div>

        {/* Tabs */}
        <div className="border-b border-gray-200 mb-6">
          <nav className="flex gap-6">
            {([['portofolio','Portofolio'],['jurnal','Jurnal'],['gainloss','Gain/Loss']] as const).map(([tab, label]) => (
              <button key={tab} onClick={() => setActiveTab(tab)}
                className={`pb-3 text-sm font-medium border-b-2 transition-colors ${
                  activeTab === tab ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-gray-500 hover:text-gray-700'
                }`}>
                {label}
              </button>
            ))}
          </nav>
        </div>

        {/* ── TAB JURNAL ──────────────────────────────────────────────────── */}
        {activeTab === 'jurnal' && (() => {
          const currentYear = new Date().getFullYear()
          const availYears  = Array.from({ length: 5 }, (_, i) => currentYear - i)
          const today       = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Jakarta' })
          const hasToday    = journals.some(j => j.journalDate === today)

          // YTD summary
          const lastJ  = journals[journals.length - 1]
          const firstJ = journals[0]
          const ytdGrowth = firstJ && lastJ
            ? lastJ.totalNilaiPasar - firstJ.totalNilaiPasar
            : 0

          // Chart data
          const chartData = journals.map(j => ({
            date: j.journalDate.slice(5), // MM-DD
            nilai: Math.round(j.totalNilaiPasar / 1000), // dalam ribu
            modal: Math.round(j.totalModal / 1000),
          }))
          const chartColor = lastJ && firstJ && lastJ.totalNilaiPasar >= firstJ.totalNilaiPasar ? '#16a34a' : '#dc2626'

          return (
            <div>
              {/* Header jurnal */}
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-6">
                <div>
                  <h2 className="text-lg font-bold text-gray-900">Jurnal Portofolio</h2>
                  <p className="text-xs text-gray-500 mt-0.5">Rekam kondisi portofolio sekali sehari</p>
                </div>
                <div className="flex items-center gap-3">
                  <select value={journalYear} onChange={e => setJournalYear(Number(e.target.value))}
                    className="border border-gray-300 rounded-md px-3 py-1.5 text-sm">
                    {availYears.map(y => <option key={y} value={y}>{y}</option>)}
                  </select>
                  <button
                    onClick={handleBuatJurnal}
                    disabled={savingJournal || hasToday || rows.length === 0}
                    title={hasToday ? 'Jurnal hari ini sudah dibuat' : rows.length === 0 ? 'Belum ada portofolio' : ''}
                    className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white text-sm font-medium rounded-md hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {savingJournal ? 'Memproses...' : hasToday ? '✓ Jurnal Dibuat' : '+ Buat Jurnal Hari Ini'}
                  </button>
                </div>
              </div>

              {/* Summary cards YTD */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
                {[
                  { label: 'Jurnal Tercatat', val: `${journals.length} hari`, color: 'text-gray-900' },
                  { label: 'Nilai Pasar Terakhir', val: lastJ ? rp(lastJ.totalNilaiPasar) : '—', color: 'text-gray-900' },
                  { label: 'Float P/L Terakhir', val: lastJ ? rp(lastJ.totalFloatRp) : '—', color: lastJ ? floatColor(lastJ.totalFloatRp) : 'text-gray-400' },
                  { label: `Pertumbuhan ${journalYear}`, val: journals.length > 1 ? rp(ytdGrowth) : '—', color: floatColor(journals.length > 1 ? ytdGrowth : null) },
                ].map(c => (
                  <div key={c.label} className="bg-white rounded-lg shadow p-4">
                    <p className="text-xs text-gray-500 mb-1">{c.label}</p>
                    <p className={`text-base font-bold ${c.color}`}>{c.val}</p>
                  </div>
                ))}
              </div>

              {loadingJournal ? (
                <div className="bg-white rounded-lg shadow p-12 text-center text-gray-400">Memuat jurnal...</div>
              ) : journals.length === 0 ? (
                <div className="bg-white rounded-lg shadow p-12 text-center text-gray-400">
                  Belum ada jurnal untuk tahun {journalYear}.<br />
                  <span className="text-sm">Klik <strong>"Buat Jurnal Hari Ini"</strong> untuk memulai.</span>
                </div>
              ) : (
                <>
                  {/* Line chart */}
                  <div className="bg-white rounded-lg shadow p-4 mb-6">
                    <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">Tren Nilai Portofolio {journalYear}</p>
                    <div style={{ height: 240 }}>
                      <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={chartData} margin={{ top: 5, right: 10, left: 0, bottom: 0 }}>
                          <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                          <XAxis dataKey="date" tick={{ fontSize: 10 }} />
                          <YAxis tick={{ fontSize: 10 }} tickFormatter={v => `${v}rb`} width={55} />
                          <Tooltip formatter={(v: number) => [`Rp ${(v * 1000).toLocaleString('id-ID')}`, 'Nilai Pasar']} />
                          <Line type="monotone" dataKey="nilai" stroke={chartColor} strokeWidth={2} dot={false} />
                        </LineChart>
                      </ResponsiveContainer>
                    </div>
                  </div>

                  {/* Tabel riwayat */}
                  {(() => {
                    const sorted     = [...journals].reverse()
                    const totalPages = Math.ceil(sorted.length / JOURNAL_PAGE_SIZE)
                    const paged      = sorted.slice((journalPage - 1) * JOURNAL_PAGE_SIZE, journalPage * JOURNAL_PAGE_SIZE)
                    return (
                      <div className="bg-white shadow sm:rounded-lg overflow-hidden">
                        <div className="overflow-x-auto">
                          <table className="min-w-full text-sm divide-y divide-gray-100">
                            <thead className="bg-gray-50">
                              <tr>
                                {['No','Tanggal','Total Modal','Nilai Pasar','Float P/L (Rp)','Float P/L (%)','Aksi'].map(h => (
                                  <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider whitespace-nowrap">{h}</th>
                                ))}
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100">
                              {paged.map((j, idx) => (
                                <tr key={j.id} className="hover:bg-gray-50">
                                  <td className="px-4 py-3 text-gray-400 text-xs">{(journalPage - 1) * JOURNAL_PAGE_SIZE + idx + 1}</td>
                                  <td className="px-4 py-3 text-gray-900 whitespace-nowrap font-medium">
                                    {fmtDate(j.journalDate)}
                                    {j.journalDate === today && <span className="ml-2 text-xs text-indigo-600 font-bold">Hari ini</span>}
                                  </td>
                                  <td className="px-4 py-3 text-gray-700 whitespace-nowrap">{rp(j.totalModal)}</td>
                                  <td className="px-4 py-3 text-gray-700 whitespace-nowrap">{rp(j.totalNilaiPasar)}</td>
                                  <td className={`px-4 py-3 font-semibold whitespace-nowrap ${floatColor(j.totalFloatRp)}`}>{rp(j.totalFloatRp)}</td>
                                  <td className={`px-4 py-3 font-semibold whitespace-nowrap ${floatColor(j.totalFloatPct)}`}>{pct(j.totalFloatPct)}</td>
                                  <td className="px-4 py-3">
                                    <button onClick={() => setDetailJournal(j)}
                                      className="text-xs text-indigo-600 hover:text-indigo-800 font-medium">Detail</button>
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>

                        {/* Pagination */}
                        {totalPages > 1 && (
                          <div className="bg-white px-4 py-3 flex items-center justify-between border-t border-gray-100">
                            <div className="text-sm text-gray-700">
                              Menampilkan{' '}
                              <span className="font-medium">{(journalPage - 1) * JOURNAL_PAGE_SIZE + 1}</span>
                              {' '}–{' '}
                              <span className="font-medium">{Math.min(journalPage * JOURNAL_PAGE_SIZE, sorted.length)}</span>
                              {' '}dari{' '}
                              <span className="font-medium">{sorted.length}</span> jurnal
                            </div>
                            <div className="flex gap-1">
                              <button onClick={() => setJournalPage(1)} disabled={journalPage === 1}
                                className="px-2 py-1 text-sm border rounded disabled:opacity-40 hover:bg-gray-50">«</button>
                              <button onClick={() => setJournalPage(p => p - 1)} disabled={journalPage === 1}
                                className="px-3 py-1 text-sm border rounded disabled:opacity-40 hover:bg-gray-50">Prev</button>
                              {Array.from({ length: totalPages }, (_, i) => i + 1)
                                .filter(p => Math.abs(p - journalPage) <= 2)
                                .map(p => (
                                  <button key={p} onClick={() => setJournalPage(p)}
                                    className={`px-3 py-1 text-sm border rounded ${p === journalPage ? 'bg-indigo-600 text-white border-indigo-600' : 'hover:bg-gray-50'}`}>
                                    {p}
                                  </button>
                                ))}
                              <button onClick={() => setJournalPage(p => p + 1)} disabled={journalPage === totalPages}
                                className="px-3 py-1 text-sm border rounded disabled:opacity-40 hover:bg-gray-50">Next</button>
                              <button onClick={() => setJournalPage(totalPages)} disabled={journalPage === totalPages}
                                className="px-2 py-1 text-sm border rounded disabled:opacity-40 hover:bg-gray-50">»</button>
                            </div>
                          </div>
                        )}
                      </div>
                    )
                  })()}
                </>
              )}
            </div>
          )
        })()}

        {/* ── TAB GAIN/LOSS ───────────────────────────────────────────────── */}
        {activeTab === 'gainloss' && (() => {
          // ── Data per saham ────────────────────────────────────────────────
          const glRows = rows
            .filter(r => !glFilterKet || r.keterangan === glFilterKet)
            .map(r => {
              const modal      = r.hargaRata * r.lot * 100
              const hargaAkhir = prices[r.saham]?.price ?? null
              const nilaiPasar = hargaAkhir != null ? hargaAkhir * r.lot * 100 : null
              const glRp       = nilaiPasar != null ? nilaiPasar - modal : null
              const glPct      = glRp != null && modal > 0 ? (glRp / modal) * 100 : null
              return { ...r, modal, hargaAkhir, nilaiPasar, glRp, glPct }
            })
            .sort((a, b) => (b.glPct ?? -Infinity) - (a.glPct ?? -Infinity))

          // ── Data per akun ────────────────────────────────────────────────
          const akunMap: Record<string, { modal: number; nilaiPasar: number; count: number }> = {}
          rows.forEach(r => {
            const modal      = r.hargaRata * r.lot * 100
            const hargaAkhir = prices[r.saham]?.price ?? null
            const nilaiPasar = hargaAkhir != null ? hargaAkhir * r.lot * 100 : modal
            if (!akunMap[r.keterangan]) akunMap[r.keterangan] = { modal: 0, nilaiPasar: 0, count: 0 }
            akunMap[r.keterangan].modal      += modal
            akunMap[r.keterangan].nilaiPasar += nilaiPasar
            akunMap[r.keterangan].count      += 1
          })
          const akunRows = Object.entries(akunMap).map(([ket, v]) => ({
            keterangan: ket,
            count: v.count,
            modal: v.modal,
            nilaiPasar: v.nilaiPasar,
            glRp: v.nilaiPasar - v.modal,
            glPct: v.modal > 0 ? ((v.nilaiPasar - v.modal) / v.modal) * 100 : 0,
          })).sort((a, b) => b.glPct - a.glPct)

          // ── Top gainer / loser ────────────────────────────────────────────
          const withPrice = glRows.filter(r => r.glPct != null)
          const topGainer = withPrice.slice(0, 3)
          const topLoser  = [...withPrice].sort((a, b) => (a.glPct ?? 0) - (b.glPct ?? 0)).slice(0, 3)

          // ── Summary totals ────────────────────────────────────────────────
          const sumModal      = glRows.reduce((s, r) => s + r.modal, 0)
          const sumNilaiPasar = glRows.reduce((s, r) => s + (r.nilaiPasar ?? r.modal), 0)
          const sumGlRp       = sumNilaiPasar - sumModal
          const sumGlPct      = sumModal > 0 ? (sumGlRp / sumModal) * 100 : 0

          // ── Journal chart & tabel (untuk tahun terpilih) ──────────────────
          const glJournals    = journals.filter(j => j.journalDate.startsWith(String(glJournalYear)))
          const firstJ        = glJournals[0]
          const lastJ         = glJournals[glJournals.length - 1]
          const ytdGrowth     = firstJ && lastJ ? lastJ.totalNilaiPasar - firstJ.totalNilaiPasar : null
          const chartGlData   = glJournals.map(j => ({
            date:  j.journalDate.slice(5),
            gl:    Math.round(j.totalFloatRp / 1000),
            modal: Math.round(j.totalModal / 1000),
            nilai: Math.round(j.totalNilaiPasar / 1000),
          }))
          const chartGlColor  = lastJ && lastJ.totalFloatRp >= 0 ? '#16a34a' : '#dc2626'
          const availYears    = Array.from({ length: 5 }, (_, i) => new Date().getFullYear() - i)

          const glC = (v: number | null) =>
            v == null ? 'text-gray-400' : v > 0 ? 'text-green-600' : v < 0 ? 'text-red-600' : 'text-gray-600'
          const glBadge = (v: number | null) =>
            v == null ? 'bg-gray-100 text-gray-500' : v > 0 ? 'bg-green-100 text-green-700' : v < 0 ? 'bg-red-100 text-red-700' : 'bg-gray-100 text-gray-500'
          const glLabel = (v: number | null) =>
            v == null ? '—' : v > 0 ? 'GAIN' : v < 0 ? 'LOSS' : 'FLAT'

          return (
            <div>
              {/* Header */}
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-6">
                <div>
                  <h2 className="text-lg font-bold text-gray-900">Rekap Capital Gain & Loss</h2>
                  <p className="text-xs text-gray-500 mt-0.5">Berdasarkan posisi portofolio dan data jurnal</p>
                </div>
                <select value={glFilterKet} onChange={e => setGlFilterKet(e.target.value)}
                  className="border border-gray-300 rounded-md px-3 py-1.5 text-sm">
                  <option value="">Semua Akun Sekuritas</option>
                  {Array.from(new Set(rows.map(r => r.keterangan))).sort().map(k => (
                    <option key={k} value={k}>{k}</option>
                  ))}
                </select>
              </div>

              {/* Summary Cards */}
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 mb-6">
                {[
                  { label: 'Total Modal',       val: rp(sumModal),                 color: 'text-gray-900' },
                  { label: 'Total Nilai Pasar', val: rp(sumNilaiPasar),            color: 'text-gray-900' },
                  { label: 'Total G/L',         val: rp(sumGlRp),                  color: glC(sumGlRp) },
                  { label: 'Total G/L (%)',     val: pct(sumGlPct),                color: glC(sumGlPct) },
                  { label: `Pertumbuhan ${glJournalYear}`, val: ytdGrowth != null ? rp(ytdGrowth) : '—', color: glC(ytdGrowth) },
                ].map(c => (
                  <div key={c.label} className="bg-white rounded-lg shadow p-3">
                    <p className="text-xs text-gray-500 mb-1">{c.label}</p>
                    <p className={`text-base font-bold ${c.color}`}>{c.val}</p>
                  </div>
                ))}
              </div>

              {rows.length === 0 ? (
                <div className="bg-white rounded-lg shadow p-12 text-center text-gray-400">
                  Belum ada data portofolio.
                </div>
              ) : (
                <>
                  {/* Top Gainer & Loser */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
                    {[
                      { title: 'Top Gainer', items: topGainer, positive: true },
                      { title: 'Top Loser',  items: topLoser,  positive: false },
                    ].map(({ title, items, positive }) => (
                      <div key={title} className="bg-white rounded-lg shadow p-4">
                        <p className={`text-xs font-bold uppercase tracking-wider mb-3 ${positive ? 'text-green-600' : 'text-red-600'}`}>
                          {title}
                        </p>
                        {items.length === 0 ? (
                          <p className="text-xs text-gray-400">Tidak ada data</p>
                        ) : (
                          <div className="space-y-2">
                            {items.map((r, i) => (
                              <div key={r.id} className="flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                  <span className="text-xs text-gray-400 w-4">{i + 1}.</span>
                                  <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-bold bg-indigo-100 text-indigo-800">{r.saham}</span>
                                  <span className="text-xs text-gray-500">{r.keterangan}</span>
                                </div>
                                <div className="text-right">
                                  <p className={`text-sm font-bold ${glC(r.glPct)}`}>{r.glPct != null ? pct(r.glPct) : '—'}</p>
                                  <p className={`text-xs ${glC(r.glRp)}`}>{r.glRp != null ? rp(r.glRp) : '—'}</p>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>

                  {/* Tabel per saham */}
                  <div className="bg-white shadow sm:rounded-lg overflow-hidden mb-6">
                    <div className="px-4 py-3 border-b border-gray-100">
                      <p className="text-xs font-bold text-gray-500 uppercase tracking-wider">Rekap Per Saham</p>
                    </div>
                    <div className="overflow-x-auto">
                      <table className="min-w-full text-sm divide-y divide-gray-100">
                        <thead className="bg-gray-50">
                          <tr>
                            {['No','Saham','Akun','Avg Price','Lot','Modal','Harga Terkini','Nilai Pasar','G/L (Rp)','G/L (%)','Status'].map(h => (
                              <th key={h} className="px-3 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider whitespace-nowrap">{h}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                          {glRows.map((r, idx) => (
                            <tr key={r.id} className="hover:bg-gray-50">
                              <td className="px-3 py-3 text-gray-400 text-xs">{idx + 1}</td>
                              <td className="px-3 py-3 whitespace-nowrap">
                                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold bg-indigo-100 text-indigo-800">{r.saham}</span>
                              </td>
                              <td className="px-3 py-3 text-gray-600 text-xs whitespace-nowrap">{r.keterangan}</td>
                              <td className="px-3 py-3 text-gray-900 whitespace-nowrap">{rp(r.hargaRata)}</td>
                              <td className="px-3 py-3 text-gray-900">{r.lot}</td>
                              <td className="px-3 py-3 text-gray-900 whitespace-nowrap">{rp(r.modal)}</td>
                              <td className="px-3 py-3 whitespace-nowrap">
                                {r.hargaAkhir != null ? rp(r.hargaAkhir) : <span className="text-gray-400">—</span>}
                              </td>
                              <td className="px-3 py-3 whitespace-nowrap">{r.nilaiPasar != null ? rp(r.nilaiPasar) : <span className="text-gray-400">—</span>}</td>
                              <td className={`px-3 py-3 font-semibold whitespace-nowrap ${glC(r.glRp)}`}>{r.glRp != null ? rp(r.glRp) : '—'}</td>
                              <td className={`px-3 py-3 font-semibold whitespace-nowrap ${glC(r.glPct)}`}>{r.glPct != null ? pct(r.glPct) : '—'}</td>
                              <td className="px-3 py-3 whitespace-nowrap">
                                <span className={`px-2 py-0.5 rounded text-xs font-bold ${glBadge(r.glPct)}`}>{glLabel(r.glPct)}</span>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  {/* Tabel per akun */}
                  <div className="bg-white shadow sm:rounded-lg overflow-hidden mb-6">
                    <div className="px-4 py-3 border-b border-gray-100">
                      <p className="text-xs font-bold text-gray-500 uppercase tracking-wider">Rekap Per Akun Sekuritas</p>
                    </div>
                    <div className="overflow-x-auto">
                      <table className="min-w-full text-sm divide-y divide-gray-100">
                        <thead className="bg-gray-50">
                          <tr>
                            {['Akun Sekuritas','Jml Saham','Total Modal','Total Nilai Pasar','G/L (Rp)','G/L (%)','Status'].map(h => (
                              <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider whitespace-nowrap">{h}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                          {akunRows.map(a => (
                            <tr key={a.keterangan} className="hover:bg-gray-50">
                              <td className="px-4 py-3 font-medium text-gray-900 whitespace-nowrap">{a.keterangan}</td>
                              <td className="px-4 py-3 text-gray-600 text-center">{a.count}</td>
                              <td className="px-4 py-3 text-gray-900 whitespace-nowrap">{rp(a.modal)}</td>
                              <td className="px-4 py-3 text-gray-900 whitespace-nowrap">{rp(a.nilaiPasar)}</td>
                              <td className={`px-4 py-3 font-semibold whitespace-nowrap ${glC(a.glRp)}`}>{rp(a.glRp)}</td>
                              <td className={`px-4 py-3 font-semibold whitespace-nowrap ${glC(a.glPct)}`}>{pct(a.glPct)}</td>
                              <td className="px-4 py-3">
                                <span className={`px-2 py-0.5 rounded text-xs font-bold ${glBadge(a.glPct)}`}>{glLabel(a.glPct)}</span>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  {/* Chart tren G/L dari jurnal */}
                  {glJournals.length > 0 && (
                    <div className="bg-white rounded-lg shadow p-4 mb-6">
                      <div className="flex items-center justify-between mb-3">
                        <p className="text-xs font-bold text-gray-500 uppercase tracking-wider">Tren Floating G/L dari Jurnal</p>
                        <select value={glJournalYear} onChange={e => setGlJournalYear(Number(e.target.value))}
                          className="border border-gray-300 rounded px-2 py-1 text-xs">
                          {availYears.map(y => <option key={y} value={y}>{y}</option>)}
                        </select>
                      </div>
                      <div style={{ height: 220 }}>
                        <ResponsiveContainer width="100%" height="100%">
                          <LineChart data={chartGlData} margin={{ top: 5, right: 10, left: 0, bottom: 0 }}>
                            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                            <XAxis dataKey="date" tick={{ fontSize: 10 }} />
                            <YAxis tick={{ fontSize: 10 }} tickFormatter={v => `${v >= 0 ? '+' : ''}${v}rb`} width={60} />
                            <Tooltip
                              formatter={(v: number, name: string) => [
                                `${v >= 0 ? '+' : ''}Rp ${(v * 1000).toLocaleString('id-ID')}`,
                                name === 'gl' ? 'Floating G/L' : name
                              ]}
                            />
                            <Line type="monotone" dataKey="gl" name="gl" stroke={chartGlColor} strokeWidth={2} dot={false} />
                          </LineChart>
                        </ResponsiveContainer>
                      </div>
                    </div>
                  )}

                  {/* Tabel riwayat jurnal dengan ΔG/L */}
                  {glJournals.length > 0 && (() => {
                    const sorted     = [...glJournals].reverse()
                    const totalPagesGl = Math.ceil(sorted.length / JOURNAL_PAGE_SIZE)
                    const pagedGl    = sorted.slice((journalPage - 1) * JOURNAL_PAGE_SIZE, journalPage * JOURNAL_PAGE_SIZE)
                    return (
                      <div className="bg-white shadow sm:rounded-lg overflow-hidden">
                        <div className="px-4 py-3 border-b border-gray-100">
                          <p className="text-xs font-bold text-gray-500 uppercase tracking-wider">Riwayat G/L dari Jurnal</p>
                        </div>
                        <div className="overflow-x-auto">
                          <table className="min-w-full text-sm divide-y divide-gray-100">
                            <thead className="bg-gray-50">
                              <tr>
                                {['No','Tanggal','Total Modal','Nilai Pasar','G/L (Rp)','G/L (%)','ΔG/L'].map(h => (
                                  <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider whitespace-nowrap">{h}</th>
                                ))}
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100">
                              {pagedGl.map((j, idx) => {
                                const globalIdx = sorted.indexOf(j)
                                const prevJ     = sorted[globalIdx + 1]
                                const delta     = prevJ != null ? j.totalFloatRp - prevJ.totalFloatRp : null
                                return (
                                  <tr key={j.id} className="hover:bg-gray-50">
                                    <td className="px-4 py-3 text-gray-400 text-xs">{(journalPage - 1) * JOURNAL_PAGE_SIZE + idx + 1}</td>
                                    <td className="px-4 py-3 font-medium text-gray-900 whitespace-nowrap">{fmtDate(j.journalDate)}</td>
                                    <td className="px-4 py-3 text-gray-700 whitespace-nowrap">{rp(j.totalModal)}</td>
                                    <td className="px-4 py-3 text-gray-700 whitespace-nowrap">{rp(j.totalNilaiPasar)}</td>
                                    <td className={`px-4 py-3 font-semibold whitespace-nowrap ${glC(j.totalFloatRp)}`}>{rp(j.totalFloatRp)}</td>
                                    <td className={`px-4 py-3 font-semibold whitespace-nowrap ${glC(j.totalFloatPct)}`}>{pct(j.totalFloatPct)}</td>
                                    <td className={`px-4 py-3 font-semibold whitespace-nowrap ${glC(delta)}`}>
                                      {delta != null ? `${delta >= 0 ? '+' : ''}${rp(delta)}` : <span className="text-gray-300">—</span>}
                                    </td>
                                  </tr>
                                )
                              })}
                            </tbody>
                          </table>
                        </div>
                        {totalPagesGl > 1 && (
                          <div className="bg-white px-4 py-3 flex items-center justify-between border-t border-gray-100">
                            <div className="text-sm text-gray-700">
                              Menampilkan <span className="font-medium">{(journalPage - 1) * JOURNAL_PAGE_SIZE + 1}</span>
                              {' '}–{' '}
                              <span className="font-medium">{Math.min(journalPage * JOURNAL_PAGE_SIZE, sorted.length)}</span>
                              {' '}dari <span className="font-medium">{sorted.length}</span> jurnal
                            </div>
                            <div className="flex gap-1">
                              <button onClick={() => setJournalPage(1)} disabled={journalPage === 1} className="px-2 py-1 text-sm border rounded disabled:opacity-40 hover:bg-gray-50">«</button>
                              <button onClick={() => setJournalPage(p => p - 1)} disabled={journalPage === 1} className="px-3 py-1 text-sm border rounded disabled:opacity-40 hover:bg-gray-50">Prev</button>
                              {Array.from({ length: totalPagesGl }, (_, i) => i + 1).filter(p => Math.abs(p - journalPage) <= 2).map(p => (
                                <button key={p} onClick={() => setJournalPage(p)}
                                  className={`px-3 py-1 text-sm border rounded ${p === journalPage ? 'bg-indigo-600 text-white border-indigo-600' : 'hover:bg-gray-50'}`}>{p}</button>
                              ))}
                              <button onClick={() => setJournalPage(p => p + 1)} disabled={journalPage === totalPagesGl} className="px-3 py-1 text-sm border rounded disabled:opacity-40 hover:bg-gray-50">Next</button>
                              <button onClick={() => setJournalPage(totalPagesGl)} disabled={journalPage === totalPagesGl} className="px-2 py-1 text-sm border rounded disabled:opacity-40 hover:bg-gray-50">»</button>
                            </div>
                          </div>
                        )}
                      </div>
                    )
                  })()}
                </>
              )}
            </div>
          )
        })()}

        {/* ── TAB PORTOFOLIO ──────────────────────────────────────────────── */}
        {activeTab === 'portofolio' && <>

        {/* Filter */}
        <div className="mb-4 flex items-center gap-3">
          <select
            value={filterKet}
            onChange={e => setFilterKet(e.target.value)}
            className="border border-gray-300 rounded-md px-3 py-1.5 text-sm focus:ring-indigo-500 focus:border-indigo-500"
          >
            <option value="">Semua Akun Sekuritas</option>
            {keterangans.map(k => <option key={k} value={k}>{k}</option>)}
          </select>
          {filterKet && (
            <button onClick={() => setFilterKet('')}
              className="px-3 py-1.5 bg-gray-100 text-gray-600 text-sm rounded-md hover:bg-gray-200">
              Reset
            </button>
          )}
          <span className="ml-auto text-xs text-gray-400">{filtered.length} posisi</span>
        </div>


        {/* Table */}
        <div className="bg-white shadow sm:rounded-lg overflow-hidden">
          {loadingData ? (
            <div className="p-12 text-center text-gray-500">Memuat data...</div>
          ) : filtered.length === 0 ? (
            <div className="p-12 text-center text-gray-500">
              Belum ada posisi. Klik{' '}
              <span className="font-semibold text-indigo-600">Tambah Posisi</span> untuk mulai.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200 text-sm">
                <thead className="bg-gray-50">
                  <tr>
                    {['No','Akun Sekuritas','Saham','Avg Price','Lot','Modal','Harga Terakhir','Nilai Pasar','Floating P/L (Rp)','Floating P/L (%)','Aksi'].map(h => (
                      <th key={h} className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {filtered.map((row, idx) => {
                    const { modal, hargaAkhir, isCache, cacheAt, nilaiPasar, floatRp, floatPct } = calc(row)
                    return (
                      <tr key={row.id} className={rowBg(floatRp)}>
                        <td className="px-4 py-3 text-gray-500">{idx + 1}</td>
                        <td className="px-4 py-3 font-medium text-gray-900 whitespace-nowrap">{row.keterangan}</td>
                        <td className="px-4 py-3 whitespace-nowrap">
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold bg-indigo-100 text-indigo-800">
                            {row.saham}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-gray-900 whitespace-nowrap">{rp(row.hargaRata)}</td>
                        <td className="px-4 py-3 text-gray-900">{row.lot}</td>
                        <td className="px-4 py-3 text-gray-900 whitespace-nowrap">{rp(modal)}</td>
                        <td className="px-4 py-3 whitespace-nowrap">
                          {loadingPrice
                            ? <span className="text-gray-400 text-xs">memuat...</span>
                            : hargaAkhir != null
                              ? rp(hargaAkhir)
                              : <span className="text-gray-400">—</span>}
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap">
                          {nilaiPasar != null ? rp(nilaiPasar) : <span className="text-gray-400">—</span>}
                        </td>
                        <td className={`px-4 py-3 font-semibold whitespace-nowrap ${floatColor(floatRp)}`}>
                          {floatRp != null ? rp(floatRp) : '—'}
                        </td>
                        <td className={`px-4 py-3 font-semibold whitespace-nowrap ${floatColor(floatPct)}`}>
                          {floatPct != null ? pct(floatPct) : '—'}
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-3">
                            <button onClick={() => openEdit(row)}
                              className="text-xs text-indigo-600 hover:text-indigo-800 font-medium">Edit</button>
                            <button
                              onClick={() => handleDelete(row.id)}
                              disabled={deletingId === row.id}
                              className="text-xs text-red-600 hover:text-red-800 disabled:opacity-50">
                              {deletingId === row.id ? '...' : 'Hapus'}
                            </button>
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
        </>}
      </div>

      {/* Modal tambah/edit posisi */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="fixed inset-0 bg-black/40" onClick={closeModal} />
          <div className="relative z-50 bg-white rounded-xl shadow-2xl w-full max-w-md mx-4 p-6">
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-lg font-bold text-gray-900">
                {editItem ? 'Edit Posisi' : 'Tambah Posisi'}
              </h2>
              <button onClick={closeModal} className="text-gray-400 hover:text-gray-600">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="space-y-4">

              {/* Akun Sekuritas — searchable combobox dari tabel securities */}
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">
                  Akun Sekuritas <span className="text-red-500">*</span>
                </label>

                {securities.length === 0 ? (
                  <div className="rounded-md bg-amber-50 border border-amber-200 px-3 py-2 text-xs text-amber-800">
                    Belum ada sekuritas aktif.{' '}
                    <a href="/securities" className="font-semibold underline hover:text-amber-900">
                      Daftarkan sekuritas
                    </a>{' '}
                    terlebih dahulu.
                  </div>
                ) : (
                  <div className="relative">
                    {/* Trigger */}
                    <button
                      type="button"
                      onClick={() => setSecDropdownOpen(o => !o)}
                      className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm text-left flex items-center justify-between focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500"
                    >
                      <span className={selectedSecId ? 'text-gray-900' : 'text-gray-400'}>
                        {selectedSecId
                          ? securities.find(s => s.id === selectedSecId)?.nama
                          : '-- Pilih Akun Sekuritas --'}
                      </span>
                      <svg className={`w-4 h-4 text-gray-400 transition-transform ${secDropdownOpen ? 'rotate-180' : ''}`}
                        fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                      </svg>
                    </button>

                    {/* Dropdown */}
                    {secDropdownOpen && (
                      <>
                        <div className="absolute z-50 mt-1 w-full bg-white border border-gray-200 rounded-md shadow-lg">
                          <div className="p-2 border-b border-gray-100">
                            <input
                              autoFocus
                              type="text"
                              value={secSearch}
                              onChange={e => setSecSearch(e.target.value)}
                              placeholder="Cari sekuritas..."
                              className="w-full border border-gray-300 rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-indigo-500"
                            />
                          </div>
                          <ul className="max-h-48 overflow-y-auto">
                            {securities.filter(s => s.nama.toLowerCase().includes(secSearch.toLowerCase())).length === 0 ? (
                              <li className="px-3 py-2 text-sm text-gray-400 text-center">Sekuritas tidak ditemukan</li>
                            ) : (
                              securities
                                .filter(s => s.nama.toLowerCase().includes(secSearch.toLowerCase()))
                                .map(s => (
                                  <li key={s.id}
                                    onClick={() => handleSecSelect(s)}
                                    className={`px-3 py-2 text-sm cursor-pointer hover:bg-indigo-50 hover:text-indigo-700 ${
                                      selectedSecId === s.id ? 'bg-indigo-50 text-indigo-700 font-medium' : 'text-gray-900'
                                    }`}
                                  >
                                    {s.nama}
                                  </li>
                                ))
                            )}
                          </ul>
                        </div>
                        <div className="fixed inset-0 z-40"
                          onClick={() => { setSecDropdownOpen(false); setSecSearch('') }} />
                      </>
                    )}
                  </div>
                )}
              </div>

              {/* Kode Saham */}
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">
                  Kode Saham <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={form.saham}
                  onChange={e => setForm(f => ({ ...f, saham: e.target.value.toUpperCase() }))}
                  placeholder="cth: BBRI"
                  className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:ring-indigo-500 focus:border-indigo-500"
                />
                <p className="text-xs text-gray-400 mt-0.5">Kode BEI — otomatis tambah .JK saat cek harga</p>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">
                    Avg Price (Rp/lembar) <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="number"
                    value={form.hargaRata}
                    onChange={e => setForm(f => ({ ...f, hargaRata: e.target.value }))}
                    placeholder="4500"
                    className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:ring-indigo-500 focus:border-indigo-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">
                    Lot <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="number"
                    value={form.lot}
                    onChange={e => setForm(f => ({ ...f, lot: e.target.value }))}
                    placeholder="50"
                    className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:ring-indigo-500 focus:border-indigo-500"
                  />
                </div>
              </div>

              {/* Preview modal */}
              {form.hargaRata && form.lot && (
                <div className="rounded-md bg-gray-50 border border-gray-200 px-3 py-2 text-xs text-gray-600">
                  Modal:{' '}
                  <span className="font-semibold text-gray-900">
                    {rp(parseFloat(form.hargaRata || '0') * parseInt(form.lot || '0') * 100)}
                  </span>
                </div>
              )}
            </div>

            <div className="mt-6 flex gap-3 justify-end">
              <button onClick={closeModal}
                className="px-4 py-2 text-sm font-medium text-gray-700 border border-gray-300 rounded-md hover:bg-gray-50">
                Batal
              </button>
              <button
                onClick={handleSave}
                disabled={saving || !canSave}
                className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-md hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {saving ? 'Menyimpan...' : editItem ? 'Simpan Perubahan' : 'Tambah'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal konfirmasi buat jurnal */}
      {showConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="fixed inset-0 bg-black/40" onClick={() => setShowConfirm(false)} />
          <div className="relative z-50 bg-white rounded-xl shadow-2xl w-full max-w-lg mx-4 p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-base font-bold text-gray-900">
                Konfirmasi Jurnal — {new Date().toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Asia/Jakarta' })}
              </h2>
              <button onClick={() => setShowConfirm(false)} className="text-gray-400 hover:text-gray-600">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Summary preview */}
            {(() => {
              const totalM  = previewData.reduce((s, d) => s + d.modal, 0)
              const totalNP = previewData.reduce((s, d) => s + (d.nilaiPasar ?? d.modal), 0)
              const totalF  = totalNP - totalM
              const totalFP = totalM > 0 ? (totalF / totalM) * 100 : 0
              return (
                <div className="bg-gray-50 rounded-lg p-3 mb-4 grid grid-cols-2 gap-2 text-sm">
                  <div><span className="text-gray-500">Total Modal:</span> <span className="font-semibold">{rp(totalM)}</span></div>
                  <div><span className="text-gray-500">Nilai Pasar:</span> <span className="font-semibold">{rp(totalNP)}</span></div>
                  <div><span className="text-gray-500">Floating P/L:</span> <span className={`font-semibold ${floatColor(totalF)}`}>{rp(totalF)}</span></div>
                  <div><span className="text-gray-500">Float %:</span> <span className={`font-semibold ${floatColor(totalFP)}`}>{pct(totalFP)}</span></div>
                </div>
              )
            })()}

            {/* Detail per saham */}
            <div className="max-h-48 overflow-y-auto mb-4">
              <table className="min-w-full text-xs">
                <thead className="bg-gray-50 sticky top-0">
                  <tr>
                    {['Saham','Akun','Avg','Lot','Harga Skrg','Float%'].map(h => (
                      <th key={h} className="px-2 py-1.5 text-left font-semibold text-gray-500">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {previewData.map((d, i) => (
                    <tr key={i} className="hover:bg-gray-50">
                      <td className="px-2 py-1.5 font-bold text-indigo-700">{d.saham}</td>
                      <td className="px-2 py-1.5 text-gray-600">{d.keterangan}</td>
                      <td className="px-2 py-1.5">{rp(d.hargaRata)}</td>
                      <td className="px-2 py-1.5">{d.lot}</td>
                      <td className="px-2 py-1.5">{d.hargaTerakhir != null ? rp(d.hargaTerakhir) : '—'}</td>
                      <td className={`px-2 py-1.5 font-semibold ${floatColor(d.floatPct)}`}>
                        {d.floatPct != null ? pct(d.floatPct) : '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <p className="text-xs text-gray-400 mb-4">Harga diambil dari Yahoo Finance saat tombol diklik. Jurnal bersifat permanen dan tidak dapat diedit.</p>

            <div className="flex gap-3 justify-end">
              <button onClick={() => setShowConfirm(false)}
                className="px-4 py-2 text-sm text-gray-700 border border-gray-300 rounded-md hover:bg-gray-50">
                Batal
              </button>
              <button onClick={handleKonfirmasiJurnal} disabled={savingJournal}
                className="px-4 py-2 text-sm font-semibold text-white bg-indigo-600 rounded-md hover:bg-indigo-700 disabled:opacity-50">
                {savingJournal ? 'Menyimpan...' : 'Simpan Jurnal'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal detail jurnal */}
      {detailJournal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="fixed inset-0 bg-black/40" onClick={() => setDetailJournal(null)} />
          <div className="relative z-50 bg-white rounded-xl shadow-2xl w-full max-w-2xl mx-4 p-6">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-base font-bold text-gray-900">Detail Jurnal</h2>
                <p className="text-xs text-gray-500">{fmtDate(detailJournal.journalDate)}</p>
              </div>
              <button onClick={() => setDetailJournal(null)} className="text-gray-400 hover:text-gray-600">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="bg-gray-50 rounded-lg p-3 mb-4 grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
              {[
                { l: 'Modal', v: rp(detailJournal.totalModal), c: 'text-gray-900' },
                { l: 'Nilai Pasar', v: rp(detailJournal.totalNilaiPasar), c: 'text-gray-900' },
                { l: 'Float P/L', v: rp(detailJournal.totalFloatRp), c: floatColor(detailJournal.totalFloatRp) },
                { l: 'Float %', v: pct(detailJournal.totalFloatPct), c: floatColor(detailJournal.totalFloatPct) },
              ].map(x => (
                <div key={x.l}>
                  <p className="text-gray-500">{x.l}</p>
                  <p className={`font-bold ${x.c}`}>{x.v}</p>
                </div>
              ))}
            </div>
            <div className="overflow-x-auto max-h-64 overflow-y-auto">
              <table className="min-w-full text-xs">
                <thead className="bg-gray-50 sticky top-0">
                  <tr>
                    {['Akun','Saham','Avg Price','Lot','Modal','Harga Saat Jurnal','Nilai Pasar','Float P/L','Float %'].map(h => (
                      <th key={h} className="px-3 py-2 text-left font-semibold text-gray-500 whitespace-nowrap">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {(JSON.parse(detailJournal.detail) as JournalDetail[]).map((d, i) => (
                    <tr key={i} className="hover:bg-gray-50">
                      <td className="px-3 py-2 text-gray-700 whitespace-nowrap">{d.keterangan}</td>
                      <td className="px-3 py-2 font-bold text-indigo-700">{d.saham}</td>
                      <td className="px-3 py-2 whitespace-nowrap">{rp(d.hargaRata)}</td>
                      <td className="px-3 py-2">{d.lot}</td>
                      <td className="px-3 py-2 whitespace-nowrap">{rp(d.modal)}</td>
                      <td className="px-3 py-2 whitespace-nowrap">{d.hargaTerakhir != null ? rp(d.hargaTerakhir) : '—'}</td>
                      <td className="px-3 py-2 whitespace-nowrap">{d.nilaiPasar != null ? rp(d.nilaiPasar) : '—'}</td>
                      <td className={`px-3 py-2 font-semibold whitespace-nowrap ${floatColor(d.floatRp)}`}>
                        {d.floatRp != null ? rp(d.floatRp) : '—'}
                      </td>
                      <td className={`px-3 py-2 font-semibold whitespace-nowrap ${floatColor(d.floatPct)}`}>
                        {d.floatPct != null ? pct(d.floatPct) : '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
