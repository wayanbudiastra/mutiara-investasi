'use client'

import { useState, useEffect, useCallback } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter, useSearchParams } from 'next/navigation'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from 'recharts'

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

const emptyForm = {
  bulan: 'Januari',
  tahun: new Date().getFullYear(),
  saham: '',
  dividen: '',
  lot: '',
  keterangan: '',
  status: 'ESTIMASI' as 'ESTIMASI' | 'DONE',
}

export default function DividendsPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const searchParams = useSearchParams()

  const [dividends, setDividends] = useState<Dividend[]>([])
  const [securities, setSecurities] = useState<Security[]>([])
  const [loading, setLoading] = useState(false)
  const [activeTab, setActiveTab] = useState<'data' | 'rekap'>('data')
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
      const res = await fetch('/api/dividends')
      if (res.ok) setDividends(await res.json())
    } finally {
      setLoading(false)
    }
  }, [])

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
      fetchDividends()
      const userId = (session?.user as any)?.id
      if (userId) fetchSecurities(userId)
    }
  }, [status, session, fetchDividends, fetchSecurities])

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

  const currentYear = new Date().getFullYear()

  const totalDone = doneDividends
    .filter(d => d.tahun === currentYear)
    .reduce((s, d) => s + Number(d.total), 0)
  const totalEstimasi = dividends
    .filter(d => d.status === 'ESTIMASI' && d.tahun === currentYear)
    .reduce((s, d) => s + Number(d.total), 0)

  const rp = (v: number) => `Rp ${v.toLocaleString('id-ID')}`

  if (status === 'loading') return null

  const canSave = !!(form.saham && form.dividen && form.lot && form.keterangan)

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">

        {/* Header */}
        <div className="mb-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Rekap Dividen</h1>
            <p className="mt-1 text-sm text-gray-500">{dividends.length} data tersimpan</p>
          </div>
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
            {(['data', 'rekap'] as const).map(tab => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`pb-3 text-sm font-medium border-b-2 transition-colors ${
                  activeTab === tab
                    ? 'border-indigo-600 text-indigo-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700'
                }`}
              >
                {tab === 'data' ? 'Data Dividen' : 'Rekap Chart'}
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
                            {rp(totalDone)}
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
      </div>

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
