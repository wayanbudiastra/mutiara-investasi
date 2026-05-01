'use client'

import { useState, useEffect, useCallback } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

interface Calculation {
  id: string
  stockSymbol: string
  quantity: number
  buyPricePerShare: number
  modal: number
  feeBuyAmount: number
  feeBuyPercentage: number
  feeSellPercentage: number
  targetProfitPercentage: number | null
  cutLossPercentage: number | null
  profitNetto: number | null
  returnPercentage: number | null
  createdAt: string
}

interface ApiResponse {
  calculations: Calculation[]
  total: number
  page: number
  limit: number
  totalPages: number
}

export default function HistoryPage() {
  const { status } = useSession()
  const router = useRouter()

  const [data, setData] = useState<ApiResponse | null>(null)
  const [loading, setLoading] = useState(false)
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState('')
  const [searchInput, setSearchInput] = useState('')
  const [deletingId, setDeletingId] = useState<string | null>(null)

  const limit = 10

  const fetchHistory = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams({
        page: String(page),
        limit: String(limit),
        ...(search ? { search } : {}),
      })
      const res = await fetch(`/api/calculations?${params}`)
      if (res.ok) {
        const json = await res.json()
        setData(json)
      }
    } finally {
      setLoading(false)
    }
  }, [page, search])

  useEffect(() => {
    if (status === 'unauthenticated') router.push('/login')
  }, [status, router])

  useEffect(() => {
    if (status === 'authenticated') fetchHistory()
  }, [status, fetchHistory])

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault()
    setPage(1)
    setSearch(searchInput.toUpperCase())
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Hapus simulasi ini?')) return
    setDeletingId(id)
    try {
      const res = await fetch(`/api/calculations/${id}`, { method: 'DELETE' })
      if (res.ok) fetchHistory()
    } finally {
      setDeletingId(null)
    }
  }

  const formatRp = (val: number | null) =>
    val != null ? `Rp ${val.toLocaleString('id-ID')}` : '-'

  if (status === 'loading') return null

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="w-full px-6 lg:px-10">
        <div className="mb-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Riwayat Simulasi</h1>
            <p className="mt-1 text-sm text-gray-500">
              {data ? `${data.total} simulasi tersimpan` : ''}
            </p>
          </div>

          {/* Search */}
          <form onSubmit={handleSearch} className="flex gap-2">
            <input
              type="text"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value.toUpperCase())}
              placeholder="Cari kode saham..."
              className="border border-gray-300 rounded-md px-3 py-2 text-sm focus:ring-indigo-500 focus:border-indigo-500 w-48"
            />
            <button
              type="submit"
              className="px-4 py-2 bg-indigo-600 text-white text-sm font-medium rounded-md hover:bg-indigo-700"
            >
              Cari
            </button>
            {search && (
              <button
                type="button"
                onClick={() => { setSearchInput(''); setSearch(''); setPage(1) }}
                className="px-3 py-2 bg-gray-200 text-gray-700 text-sm font-medium rounded-md hover:bg-gray-300"
              >
                Reset
              </button>
            )}
          </form>
        </div>

        <div className="bg-white shadow sm:rounded-lg overflow-hidden">
          {loading ? (
            <div className="p-12 text-center text-gray-500">Memuat data...</div>
          ) : !data || data.calculations.length === 0 ? (
            <div className="p-12 text-center text-gray-500">
              {search ? `Tidak ada data untuk kode saham "${search}"` : 'Belum ada simulasi tersimpan'}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">No</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Kode Saham</th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Qty (Lot)</th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Harga Beli/Lembar</th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Modal</th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Fee Beli</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Tanggal</th>
                    <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">Aksi</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {data.calculations.map((calc, idx) => {
                    const rowNum = (data.page - 1) * limit + idx + 1
                    return (
                      <tr key={calc.id} className="hover:bg-gray-50">
                        <td className="px-4 py-3 text-sm text-gray-500">{rowNum}</td>
                        <td className="px-4 py-3">
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold bg-indigo-100 text-indigo-800">
                            {calc.stockSymbol}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-sm text-right text-gray-900">
                          {calc.quantity / 100} lot
                        </td>
                        <td className="px-4 py-3 text-sm text-right text-gray-900">
                          {formatRp(calc.buyPricePerShare)}
                        </td>
                        <td className="px-4 py-3 text-sm text-right font-medium text-gray-900">
                          {formatRp(calc.modal)}
                        </td>
                        <td className="px-4 py-3 text-sm text-right text-gray-600">
                          {formatRp(calc.feeBuyAmount)}
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-500 whitespace-nowrap">
                          {new Date(calc.createdAt).toLocaleDateString('id-ID', {
                            day: '2-digit', month: 'short', year: 'numeric',
                          })}
                        </td>
                        <td className="px-4 py-3 text-center">
                          <div className="flex items-center justify-center gap-3">
                            <Link
                              href={`/history/${calc.id}`}
                              className="text-xs text-indigo-600 hover:text-indigo-800 font-medium"
                            >
                              Detail
                            </Link>
                            <button
                              onClick={() => handleDelete(calc.id)}
                              disabled={deletingId === calc.id}
                              className="text-xs text-red-600 hover:text-red-800 disabled:opacity-50"
                            >
                              {deletingId === calc.id ? '...' : 'Hapus'}
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

          {/* Pagination */}
          {data && data.totalPages > 1 && (
            <div className="bg-white px-4 py-3 flex items-center justify-between border-t border-gray-200 sm:px-6">
              <div className="text-sm text-gray-700">
                Menampilkan{' '}
                <span className="font-medium">{(data.page - 1) * limit + 1}</span>
                {' '}–{' '}
                <span className="font-medium">{Math.min(data.page * limit, data.total)}</span>
                {' '}dari{' '}
                <span className="font-medium">{data.total}</span> data
              </div>
              <div className="flex gap-1">
                <button
                  onClick={() => setPage(1)}
                  disabled={page === 1}
                  className="px-2 py-1 text-sm border rounded disabled:opacity-40 hover:bg-gray-50"
                >
                  «
                </button>
                <button
                  onClick={() => setPage(p => p - 1)}
                  disabled={page === 1}
                  className="px-3 py-1 text-sm border rounded disabled:opacity-40 hover:bg-gray-50"
                >
                  Prev
                </button>
                {Array.from({ length: data.totalPages }, (_, i) => i + 1)
                  .filter(p => Math.abs(p - page) <= 2)
                  .map(p => (
                    <button
                      key={p}
                      onClick={() => setPage(p)}
                      className={`px-3 py-1 text-sm border rounded ${
                        p === page
                          ? 'bg-indigo-600 text-white border-indigo-600'
                          : 'hover:bg-gray-50'
                      }`}
                    >
                      {p}
                    </button>
                  ))}
                <button
                  onClick={() => setPage(p => p + 1)}
                  disabled={page === data.totalPages}
                  className="px-3 py-1 text-sm border rounded disabled:opacity-40 hover:bg-gray-50"
                >
                  Next
                </button>
                <button
                  onClick={() => setPage(data.totalPages)}
                  disabled={page === data.totalPages}
                  className="px-2 py-1 text-sm border rounded disabled:opacity-40 hover:bg-gray-50"
                >
                  »
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
