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
}

interface Security {
  id: string
  nama: string
  kode: string
  status: string
}

const emptyForm = { keterangan: '', saham: '', hargaRata: '', lot: '' }

const rp = (v: number) => `Rp ${v.toLocaleString('id-ID')}`
const pct = (v: number) => `${v >= 0 ? '+' : ''}${v.toFixed(2)}%`

export default function PortfolioPage() {
  const { data: session, status } = useSession()
  const router = useRouter()

  const [proAccess, setProAccess]     = useState<{ hasAccess: boolean } | null>(null)
  const [rows, setRows]               = useState<PortfolioRow[]>([])
  const [prices, setPrices]           = useState<Record<string, number | null>>({})
  const [loadingData, setLoadingData] = useState(false)
  const [loadingPrice, setLoadingPrice] = useState(false)
  const [securities, setSecurities]   = useState<Security[]>([])
  const [filterKet, setFilterKet]     = useState('')

  const [showModal, setShowModal]     = useState(false)
  const [editItem, setEditItem]       = useState<PortfolioRow | null>(null)
  const [form, setForm]               = useState(emptyForm)
  const [saving, setSaving]           = useState(false)
  const [deletingId, setDeletingId]   = useState<string | null>(null)

  // searchable combobox states
  const [secSearch, setSecSearch]         = useState('')
  const [secDropdownOpen, setSecDropdownOpen] = useState(false)

  useEffect(() => {
    if (status === 'unauthenticated') router.push('/login')
  }, [status, router])

  const fetchPortfolio = useCallback(async () => {
    setLoadingData(true)
    try {
      const res = await fetch('/api/portfolio')
      if (res.ok) setRows(await res.json())
    } finally {
      setLoadingData(false)
    }
  }, [])

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
    const res = await fetch(`/api/securities?userId=${userId}&limit=100`)
    if (res.ok) {
      const json = await res.json()
      const list: Security[] = json.securities ?? json
      setSecurities(list.filter(s => s.status === 'ACTIVE'))
    }
  }, [])

  useEffect(() => {
    if (status !== 'authenticated') return
    fetch('/api/subscription/status').then(r => r.json()).then(setProAccess)
    const userId = (session?.user as any)?.id
    fetchPortfolio()
    if (userId) fetchSecurities(userId)
  }, [status, session, fetchPortfolio, fetchSecurities])

  useEffect(() => {
    if (rows.length > 0) fetchPrices(rows)
  }, [rows, fetchPrices])

  const handleRefresh = () => fetchPrices(rows)

  const openAdd = () => {
    setEditItem(null)
    setForm(emptyForm)
    setSecSearch('')
    setSecDropdownOpen(false)
    setShowModal(true)
  }

  const openEdit = (row: PortfolioRow) => {
    setEditItem(row)
    setForm({ keterangan: row.keterangan, saham: row.saham, hargaRata: String(row.hargaRata), lot: String(row.lot) })
    setSecSearch('')
    setSecDropdownOpen(false)
    setShowModal(true)
  }

  const closeModal = () => { setShowModal(false); setEditItem(null) }

  const handleSave = async () => {
    if (!form.keterangan || !form.saham || !form.hargaRata || !form.lot) return
    setSaving(true)
    try {
      const payload = { keterangan: form.keterangan, saham: form.saham, hargaRata: parseFloat(form.hargaRata), lot: parseInt(form.lot) }
      const res = await fetch(editItem ? `/api/portfolio/${editItem.id}` : '/api/portfolio', {
        method: editItem ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      if (res.ok) { closeModal(); await fetchPortfolio() }
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

  if (status === 'loading' || proAccess === null) return null
  if (!proAccess.hasAccess) return <ProGate />

  // Filter
  const keterangans = Array.from(new Set(rows.map(r => r.keterangan))).sort()
  const filtered = filterKet ? rows.filter(r => r.keterangan === filterKet) : rows

  // Calculations per row
  const calc = (row: PortfolioRow) => {
    const modal       = row.hargaRata * row.lot * 100
    const hargaAkhir  = prices[row.saham]
    const nilaiPasar  = hargaAkhir != null ? hargaAkhir * row.lot * 100 : null
    const floatRp     = nilaiPasar != null ? nilaiPasar - modal : null
    const floatPct    = floatRp != null && modal > 0 ? (floatRp / modal) * 100 : null
    return { modal, hargaAkhir, nilaiPasar, floatRp, floatPct }
  }

  // Summary totals
  const totalModal      = filtered.reduce((s, r) => s + r.hargaRata * r.lot * 100, 0)
  const totalNilaiPasar = filtered.reduce((s, r) => {
    const h = prices[r.saham]; return h != null ? s + h * r.lot * 100 : s
  }, 0)
  const totalFloatRp  = totalNilaiPasar - totalModal
  const totalFloatPct = totalModal > 0 ? (totalFloatRp / totalModal) * 100 : 0
  const hasAllPrices  = filtered.every(r => prices[r.saham] != null)

  const floatColor = (v: number | null) =>
    v == null ? 'text-gray-400' : v > 0 ? 'text-green-600' : v < 0 ? 'text-red-600' : 'text-gray-600'

  const rowBg = (v: number | null) =>
    v == null ? '' : v > 0 ? 'bg-green-50 hover:bg-green-100' : v < 0 ? 'bg-red-50 hover:bg-red-100' : 'hover:bg-gray-50'

  const canSave = !!(form.keterangan && form.saham && form.hargaRata && form.lot)

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
            <button
              onClick={handleRefresh}
              disabled={loadingPrice || rows.length === 0}
              className="inline-flex items-center gap-2 px-4 py-2 bg-white border border-gray-300 text-gray-700 text-sm font-medium rounded-md hover:bg-gray-50 disabled:opacity-50"
            >
              <svg className={`w-4 h-4 ${loadingPrice ? 'animate-spin' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
              {loadingPrice ? 'Memperbarui...' : 'Refresh Harga'}
            </button>
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
          <div className="bg-white rounded-lg shadow p-4">
            <p className="text-xs text-gray-500 mb-1">Total Modal</p>
            <p className="text-lg font-bold text-gray-900">{rp(totalModal)}</p>
          </div>
          <div className="bg-white rounded-lg shadow p-4">
            <p className="text-xs text-gray-500 mb-1">Total Nilai Pasar</p>
            <p className="text-lg font-bold text-gray-900">
              {hasAllPrices && filtered.length > 0 ? rp(totalNilaiPasar) : <span className="text-gray-400 text-sm">Memuat...</span>}
            </p>
          </div>
          <div className="bg-white rounded-lg shadow p-4">
            <p className="text-xs text-gray-500 mb-1">Floating P/L</p>
            <p className={`text-lg font-bold ${floatColor(hasAllPrices && filtered.length > 0 ? totalFloatRp : null)}`}>
              {hasAllPrices && filtered.length > 0 ? rp(totalFloatRp) : <span className="text-gray-400 text-sm">—</span>}
            </p>
          </div>
          <div className="bg-white rounded-lg shadow p-4">
            <p className="text-xs text-gray-500 mb-1">Floating P/L (%)</p>
            <p className={`text-lg font-bold ${floatColor(hasAllPrices && filtered.length > 0 ? totalFloatPct : null)}`}>
              {hasAllPrices && filtered.length > 0 ? pct(totalFloatPct) : <span className="text-gray-400 text-sm">—</span>}
            </p>
          </div>
        </div>

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
            <button onClick={() => setFilterKet('')} className="px-3 py-1.5 bg-gray-100 text-gray-600 text-sm rounded-md hover:bg-gray-200">
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
              Belum ada posisi. Klik <span className="font-semibold text-indigo-600">Tambah Posisi</span> untuk mulai.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200 text-sm">
                <thead className="bg-gray-50">
                  <tr>
                    {['No', 'Akun Sekuritas', 'Saham', 'Avg Price', 'Lot', 'Modal', 'Harga Terakhir', 'Nilai Pasar', 'Floating P/L (Rp)', 'Floating P/L (%)', 'Aksi'].map(h => (
                      <th key={h} className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {filtered.map((row, idx) => {
                    const { modal, hargaAkhir, nilaiPasar, floatRp, floatPct } = calc(row)
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
                            ? <span className="text-gray-400">...</span>
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
                            <button onClick={() => openEdit(row)} className="text-xs text-indigo-600 hover:text-indigo-800 font-medium">Edit</button>
                            <button
                              onClick={() => handleDelete(row.id)}
                              disabled={deletingId === row.id}
                              className="text-xs text-red-600 hover:text-red-800 disabled:opacity-50"
                            >
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
      </div>

      {/* Modal */}
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

              {/* Akun Sekuritas — searchable combobox */}
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">
                  Akun Sekuritas <span className="text-red-500">*</span>
                </label>
                {securities.length > 0 ? (
                  <div className="relative">
                    <button
                      type="button"
                      onClick={() => setSecDropdownOpen(o => !o)}
                      className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm text-left flex items-center justify-between focus:outline-none focus:ring-1 focus:ring-indigo-500"
                    >
                      <span className={form.keterangan ? 'text-gray-900' : 'text-gray-400'}>
                        {form.keterangan || '-- Pilih Akun Sekuritas --'}
                      </span>
                      <svg className={`w-4 h-4 text-gray-400 transition-transform ${secDropdownOpen ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                      </svg>
                    </button>
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
                              <li className="px-3 py-2 text-sm text-gray-400 text-center">Tidak ditemukan</li>
                            ) : (
                              securities
                                .filter(s => s.nama.toLowerCase().includes(secSearch.toLowerCase()))
                                .map(s => (
                                  <li key={s.id}
                                    onClick={() => { setForm(f => ({ ...f, keterangan: s.nama })); setSecDropdownOpen(false); setSecSearch('') }}
                                    className={`px-3 py-2 text-sm cursor-pointer hover:bg-indigo-50 hover:text-indigo-700 ${form.keterangan === s.nama ? 'bg-indigo-50 text-indigo-700 font-medium' : 'text-gray-900'}`}
                                  >
                                    {s.nama}
                                  </li>
                                ))
                            )}
                          </ul>
                        </div>
                        <div className="fixed inset-0 z-40" onClick={() => { setSecDropdownOpen(false); setSecSearch('') }} />
                      </>
                    )}
                  </div>
                ) : (
                  <input
                    type="text"
                    value={form.keterangan}
                    onChange={e => setForm(f => ({ ...f, keterangan: e.target.value.toUpperCase() }))}
                    placeholder="Nama akun sekuritas"
                    className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:ring-indigo-500 focus:border-indigo-500"
                  />
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
                <p className="text-xs text-gray-400 mt-0.5">Kode BEI — otomatis ditambah .JK saat cek harga</p>
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
                  Modal: <span className="font-semibold text-gray-900">
                    {rp(parseFloat(form.hargaRata || '0') * parseInt(form.lot || '0') * 100)}
                  </span>
                </div>
              )}
            </div>

            <div className="mt-6 flex gap-3 justify-end">
              <button onClick={closeModal} className="px-4 py-2 text-sm font-medium text-gray-700 border border-gray-300 rounded-md hover:bg-gray-50">
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
