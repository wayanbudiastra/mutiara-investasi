'use client'

import { useState, useEffect, useCallback, Suspense } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter, useSearchParams } from 'next/navigation'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from 'recharts'
import { ProGate } from '@/components/ProGate'

const MONTHS = [
  'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
  'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember',
]

const YEAR_COLORS = ['#3B82F6', '#EF4444', '#EAB308', '#10B981', '#8B5CF6', '#F97316', '#06B6D4']

interface Dividend {
  id: string
  bulan: string
  tahun: number
  saham: string
  dividen: number
  lot: number
  total: number
  keterangan: string
  status: 'ESTIMASI' | 'DONE'
  createdAt: string
}

interface Security {
  id: string
  userId: string
  nama: string
  kode: string
  status: 'ACTIVE' | 'INACTIVE'
}

interface PortfolioRow {
  id: string
  keterangan: string
  saham: string
  hargaRata: number
  lot: number
}

interface EstimateOverride {
  id: string
  saham: string
  dividenPerLembar: number
  catatan: string | null
}

const emptyForm = {
  bulan: 'Januari',
  tahun: new Date().getFullYear(),
  saham: '',
  dividen: '',
  lot: '',
  keterangan: '',
  status: 'ESTIMASI' as 'ESTIMASI' | 'DONE',
}

function DividendsContent() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const searchParams = useSearchParams()

  const [proAccess, setProAccess] = useState<{ hasAccess: boolean; isAdmin: boolean } | null>(null)
  const [dividends, setDividends] = useState<Dividend[]>([])
  const [securities, setSecurities] = useState<Security[]>([])
  const [loading, setLoading] = useState(false)
  const [refreshingCache, setRefreshingCache] = useState(false)
  const [activeTab, setActiveTab] = useState<'data' | 'rekap' | 'sekuritas' | 'saham' | 'estimasi'>('data')
  const [portfolioRows, setPortfolioRows] = useState<PortfolioRow[]>([])
  const [rekapSahamPeriod, setRekapSahamPeriod] = useState<'1' | '3' | '5' | 'all'>('all')
  const [estimasiBannerCollapsed, setEstimasiBannerCollapsed] = useState(false)
  const [estimateOverrides, setEstimateOverrides] = useState<EstimateOverride[]>([])
  const [editingOverrideSaham, setEditingOverrideSaham] = useState<string | null>(null)
  const [overrideInputValue, setOverrideInputValue] = useState('')
  const [savingOverride, setSavingOverride] = useState(false)
  const [showValidasiModal, setShowValidasiModal] = useState(false)
  const [selectedRekapKet, setSelectedRekapKet] = useState('')
  const [showModal, setShowModal] = useState(false)
  const [editItem, setEditItem] = useState<Dividend | null>(null)
  const [form, setForm] = useState(emptyForm)
  const [selectedSecurityId, setSelectedSecurityId] = useState('')
  const [secSearch, setSecSearch] = useState('')
  const [secDropdownOpen, setSecDropdownOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [filterSaham, setFilterSaham] = useState('')
  const [filterStatus, setFilterStatus] = useState<'ALL' | 'ESTIMASI' | 'DONE'>('ALL')
  const [page, setPage] = useState(1)
  const PAGE_SIZE = 10

  useEffect(() => {
    const param = searchParams.get('filterSaham')
    if (param) setFilterSaham(param)
  }, [searchParams])

  useEffect(() => { setPage(1) }, [filterSaham, filterStatus])

  const fetchDividends = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/dividends', { cache: 'no-store' })
      if (res.ok) setDividends(await res.json())
    } finally {
      setLoading(false)
    }
  }, [])

  const fetchPortfolio = useCallback(async () => {
    try {
      const res = await fetch('/api/portfolio', { cache: 'no-store' })
      if (res.ok) setPortfolioRows(await res.json())
    } catch {
      // silently fail — tab Estimasi Dividen akan tampil kosong
    }
  }, [])

  const fetchEstimateOverrides = useCallback(async () => {
    try {
      const res = await fetch('/api/dividends/estimate-overrides', { cache: 'no-store' })
      if (res.ok) setEstimateOverrides(await res.json())
    } catch {
      // silently fail — tab Estimasi Dividen tetap tampilkan nilai otomatis
    }
  }, [])

  const openOverrideEditor = useCallback((saham: string, currentValue: number | null) => {
    setEditingOverrideSaham(saham)
    setOverrideInputValue(currentValue !== null ? String(currentValue) : '')
  }, [])

  const cancelOverrideEditor = useCallback(() => {
    setEditingOverrideSaham(null)
    setOverrideInputValue('')
  }, [])

  const saveOverride = useCallback(async (saham: string) => {
    const value = Number(overrideInputValue)
    if (!overrideInputValue || !Number.isFinite(value) || value < 0) return
    setSavingOverride(true)
    try {
      const res = await fetch('/api/dividends/estimate-overrides', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ saham, dividenPerLembar: value }),
      })
      if (res.ok) {
        await fetchEstimateOverrides()
        setEditingOverrideSaham(null)
        setOverrideInputValue('')
      }
    } finally {
      setSavingOverride(false)
    }
  }, [overrideInputValue, fetchEstimateOverrides])

  const resetOverride = useCallback(async (saham: string) => {
    setSavingOverride(true)
    try {
      const res = await fetch(`/api/dividends/estimate-overrides?saham=${encodeURIComponent(saham)}`, { method: 'DELETE' })
      if (res.ok) await fetchEstimateOverrides()
    } finally {
      setSavingOverride(false)
    }
  }, [fetchEstimateOverrides])

  const handleRefreshCache = useCallback(async () => {
    setRefreshingCache(true)
    try {
      await fetch('/api/dividends/revalidate', { method: 'POST' })
      await fetchDividends()
    } finally {
      setRefreshingCache(false)
    }
  }, [fetchDividends])

  const fetchSecurities = useCallback(async (userId: string) => {
    try {
      // fetch all active securities (limit 100 is enough for a dropdown)
      const res = await fetch(`/api/securities?userId=${userId}&limit=100`)
      if (res.ok) {
        const json = await res.json()
        const list: Security[] = json.securities ?? json
        setSecurities(list.filter(s => s.status === 'ACTIVE'))
      }
    } catch {
      // silently fail — form will just show manual inputs
    }
  }, [])

  useEffect(() => {
    if (status === 'unauthenticated') router.push('/login')
  }, [status, router])

  useEffect(() => {
    if (status === 'authenticated') {
      fetch('/api/subscription/status').then(r => r.json()).then(setProAccess)
      fetchDividends()
      fetchPortfolio()
      fetchEstimateOverrides()
      const userId = (session?.user as any)?.id
      if (userId) fetchSecurities(userId)
    }
  }, [status, session, fetchDividends, fetchPortfolio, fetchEstimateOverrides, fetchSecurities])

  const openAdd = () => {
    setEditItem(null)
    setForm(emptyForm)
    setSelectedSecurityId('')
    setSecSearch('')
    setSecDropdownOpen(false)
    setShowModal(true)
  }

  const openEdit = (d: Dividend) => {
    setEditItem(d)
    setForm({
      bulan: d.bulan,
      tahun: d.tahun,
      saham: d.saham,
      dividen: String(d.dividen),
      lot: String(d.lot),
      keterangan: d.keterangan,
      status: d.status,
    })
    // pre-select matching security by nama (broker account)
    const match = securities.find(s => s.nama === d.keterangan)
    setSelectedSecurityId(match?.id ?? '')
    setSecSearch('')
    setSecDropdownOpen(false)
    setShowModal(true)
  }

  const closeModal = () => {
    setShowModal(false)
    setEditItem(null)
    setSecSearch('')
    setSecDropdownOpen(false)
  }

  const handleSecuritySelect = (secId: string) => {
    setSelectedSecurityId(secId)
    const sec = securities.find(s => s.id === secId)
    // only fill keterangan (broker name); saham (stock code) stays manual
    setForm(f => ({ ...f, keterangan: sec?.nama ?? '' }))
  }

  const computedTotal = () => {
    const div = parseFloat(String(form.dividen)) || 0
    const lot = parseInt(String(form.lot)) || 0
    return div * lot * 100
  }

  const handleSave = async () => {
    if (!form.saham || !form.dividen || !form.lot || !form.keterangan) return
    setSaving(true)
    try {
      const payload = {
        bulan: form.bulan,
        tahun: Number(form.tahun),
        saham: form.saham.toUpperCase(),
        dividen: parseFloat(String(form.dividen)),
        lot: parseInt(String(form.lot)),
        total: computedTotal(),
        keterangan: form.keterangan.toUpperCase(),
        status: form.status,
      }
      const url = editItem ? `/api/dividends/${editItem.id}` : '/api/dividends'
      const method = editItem ? 'PUT' : 'POST'
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      if (res.ok) {
        closeModal()
        fetchDividends()
      }
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Hapus data dividen ini?')) return
    setDeletingId(id)
    try {
      const res = await fetch(`/api/dividends/${id}`, { method: 'DELETE' })
      if (res.ok) fetchDividends()
    } finally {
      setDeletingId(null)
    }
  }

  const filtered = dividends.filter(d => {
    const matchSaham = !filterSaham || d.saham.includes(filterSaham.toUpperCase())
    const matchStatus = filterStatus === 'ALL' || d.status === filterStatus
    return matchSaham && matchStatus
  })

  const totalPages = Math.ceil(filtered.length / PAGE_SIZE)
  const pagedFiltered = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)

  // Chart — only DONE entries
  const doneDividends = dividends.filter(d => d.status === 'DONE')
  const years = (Array.from(new Set(doneDividends.map(d => d.tahun))).sort() as number[]).slice(-5)
  const keterangans = Array.from(new Set(doneDividends.map(d => d.keterangan)))

  const chartData = keterangans.map(ket => {
    const entry: Record<string, any> = { keterangan: ket }
    years.forEach(year => {
      entry[year] = doneDividends
        .filter(d => d.keterangan === ket && d.tahun === year)
        .reduce((sum, d) => sum + Number(d.total), 0)
    })
    return entry
  })

  // Rekap By Sekuritas — computed values
  const rekapKets = Array.from(new Set(doneDividends.map(d => d.keterangan))).sort()
  const rekapFiltered = selectedRekapKet
    ? doneDividends.filter(d => d.keterangan === selectedRekapKet)
    : []
  const rekapYears = (Array.from(new Set(rekapFiltered.map(d => d.tahun))).sort() as number[]).slice(-5)
  const rekapSahams = Array.from(new Set(rekapFiltered.map(d => d.saham))).sort()
  const rekapTableData = rekapSahams.map(saham => {
    const entry: Record<string, any> = { saham }
    rekapYears.forEach(y => {
      entry[y] = rekapFiltered
        .filter(d => d.saham === saham && d.tahun === y)
        .reduce((sum, d) => sum + Number(d.total), 0)
    })
    return entry
  })

  const currentYear = new Date().getFullYear()

  // Rekap By Saham — semua saham (lintas akun & tahun), diurutkan dari total dividen terbesar
  const REKAP_SAHAM_PERIOD_YEARS = { '1': 1, '3': 3, '5': 5 } as const
  const rekapSahamDividends = rekapSahamPeriod === 'all'
    ? doneDividends
    : doneDividends.filter(d => d.tahun > currentYear - REKAP_SAHAM_PERIOD_YEARS[rekapSahamPeriod])
  const rekapSahamData = Object.values(
    rekapSahamDividends.reduce((acc, d) => {
      if (!acc[d.saham]) acc[d.saham] = { saham: d.saham, total: 0, count: 0, tahunSet: new Set<number>(), ketSet: new Set<string>() }
      acc[d.saham].total += Number(d.total)
      acc[d.saham].count += 1
      acc[d.saham].tahunSet.add(d.tahun)
      acc[d.saham].ketSet.add(d.keterangan)
      return acc
    }, {} as Record<string, { saham: string; total: number; count: number; tahunSet: Set<number>; ketSet: Set<string> }>)
  )
    .map(r => ({ saham: r.saham, total: r.total, count: r.count, tahunCount: r.tahunSet.size, ketCount: r.ketSet.size }))
    .sort((a, b) => b.total - a.total)
  const rekapSahamTotal = rekapSahamData.reduce((s, r) => s + r.total, 0)

  // Estimasi Dividen Tahun Depan — dividen/lembar tahun terakhir (DONE) dikalikan
  // lot yang dimiliki SAAT INI di Portofolio (bukan lot saat dividen historis diterima)
  const nextYear = currentYear + 1
  const portfolioLotMap = portfolioRows.reduce((acc, r) => {
    acc[r.saham] = (acc[r.saham] ?? 0) + r.lot
    return acc
  }, {} as Record<string, number>)

  const dividendByStockYear = doneDividends.reduce((acc, d) => {
    if (!acc[d.saham]) acc[d.saham] = {}
    acc[d.saham][d.tahun] = (acc[d.saham][d.tahun] ?? 0) + Number(d.dividen)
    return acc
  }, {} as Record<string, Record<number, number>>)

  const overrideMap = estimateOverrides.reduce((acc, o) => {
    acc[o.saham] = o
    return acc
  }, {} as Record<string, EstimateOverride>)

  // Setiap saham yang lot-nya > 0 di Portofolio SELALU muncul di tabel Estimasi Dividen — baik
  // yang punya riwayat DONE (dihitung otomatis) maupun yang belum (menunggu diisi manual). Kalau
  // user sudah menyimpan override manual untuk saham itu, nilai manual SELALU menang atas hasil
  // otomatis — inilah mekanisme "koreksi data" yang diminta karena riwayat DONE bisa saja salah/tidak lengkap.
  const estimasiDividenData = Object.entries(portfolioLotMap)
    .filter(([, lot]) => lot > 0)
    .map(([saham, lot]) => {
      const yearsMap = dividendByStockYear[saham]
      const override = overrideMap[saham]
      const hasAutoHistory = !!yearsMap

      let yearUsed: number | null = null
      let isFallbackYear = false
      let autoDividenPerLembar: number | null = null
      let anomali: { avgTahunLain: number; deviasiPct: number } | null = null

      if (yearsMap) {
        const yearsAvailable = Object.keys(yearsMap).map(Number).sort((a, b) => b - a)
        const lastFullYear = yearsAvailable.find(y => y === currentYear - 1)
        yearUsed = lastFullYear ?? yearsAvailable[0]
        isFallbackYear = yearUsed !== currentYear - 1
        autoDividenPerLembar = yearsMap[yearUsed]

        // Deteksi anomali: bandingkan dividen/lembar tahun acuan vs rata-rata tahun lain yang tersedia
        const otherYears = yearsAvailable.filter(y => y !== yearUsed)
        if (otherYears.length > 0) {
          const avgTahunLain = otherYears.reduce((s, y) => s + yearsMap[y], 0) / otherYears.length
          const deviasiPct = avgTahunLain > 0 ? ((autoDividenPerLembar - avgTahunLain) / avgTahunLain) * 100 : 0
          if (Math.abs(deviasiPct) > 50) anomali = { avgTahunLain, deviasiPct }
        }
      }

      const isManualOverride = !!override
      const dividenPerLembar = isManualOverride ? override.dividenPerLembar : autoDividenPerLembar
      const needsInput = dividenPerLembar === null

      return {
        saham,
        lot,
        yearUsed,
        isFallbackYear,
        dividenPerLembar,
        autoDividenPerLembar,
        hasAutoHistory,
        isManualOverride,
        needsInput,
        anomali: isManualOverride ? null : anomali,
        estimasi: dividenPerLembar !== null ? dividenPerLembar * lot * 100 : 0,
      }
    })
    .sort((a, b) => b.estimasi - a.estimasi)

  const totalEstimasiDividenTahunDepan = estimasiDividenData.reduce((s, r) => s + r.estimasi, 0)
  const sahamTanpaRiwayat = estimasiDividenData.filter(r => r.needsInput).map(r => r.saham)
  const sahamAnomali = estimasiDividenData.filter(r => r.anomali)

  const totalDone = doneDividends
    .filter(d => d.tahun === currentYear)
    .reduce((s, d) => s + Number(d.total), 0)
  const totalEstimasi = dividends
    .filter(d => d.status === 'ESTIMASI' && d.tahun === currentYear)
    .reduce((s, d) => s + Number(d.total), 0)

  const rp = (v: number) => `Rp ${v.toLocaleString('id-ID')}`

  if (status === 'loading' || proAccess === null) return null
  if (!proAccess.hasAccess) return <ProGate />

  const canSave = !!(form.saham && form.dividen && form.lot && form.keterangan)

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="w-full px-6 lg:px-10">

        {/* Header */}
        <div className="mb-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Rekap Dividen</h1>
            <p className="mt-1 text-sm text-gray-500">{dividends.length} data tersimpan</p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handleRefreshCache}
              disabled={refreshingCache}
              title="Muat ulang data terbaru dari database (berguna setelah import massal via script)"
              className="inline-flex items-center gap-2 px-3 py-2 border border-gray-300 text-gray-700 text-sm font-medium rounded-md hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <svg className={`w-4 h-4 ${refreshingCache ? 'animate-spin' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
              {refreshingCache ? 'Memuat...' : 'Muat Ulang Data'}
            </button>
            <button
              onClick={openAdd}
              className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white text-sm font-medium rounded-md hover:bg-indigo-700"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
            Tambah Dividen
            </button>
          </div>
        </div>

        {/* Summary cards — Year To Date */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
          <div className="bg-white rounded-lg shadow p-4">
            <p className="text-xs text-gray-500 mb-1">Total Terealisasi {currentYear} (YTD)</p>
            <p className="text-xl font-bold text-green-600">{rp(totalDone)}</p>
          </div>
          <div className="bg-white rounded-lg shadow p-4">
            <p className="text-xs text-gray-500 mb-1">Total Estimasi {currentYear} (YTD)</p>
            <p className="text-xl font-bold text-orange-500">{rp(totalEstimasi)}</p>
          </div>
          <div className="bg-white rounded-lg shadow p-4">
            <p className="text-xs text-gray-500 mb-1">Total Keseluruhan {currentYear} (YTD)</p>
            <p className="text-xl font-bold text-indigo-600">{rp(totalDone + totalEstimasi)}</p>
          </div>
        </div>

        {/* Tabs */}
        <div className="border-b border-gray-200 mb-6">
          <nav className="flex gap-6">
            {([
              ['data', 'Data Dividen'],
              ['rekap', 'Rekap Chart'],
              ['sekuritas', 'Rekap By Sekuritas'],
              ['saham', 'Rekap By Saham'],
              ['estimasi', 'Estimasi Dividen'],
            ] as const).map(([tab, label]) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`pb-3 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
                  activeTab === tab
                    ? 'border-indigo-600 text-indigo-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700'
                }`}
              >
                {label}
              </button>
            ))}
          </nav>
        </div>

        {/* Data Tab */}
        {activeTab === 'data' && (
          <div className="bg-white shadow sm:rounded-lg overflow-hidden">
            <div className="p-4 border-b border-gray-200 flex flex-wrap gap-3 items-center">
              <input
                type="text"
                value={filterSaham}
                onChange={e => setFilterSaham(e.target.value)}
                placeholder="Filter kode saham..."
                className="border border-gray-300 rounded-md px-3 py-1.5 text-sm w-44 focus:ring-indigo-500 focus:border-indigo-500"
              />
              <select
                value={filterStatus}
                onChange={e => setFilterStatus(e.target.value as any)}
                className="border border-gray-300 rounded-md px-3 py-1.5 text-sm focus:ring-indigo-500 focus:border-indigo-500"
              >
                <option value="ALL">Semua Status</option>
                <option value="ESTIMASI">Estimasi</option>
                <option value="DONE">Done</option>
              </select>
              {(filterSaham || filterStatus !== 'ALL') && (
                <button
                  onClick={() => { setFilterSaham(''); setFilterStatus('ALL') }}
                  className="px-3 py-1.5 bg-gray-100 text-gray-600 text-sm rounded-md hover:bg-gray-200"
                >
                  Reset
                </button>
              )}
              <span className="ml-auto text-xs text-gray-400">{filtered.length} data</span>
            </div>

            {loading ? (
              <div className="p-12 text-center text-gray-500">Memuat data...</div>
            ) : filtered.length === 0 ? (
              <div className="p-12 text-center text-gray-500">Belum ada data dividen</div>
            ) : (
              <>
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        {['No', 'Bulan', 'Tahun', 'Saham', 'Dividen/Lembar', 'Lot', 'Total', 'Keterangan', 'Status', 'Aksi'].map(h => (
                          <th key={h} className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap">
                            {h}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {pagedFiltered.map((d, idx) => (
                        <tr
                          key={d.id}
                          className={d.status === 'DONE' ? 'bg-yellow-50 hover:bg-yellow-100' : 'bg-orange-50 hover:bg-orange-100'}
                        >
                          <td className="px-4 py-3 text-sm text-gray-500">{(page - 1) * PAGE_SIZE + idx + 1}</td>
                          <td className="px-4 py-3 text-sm text-gray-900">{d.bulan}</td>
                          <td className="px-4 py-3 text-sm text-gray-900">{d.tahun}</td>
                          <td className="px-4 py-3">
                            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold bg-indigo-100 text-indigo-800">
                              {d.saham}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-sm text-gray-900">{rp(Number(d.dividen))}</td>
                          <td className="px-4 py-3 text-sm text-gray-900">{d.lot}</td>
                          <td className="px-4 py-3 text-sm font-semibold text-gray-900">{rp(Number(d.total))}</td>
                          <td className="px-4 py-3 text-sm text-gray-700 font-medium">{d.keterangan}</td>
                          <td className="px-4 py-3">
                            <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-bold ${
                              d.status === 'DONE'
                                ? 'bg-green-100 text-green-800'
                                : 'bg-orange-100 text-orange-800'
                            }`}>
                              {d.status}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-sm">
                            <div className="flex items-center gap-3">
                              {d.status === 'ESTIMASI' && (
                                <button
                                  onClick={() => openEdit(d)}
                                  className="text-xs text-indigo-600 hover:text-indigo-800 font-medium"
                                >
                                  Edit
                                </button>
                              )}
                              <button
                                onClick={() => handleDelete(d.id)}
                                disabled={deletingId === d.id}
                                className="text-xs text-red-600 hover:text-red-800 disabled:opacity-50"
                              >
                                {deletingId === d.id ? '...' : 'Hapus'}
                              </button>
                            </div>
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
                      <span className="font-medium">{Math.min(page * PAGE_SIZE, filtered.length)}</span>
                      {' '}dari{' '}
                      <span className="font-medium">{filtered.length}</span> data
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
              </>
            )}
          </div>
        )}

        {/* Rekap By Sekuritas Tab */}
        {activeTab === 'sekuritas' && (
          <div className="bg-white shadow sm:rounded-lg p-6">
            {/* Dropdown pilih sekuritas */}
            <div className="mb-6 flex flex-col sm:flex-row sm:items-center gap-3">
              <label className="text-sm font-medium text-gray-700 whitespace-nowrap">Pilih Akun Sekuritas:</label>
              <select
                value={selectedRekapKet}
                onChange={e => setSelectedRekapKet(e.target.value)}
                className="border border-gray-300 rounded-md px-3 py-2 text-sm focus:ring-indigo-500 focus:border-indigo-500 w-full sm:w-72"
              >
                <option value="">-- Pilih sekuritas --</option>
                {rekapKets.map(ket => (
                  <option key={ket} value={ket}>{ket}</option>
                ))}
              </select>
            </div>

            {!selectedRekapKet ? (
              <div className="py-16 text-center text-gray-400">
                Pilih sekuritas untuk melihat rekap performa saham
              </div>
            ) : rekapFiltered.length === 0 ? (
              <div className="py-16 text-center text-gray-400">
                Belum ada data DONE untuk sekuritas ini
              </div>
            ) : (
              <>
                <h2 className="text-center text-sm font-bold text-gray-700 mb-6 tracking-widest uppercase">
                  {selectedRekapKet} — Rekap Per Saham
                </h2>

                {/* Bar Chart */}
                <div style={{ height: 380 }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={rekapTableData} margin={{ top: 10, right: 20, left: 10, bottom: 30 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                      <XAxis
                        dataKey="saham"
                        tick={{ fontSize: 11 }}
                        label={{ value: 'Kode Saham', position: 'insideBottom', offset: -15, fontSize: 12 }}
                      />
                      <YAxis
                        tickFormatter={v => v === 0 ? 'Rp0' : `Rp${(v / 1_000_000).toFixed(0)}jt`}
                        tick={{ fontSize: 11 }}
                        width={65}
                      />
                      <Tooltip
                        formatter={(value: number, name: string) => [
                          `Rp ${value.toLocaleString('id-ID')}`,
                          name,
                        ]}
                      />
                      <Legend verticalAlign="top" height={36} />
                      {rekapYears.map((year, i) => (
                        <Bar
                          key={year}
                          dataKey={year}
                          name={String(year)}
                          fill={YEAR_COLORS[i % YEAR_COLORS.length]}
                        />
                      ))}
                    </BarChart>
                  </ResponsiveContainer>
                </div>

                {/* Tabel per saham per tahun */}
                <div className="mt-8 border-t border-gray-200 pt-6">
                  <h3 className="text-sm font-bold text-gray-700 mb-4 tracking-wide uppercase">
                    Total Per Saham Per Tahun
                  </h3>
                  <div className="overflow-x-auto">
                    <table className="min-w-full text-sm">
                      <thead>
                        <tr className="border-b border-gray-200">
                          <th className="text-left py-2 pr-6 font-medium text-gray-600">Kode Saham</th>
                          {rekapYears.map(y => (
                            <th key={y} className="text-right py-2 px-4 font-medium text-gray-600">{y}</th>
                          ))}
                          <th className="text-right py-2 pl-6 font-bold text-gray-800">Total</th>
                        </tr>
                      </thead>
                      <tbody>
                        {rekapTableData.map(row => (
                          <tr key={row.saham} className="border-b border-gray-100 hover:bg-gray-50">
                            <td className="py-2 pr-6 font-medium text-gray-900">
                              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold bg-indigo-100 text-indigo-800">
                                {row.saham}
                              </span>
                            </td>
                            {rekapYears.map(y => (
                              <td key={y} className="text-right py-2 px-4 text-gray-700">
                                {row[y] ? rp(row[y]) : <span className="text-gray-300">—</span>}
                              </td>
                            ))}
                            <td className="text-right py-2 pl-6 font-bold text-gray-900">
                              {rp(rekapYears.reduce((s, y) => s + (row[y] ?? 0), 0))}
                            </td>
                          </tr>
                        ))}
                        <tr className="bg-gray-50 border-t-2 border-gray-300">
                          <td className="py-2 pr-6 font-bold text-gray-900">Grand Total</td>
                          {rekapYears.map(y => (
                            <td key={y} className="text-right py-2 px-4 font-bold text-gray-900">
                              {rp(rekapTableData.reduce((s, row) => s + (row[y] ?? 0), 0))}
                            </td>
                          ))}
                          <td className="text-right py-2 pl-6 font-bold text-indigo-700">
                            {rp(rekapTableData.reduce((s, row) =>
                              s + rekapYears.reduce((sy, y) => sy + (row[y] ?? 0), 0), 0))}
                          </td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </div>
              </>
            )}
          </div>
        )}

        {/* Rekap By Saham Tab */}
        {activeTab === 'saham' && (
          <div className="bg-white shadow sm:rounded-lg p-6">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-1">
              <div className="text-center sm:text-left flex-1">
                <h2 className="text-sm font-bold text-gray-700 tracking-widest uppercase">
                  Rekap By Saham
                </h2>
              </div>
              <div className="flex justify-center sm:justify-end gap-1">
                {([
                  ['1', '1 Tahun'],
                  ['3', '3 Tahun'],
                  ['5', '5 Tahun'],
                  ['all', 'All Time'],
                ] as const).map(([key, label]) => (
                  <button
                    key={key}
                    onClick={() => setRekapSahamPeriod(key)}
                    className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap ${
                      rekapSahamPeriod === key
                        ? 'bg-indigo-600 text-white'
                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>
            <p className="text-center text-xs text-gray-400 mb-6">
              Semua saham (lintas akun sekuritas & tahun), diurutkan dari total dividen terbesar
              {rekapSahamPeriod !== 'all' && ` — ${REKAP_SAHAM_PERIOD_YEARS[rekapSahamPeriod]} tahun terakhir (${currentYear - REKAP_SAHAM_PERIOD_YEARS[rekapSahamPeriod] + 1}–${currentYear})`}
            </p>

            {rekapSahamData.length === 0 ? (
              <div className="py-16 text-center text-gray-500">
                Belum ada data dengan status DONE untuk periode ini
              </div>
            ) : (
              <>

                {/* Bar Chart — top 15 saham */}
                <div style={{ height: 380 }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={rekapSahamData.slice(0, 15)} margin={{ top: 10, right: 20, left: 10, bottom: 30 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                      <XAxis
                        dataKey="saham"
                        tick={{ fontSize: 11 }}
                        label={{ value: 'Kode Saham', position: 'insideBottom', offset: -15, fontSize: 12 }}
                      />
                      <YAxis
                        tickFormatter={v => v === 0 ? 'Rp0' : `Rp${(v / 1_000_000).toFixed(0)}jt`}
                        tick={{ fontSize: 11 }}
                        width={65}
                      />
                      <Tooltip
                        formatter={(value: number) => [`Rp ${value.toLocaleString('id-ID')}`, 'Total Dividen']}
                      />
                      <Bar dataKey="total" name="Total Dividen" fill="#3B82F6" />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
                {rekapSahamData.length > 15 && (
                  <p className="text-center text-xs text-gray-400 mt-2">
                    Menampilkan 15 saham teratas di chart — tabel di bawah menampilkan semua {rekapSahamData.length} saham
                  </p>
                )}

                {/* Tabel ranking saham */}
                <div className="mt-8 border-t border-gray-200 pt-6">
                  <h3 className="text-sm font-bold text-gray-700 mb-4 tracking-wide uppercase">
                    Ranking Saham Berdasarkan Total Dividen
                  </h3>
                  <div className="overflow-x-auto">
                    <table className="min-w-full text-sm">
                      <thead>
                        <tr className="border-b border-gray-200">
                          <th className="text-left py-2 pr-4 font-medium text-gray-600">#</th>
                          <th className="text-left py-2 pr-6 font-medium text-gray-600">Kode Saham</th>
                          <th className="text-right py-2 px-4 font-medium text-gray-600">Total Dividen</th>
                          <th className="text-right py-2 px-4 font-medium text-gray-600">Jumlah Transaksi</th>
                          <th className="text-right py-2 px-4 font-medium text-gray-600">Jumlah Tahun</th>
                          <th className="text-right py-2 pl-6 font-medium text-gray-600 w-40">Porsi</th>
                        </tr>
                      </thead>
                      <tbody>
                        {rekapSahamData.map((row, idx) => {
                          const porsi = rekapSahamTotal > 0 ? (row.total / rekapSahamTotal) * 100 : 0
                          return (
                            <tr key={row.saham} className="border-b border-gray-100 hover:bg-gray-50">
                              <td className="py-2 pr-4 text-gray-400 text-xs">{idx + 1}</td>
                              <td className="py-2 pr-6 font-medium text-gray-900">
                                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold bg-indigo-100 text-indigo-800">
                                  {row.saham}
                                </span>
                              </td>
                              <td className="text-right py-2 px-4 font-bold text-gray-900">{rp(row.total)}</td>
                              <td className="text-right py-2 px-4 text-gray-700">{row.count}</td>
                              <td className="text-right py-2 px-4 text-gray-700">{row.tahunCount}</td>
                              <td className="text-right py-2 pl-6">
                                <div className="flex items-center gap-2">
                                  <div className="flex-1 bg-gray-100 rounded-full h-1.5">
                                    <div className="h-1.5 rounded-full bg-indigo-500" style={{ width: `${Math.min(porsi, 100)}%` }} />
                                  </div>
                                  <span className="font-semibold text-gray-700 text-xs w-12 text-right">{porsi.toFixed(1)}%</span>
                                </div>
                              </td>
                            </tr>
                          )
                        })}
                      </tbody>
                      <tfoot>
                        <tr className="bg-gray-50 border-t-2 border-gray-300">
                          <td colSpan={2} className="py-2 pr-6 font-bold text-gray-900">Grand Total</td>
                          <td className="text-right py-2 px-4 font-bold text-indigo-700">{rp(rekapSahamTotal)}</td>
                          <td className="text-right py-2 px-4 font-bold text-gray-900">
                            {rekapSahamData.reduce((s, r) => s + r.count, 0)}
                          </td>
                          <td colSpan={2}></td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                </div>
              </>
            )}
          </div>
        )}

        {/* Rekap Chart Tab */}
        {activeTab === 'rekap' && (
          <div className="bg-white shadow sm:rounded-lg p-6">
            {doneDividends.length === 0 ? (
              <div className="py-16 text-center text-gray-500">
                Belum ada data dengan status DONE untuk ditampilkan di rekap
              </div>
            ) : (
              <>
                <h2 className="text-center text-sm font-bold text-gray-700 mb-6 tracking-widest uppercase">
                  Rekap Data
                </h2>
                <div style={{ height: 380 }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={chartData} margin={{ top: 10, right: 20, left: 10, bottom: 30 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                      <XAxis
                        dataKey="keterangan"
                        tick={{ fontSize: 11 }}
                        label={{ value: 'Akun Sekuritas', position: 'insideBottom', offset: -15, fontSize: 12 }}
                      />
                      <YAxis
                        tickFormatter={v => v === 0 ? 'Rp0' : `Rp${(v / 1_000_000).toFixed(0)}jt`}
                        tick={{ fontSize: 11 }}
                        width={65}
                      />
                      <Tooltip
                        formatter={(value: number, name: string) => [
                          `Rp ${value.toLocaleString('id-ID')}`,
                          name,
                        ]}
                      />
                      <Legend verticalAlign="top" height={36} />
                      {years.map((year, i) => (
                        <Bar
                          key={year}
                          dataKey={year}
                          name={String(year)}
                          fill={YEAR_COLORS[i % YEAR_COLORS.length]}
                        />
                      ))}
                    </BarChart>
                  </ResponsiveContainer>
                </div>

                {/* Summary table */}
                <div className="mt-8 border-t border-gray-200 pt-6">
                  <h3 className="text-sm font-bold text-gray-700 mb-4 tracking-wide uppercase">
                    Total Per Akun Per Tahun
                  </h3>
                  <div className="overflow-x-auto">
                    <table className="min-w-full text-sm">
                      <thead>
                        <tr className="border-b border-gray-200">
                          <th className="text-left py-2 pr-6 font-medium text-gray-600">Akun Sekuritas</th>
                          {years.map(y => (
                            <th key={y} className="text-right py-2 px-4 font-medium text-gray-600">{y}</th>
                          ))}
                          <th className="text-right py-2 pl-6 font-bold text-gray-800">Total</th>
                        </tr>
                      </thead>
                      <tbody>
                        {chartData.map(row => (
                          <tr key={row.keterangan} className="border-b border-gray-100 hover:bg-gray-50">
                            <td className="py-2 pr-6 font-medium text-gray-900">{row.keterangan}</td>
                            {years.map(y => (
                              <td key={y} className="text-right py-2 px-4 text-gray-700">
                                {rp(row[y] ?? 0)}
                              </td>
                            ))}
                            <td className="text-right py-2 pl-6 font-bold text-gray-900">
                              {rp(years.reduce((s, y) => s + (row[y] ?? 0), 0))}
                            </td>
                          </tr>
                        ))}
                        <tr className="bg-gray-50 border-t-2 border-gray-300">
                          <td className="py-2 pr-6 font-bold text-gray-900">Grand Total</td>
                          {years.map(y => (
                            <td key={y} className="text-right py-2 px-4 font-bold text-gray-900">
                              {rp(chartData.reduce((s, row) => s + (row[y] ?? 0), 0))}
                            </td>
                          ))}
                          <td className="text-right py-2 pl-6 font-bold text-indigo-700">
                            {rp(chartData.reduce((s, row) => s + years.reduce((sy, y) => sy + (row[y] ?? 0), 0), 0))}
                          </td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </div>
              </>
            )}
          </div>
        )}

        {/* Estimasi Dividen Tab */}
        {activeTab === 'estimasi' && (
          <div>
            {/* Disclaimer permanen — bukan angka pasti */}
            <div className="mb-6 bg-amber-50 border border-amber-200 rounded-lg">
              <button
                onClick={() => setEstimasiBannerCollapsed(c => !c)}
                className="w-full flex items-center gap-2 px-4 py-2.5 text-left"
              >
                <span className="flex-shrink-0 w-5 h-5 rounded-full bg-amber-400 text-white text-xs font-bold flex items-center justify-center">i</span>
                <span className="text-sm font-medium text-amber-900 flex-1">
                  {estimasiBannerCollapsed ? 'Ini estimasi, bukan angka pasti' : 'Bagaimana estimasi ini dihitung?'}
                </span>
                <svg className={`w-4 h-4 text-amber-600 transition-transform ${estimasiBannerCollapsed ? '' : 'rotate-180'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </button>
              {!estimasiBannerCollapsed && (
                <p className="px-4 pb-3 text-sm text-amber-800">
                  Untuk setiap saham yang kamu miliki <strong>saat ini</strong> di tab Portofolio, sistem mengambil dividen per lembar
                  tahun {currentYear - 1} (tahun penuh terakhir, status DONE) dari riwayat Rekap Dividen, lalu mengalikannya dengan
                  jumlah lot yang kamu pegang <strong>sekarang</strong> — bukan jumlah lot saat dividen itu diterima dulu.
                  <strong> Ini hanya estimasi, bukan angka pasti</strong> — dividen aktual tahun {nextYear} tergantung kebijakan emiten
                  dan tidak dijamin sama atau berulang seperti tahun sebelumnya. Kalau kamu menambah/mengurangi posisi, estimasi ini
                  akan berubah mengikuti data Portofolio terbaru. Kalau riwayat dividennya kamu rasa kurang akurat atau belum ada,
                  klik ikon pensil di kolom Dividen/Lembar untuk mengoreksinya secara manual — atau pakai tombol <strong>Validasi Data</strong>{' '}
                  untuk melihat saham mana saja yang perlu diperiksa.
                </p>
              )}
            </div>

            {portfolioRows.length === 0 ? (
              <div className="bg-white rounded-lg shadow p-16 text-center text-gray-400">
                Belum ada data Portofolio. Tambahkan posisi saham di menu Portofolio terlebih dahulu.
              </div>
            ) : estimasiDividenData.length === 0 ? (
              <div className="bg-white rounded-lg shadow p-16 text-center text-gray-400">
                Belum ada riwayat dividen (status DONE) untuk saham yang kamu miliki saat ini.
              </div>
            ) : (
              <>
                {/* Ringkasan + tombol validasi */}
                <div className="bg-white rounded-lg shadow p-5 mb-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                  <div>
                    <p className="text-xs text-gray-500 mb-1">Estimasi Total Dividen Tahun {nextYear}</p>
                    <p className="text-2xl font-bold text-green-600">{rp(totalEstimasiDividenTahunDepan)}</p>
                    <p className="text-xs text-gray-400 mt-1">
                      Berdasarkan {estimasiDividenData.length} saham yang dimiliki saat ini
                      {estimateOverrides.length > 0 && ` — ${estimateOverrides.length} di antaranya nilainya dikoreksi manual`}
                    </p>
                  </div>
                  <button
                    onClick={() => setShowValidasiModal(true)}
                    className="inline-flex items-center gap-2 px-4 py-2 border border-gray-300 text-gray-700 text-sm font-medium rounded-md hover:bg-gray-50 flex-shrink-0"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    Validasi Data
                    {(sahamTanpaRiwayat.length + sahamAnomali.length) > 0 && (
                      <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-amber-500 text-white text-xs font-bold">
                        {sahamTanpaRiwayat.length + sahamAnomali.length}
                      </span>
                    )}
                  </button>
                </div>

                {/* Tabel per saham */}
                <div className="bg-white shadow sm:rounded-lg overflow-hidden">
                  <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
                    <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Estimasi Per Saham</p>
                    <p className="text-xs text-gray-400">Klik ikon pensil untuk mengoreksi angka secara manual</p>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="min-w-full text-sm divide-y divide-gray-100">
                      <thead className="bg-gray-50">
                        <tr>
                          {['Saham', 'Lot Dimiliki Saat Ini', 'Dividen/Lembar', 'Tahun Acuan', `Estimasi ${nextYear}`, ''].map(h => (
                            <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider whitespace-nowrap">{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100">
                        {estimasiDividenData.map(r => {
                          const isEditing = editingOverrideSaham === r.saham
                          return (
                            <tr key={r.saham} className={`hover:bg-gray-50 ${r.needsInput ? 'bg-amber-50/40' : ''}`}>
                              <td className="px-4 py-3 whitespace-nowrap">
                                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold bg-indigo-100 text-indigo-800">
                                  {r.saham}
                                </span>
                              </td>
                              <td className="px-4 py-3 text-gray-700 whitespace-nowrap">{r.lot}</td>
                              <td className="px-4 py-3 text-gray-900 whitespace-nowrap">
                                {isEditing ? (
                                  <div className="flex items-center gap-1">
                                    <input
                                      type="number"
                                      autoFocus
                                      min={0}
                                      value={overrideInputValue}
                                      onChange={e => setOverrideInputValue(e.target.value)}
                                      onKeyDown={e => { if (e.key === 'Enter') saveOverride(r.saham); if (e.key === 'Escape') cancelOverrideEditor() }}
                                      className="w-28 border border-indigo-300 rounded px-2 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-indigo-500"
                                    />
                                    <button
                                      onClick={() => saveOverride(r.saham)}
                                      disabled={savingOverride}
                                      title="Simpan"
                                      className="text-green-600 hover:text-green-800 disabled:opacity-50"
                                    >
                                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                                    </button>
                                    <button onClick={cancelOverrideEditor} title="Batal" className="text-gray-400 hover:text-gray-600">
                                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                                    </button>
                                  </div>
                                ) : (
                                  <div className="flex items-center gap-1.5">
                                    {r.needsInput ? (
                                      <span className="text-amber-600 text-xs italic">Belum ada data</span>
                                    ) : (
                                      <span>{rp(r.dividenPerLembar as number)}</span>
                                    )}
                                    {r.isManualOverride && (
                                      <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold bg-purple-100 text-purple-700" title="Nilai dikoreksi manual oleh kamu">
                                        Manual
                                      </span>
                                    )}
                                    {r.anomali && (
                                      <span
                                        className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold bg-red-100 text-red-700"
                                        title={`Berbeda ${r.anomali.deviasiPct > 0 ? '+' : ''}${r.anomali.deviasiPct.toFixed(0)}% dari rata-rata tahun lain (${rp(r.anomali.avgTahunLain)}) — periksa kembali`}
                                      >
                                        ⚠ Cek data
                                      </span>
                                    )}
                                    <button
                                      onClick={() => openOverrideEditor(r.saham, r.dividenPerLembar)}
                                      title="Koreksi manual"
                                      className="text-gray-400 hover:text-indigo-600"
                                    >
                                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                                      </svg>
                                    </button>
                                    {r.isManualOverride && (
                                      <button
                                        onClick={() => resetOverride(r.saham)}
                                        disabled={savingOverride}
                                        title="Kembalikan ke nilai otomatis dari riwayat dividen"
                                        className="text-gray-400 hover:text-red-600 disabled:opacity-50"
                                      >
                                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                                        </svg>
                                      </button>
                                    )}
                                  </div>
                                )}
                              </td>
                              <td className="px-4 py-3 text-gray-500 whitespace-nowrap">
                                {r.isManualOverride ? (
                                  <span className="text-purple-600">Manual</span>
                                ) : r.yearUsed ? (
                                  <>{r.yearUsed}{r.isFallbackYear && <span className="text-amber-600 ml-1" title="Tahun penuh terakhir belum ada data — pakai tahun terakhir yang tersedia">*</span>}</>
                                ) : '-'}
                              </td>
                              <td className="px-4 py-3 font-bold text-green-600 whitespace-nowrap">{rp(r.estimasi)}</td>
                              <td></td>
                            </tr>
                          )
                        })}
                      </tbody>
                      <tfoot>
                        <tr className="bg-gray-50 border-t-2 border-gray-300">
                          <td colSpan={4} className="px-4 py-3 font-bold text-gray-900">Total Estimasi {nextYear}</td>
                          <td colSpan={2} className="px-4 py-3 font-bold text-green-700">{rp(totalEstimasiDividenTahunDepan)}</td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                  {estimasiDividenData.some(r => r.isFallbackYear) && (
                    <p className="px-4 py-3 text-xs text-gray-400 border-t border-gray-100">
                      * Tidak ada data DONE tahun {currentYear - 1} untuk saham ini — dipakai tahun terakhir yang tersedia sebagai gantinya.
                    </p>
                  )}
                </div>
              </>
            )}
          </div>
        )}
      </div>

      {/* Validasi Data Modal — tab Estimasi Dividen */}
      {showValidasiModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="fixed inset-0 bg-black/40" onClick={() => setShowValidasiModal(false)} />
          <div className="relative z-50 bg-white rounded-xl shadow-2xl w-full max-w-lg mx-4 p-6 max-h-[85vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold text-gray-900">Validasi Data Estimasi Dividen</h2>
              <button onClick={() => setShowValidasiModal(false)} className="text-gray-400 hover:text-gray-600">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {sahamTanpaRiwayat.length === 0 && sahamAnomali.length === 0 && estimasiDividenData.every(r => !r.isFallbackYear) ? (
              <div className="text-center py-8">
                <span className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-green-100 text-green-600 mb-3">
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                </span>
                <p className="text-sm text-gray-600">Semua data terlihat wajar — tidak ada saham tanpa riwayat, tahun pengganti, atau lonjakan tidak biasa.</p>
              </div>
            ) : (
              <div className="space-y-5">
                {/* Ringkasan angka */}
                <div className="grid grid-cols-3 gap-3 text-center">
                  <div className="bg-gray-50 rounded-lg p-3">
                    <p className="text-lg font-bold text-gray-900">{estimasiDividenData.length}</p>
                    <p className="text-[11px] text-gray-500">Saham dimiliki</p>
                  </div>
                  <div className="bg-gray-50 rounded-lg p-3">
                    <p className="text-lg font-bold text-purple-600">{estimateOverrides.length}</p>
                    <p className="text-[11px] text-gray-500">Dikoreksi manual</p>
                  </div>
                  <div className="bg-gray-50 rounded-lg p-3">
                    <p className="text-lg font-bold text-amber-600">{sahamTanpaRiwayat.length}</p>
                    <p className="text-[11px] text-gray-500">Belum ada data</p>
                  </div>
                </div>

                {sahamTanpaRiwayat.length > 0 && (
                  <div>
                    <p className="text-sm font-semibold text-amber-700 mb-1.5">⚠ Belum ada riwayat dividen (tidak masuk total, kecuali diisi manual)</p>
                    <div className="flex flex-wrap gap-1.5">
                      {sahamTanpaRiwayat.map(saham => (
                        <button
                          key={saham}
                          onClick={() => { setShowValidasiModal(false); openOverrideEditor(saham, null) }}
                          className="px-2 py-1 rounded text-xs font-medium bg-amber-100 text-amber-800 hover:bg-amber-200"
                          title="Klik untuk isi estimasi manual"
                        >
                          {saham} +
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {sahamAnomali.length > 0 && (
                  <div>
                    <p className="text-sm font-semibold text-red-700 mb-1.5">⚠ Lonjakan/penurunan tidak biasa dibanding tahun lain</p>
                    <ul className="space-y-1.5">
                      {sahamAnomali.map(r => (
                        <li key={r.saham} className="text-xs text-gray-600 bg-red-50 rounded px-3 py-2">
                          <span className="font-bold text-gray-900">{r.saham}</span>: dividen/lembar tahun {r.yearUsed} ({rp(r.autoDividenPerLembar ?? 0)})
                          {' '}berbeda <span className="font-semibold text-red-600">{(r.anomali!.deviasiPct > 0 ? '+' : '')}{r.anomali!.deviasiPct.toFixed(0)}%</span> dari
                          {' '}rata-rata tahun lain ({rp(r.anomali!.avgTahunLain)}). Periksa apakah datanya benar, atau koreksi manual bila perlu.
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {estimasiDividenData.some(r => r.isFallbackYear && !r.isManualOverride) && (
                  <div>
                    <p className="text-sm font-semibold text-gray-700 mb-1.5">ℹ Pakai tahun pengganti (bukan tahun penuh terakhir)</p>
                    <p className="text-xs text-gray-500">
                      {estimasiDividenData.filter(r => r.isFallbackYear && !r.isManualOverride).map(r => `${r.saham} (${r.yearUsed})`).join(', ')}
                      {' '}— tidak ada data DONE tahun {currentYear - 1}, jadi dipakai tahun terakhir yang tersedia. Pastikan ini representatif.
                    </p>
                  </div>
                )}
              </div>
            )}

            <div className="mt-6 flex justify-end">
              <button
                onClick={() => setShowValidasiModal(false)}
                className="px-4 py-2 bg-gray-100 text-gray-700 text-sm font-medium rounded-md hover:bg-gray-200"
              >
                Tutup
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add/Edit Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="fixed inset-0 bg-black/40" onClick={closeModal} />
          <div className="relative z-50 bg-white rounded-xl shadow-2xl w-full max-w-md mx-4 p-6">
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-lg font-bold text-gray-900">
                {editItem ? 'Edit Dividen' : 'Tambah Dividen'}
              </h2>
              <button onClick={closeModal} className="text-gray-400 hover:text-gray-600">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Bulan</label>
                  <select
                    value={form.bulan}
                    onChange={e => setForm(f => ({ ...f, bulan: e.target.value }))}
                    className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:ring-indigo-500 focus:border-indigo-500"
                  >
                    {MONTHS.map(m => <option key={m}>{m}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Tahun</label>
                  <input
                    type="number"
                    value={form.tahun}
                    onChange={e => setForm(f => ({ ...f, tahun: Number(e.target.value) }))}
                    className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:ring-indigo-500 focus:border-indigo-500"
                  />
                </div>
              </div>

              {/* Akun Sekuritas — searchable combobox */}
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">
                  Akun Sekuritas <span className="text-red-500">*</span>
                </label>
                {securities.length > 0 ? (
                  <div className="relative">
                    {/* trigger / selected display */}
                    <button
                      type="button"
                      onClick={() => setSecDropdownOpen(o => !o)}
                      className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm text-left flex items-center justify-between focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500"
                    >
                      <span className={selectedSecurityId ? 'text-gray-900' : 'text-gray-400'}>
                        {selectedSecurityId
                          ? securities.find(s => s.id === selectedSecurityId)?.nama
                          : '-- Pilih Akun Sekuritas --'}
                      </span>
                      <svg className={`w-4 h-4 text-gray-400 transition-transform ${secDropdownOpen ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                      </svg>
                    </button>

                    {/* dropdown panel */}
                    {secDropdownOpen && (
                      <div className="absolute z-50 mt-1 w-full bg-white border border-gray-200 rounded-md shadow-lg">
                        {/* search input */}
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

                        {/* options list */}
                        <ul className="max-h-48 overflow-y-auto">
                          {securities
                            .filter(s => s.nama.toLowerCase().includes(secSearch.toLowerCase()))
                            .length === 0 ? (
                            <li className="px-3 py-2 text-sm text-gray-400 text-center">
                              Sekuritas tidak ditemukan
                            </li>
                          ) : (
                            securities
                              .filter(s => s.nama.toLowerCase().includes(secSearch.toLowerCase()))
                              .map(s => (
                                <li
                                  key={s.id}
                                  onClick={() => {
                                    handleSecuritySelect(s.id)
                                    setSecDropdownOpen(false)
                                    setSecSearch('')
                                  }}
                                  className={`px-3 py-2 text-sm cursor-pointer hover:bg-indigo-50 hover:text-indigo-700 ${
                                    selectedSecurityId === s.id ? 'bg-indigo-50 text-indigo-700 font-medium' : 'text-gray-900'
                                  }`}
                                >
                                  {s.nama}
                                </li>
                              ))
                          )}
                        </ul>
                      </div>
                    )}

                    {/* close dropdown when clicking outside */}
                    {secDropdownOpen && (
                      <div className="fixed inset-0 z-40" onClick={() => { setSecDropdownOpen(false); setSecSearch('') }} />
                    )}
                  </div>
                ) : (
                  <>
                    <div className="rounded-md bg-amber-50 border border-amber-200 px-3 py-2 text-xs text-amber-800 mb-2">
                      Belum ada sekuritas aktif.{' '}
                      <a href="/securities" className="font-semibold underline hover:text-amber-900">
                        Daftarkan sekuritas
                      </a>{' '}
                      terlebih dahulu.
                    </div>
                    <input
                      type="text"
                      value={form.keterangan}
                      onChange={e => setForm(f => ({ ...f, keterangan: e.target.value }))}
                      placeholder="cth: IPOT"
                      className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:ring-indigo-500 focus:border-indigo-500"
                    />
                  </>
                )}
              </div>

              {/* Kode Saham — always manual */}
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
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Dividen / Lembar (Rp)</label>
                  <input
                    type="number"
                    value={form.dividen}
                    onChange={e => setForm(f => ({ ...f, dividen: e.target.value }))}
                    placeholder="137"
                    className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:ring-indigo-500 focus:border-indigo-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Lot</label>
                  <input
                    type="number"
                    value={form.lot}
                    onChange={e => setForm(f => ({ ...f, lot: e.target.value }))}
                    placeholder="35"
                    className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:ring-indigo-500 focus:border-indigo-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Total (otomatis)</label>
                <div className="w-full border border-gray-200 rounded-md px-3 py-2 text-sm bg-gray-50 font-semibold text-gray-900">
                  {rp(computedTotal())}
                </div>
                <p className="text-xs text-gray-400 mt-0.5">Dividen × Lot × 100 lembar/lot</p>
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Status</label>
                <select
                  value={form.status}
                  onChange={e => setForm(f => ({ ...f, status: e.target.value as any }))}
                  className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:ring-indigo-500 focus:border-indigo-500"
                >
                  <option value="ESTIMASI">ESTIMASI — masih perkiraan, bisa diedit</option>
                  <option value="DONE">DONE — dividen sudah terealisasi</option>
                </select>
              </div>
            </div>

            <div className="mt-6 flex gap-3 justify-end">
              <button
                onClick={closeModal}
                className="px-4 py-2 text-sm font-medium text-gray-700 border border-gray-300 rounded-md hover:bg-gray-50"
              >
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
    </div>
  )
}

export default function DividendsPage() {
  return (
    <Suspense fallback={null}>
      <DividendsContent />
    </Suspense>
  )
}
