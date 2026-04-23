'use client'

import { useEffect, useState, useCallback } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { ProGate } from '@/components/ProGate'

type Security = {
  id: string
  userId: string
  nama: string
  kode: string
  status: 'ACTIVE' | 'INACTIVE'
}

interface ApiResponse {
  securities: Security[]
  total: number
  page: number
  limit: number
  totalPages: number
}

const emptyForm = { nama: '', kode: '', status: 'ACTIVE' as 'ACTIVE' | 'INACTIVE' }
const LIMIT = 10

export default function SecuritiesPage() {
  const { data: session, status: authStatus } = useSession()
  const router = useRouter()

  const [proAccess, setProAccess] = useState<{ hasAccess: boolean } | null>(null)
  const [data, setData] = useState<ApiResponse | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [page, setPage] = useState(1)
  const [searchInput, setSearchInput] = useState('')
  const [search, setSearch] = useState('')

  const [showModal, setShowModal] = useState(false)
  const [editItem, setEditItem] = useState<Security | null>(null)
  const [form, setForm] = useState(emptyForm)
  const [saving, setSaving] = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)

  const userId = (session?.user as any)?.id as string | undefined

  const fetchSecurities = useCallback(async () => {
    if (!userId) return
    setLoading(true)
    try {
      const params = new URLSearchParams({
        userId,
        page: String(page),
        limit: String(LIMIT),
        ...(search ? { search } : {}),
      })
      const res = await fetch(`/api/securities?${params}`)
      if (!res.ok) throw new Error('Gagal memuat data sekuritas')
      setData(await res.json())
      setError('')
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setLoading(false)
    }
  }, [userId, page, search])

  useEffect(() => {
    if (authStatus === 'unauthenticated') router.push('/login')
  }, [authStatus, router])

  useEffect(() => {
    if (authStatus === 'authenticated') fetchSecurities()
  }, [authStatus, fetchSecurities])

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault()
    setPage(1)
    setSearch(searchInput.trim())
  }

  const resetSearch = () => {
    setSearchInput('')
    setSearch('')
    setPage(1)
  }

  const openAdd = () => {
    setEditItem(null)
    setForm(emptyForm)
    setShowModal(true)
  }

  const openEdit = (sec: Security) => {
    setEditItem(sec)
    setForm({ nama: sec.nama, kode: sec.kode, status: sec.status })
    setShowModal(true)
  }

  const closeModal = () => {
    setShowModal(false)
    setEditItem(null)
  }

  const handleSave = async () => {
    if (!form.nama || !form.kode || !userId) return
    setSaving(true)
    try {
      const isEdit = !!editItem
      const res = await fetch('/api/securities', {
        method: isEdit ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(isEdit ? { id: editItem.id, userId, ...form } : { userId, ...form }),
      })
      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error ?? 'Gagal menyimpan')
      }
      closeModal()
      fetchSecurities()
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (sec: Security) => {
    if (!confirm(`Hapus sekuritas "${sec.nama} (${sec.kode})"?`)) return
    setDeletingId(sec.id)
    try {
      const res = await fetch(`/api/securities?id=${sec.id}&userId=${userId}`, { method: 'DELETE' })
      if (!res.ok) throw new Error('Gagal menghapus')
      fetchSecurities()
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setDeletingId(null)
    }
  }

  useEffect(() => {
    if (authStatus === 'authenticated') {
      fetch('/api/subscription/status').then(r => r.json()).then(setProAccess)
    }
  }, [authStatus])

  if (authStatus === 'loading' || proAccess === null) return null
  if (!proAccess.hasAccess) return <ProGate />

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">

        {/* Header */}
        <div className="mb-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Daftar Sekuritas</h1>
            <p className="mt-1 text-sm text-gray-500">
              {data ? `${data.total} sekuritas terdaftar` : ''}
            </p>
          </div>

          <div className="flex items-center gap-3">
            {/* Search */}
            <form onSubmit={handleSearch} className="flex gap-2">
              <input
                type="text"
                value={searchInput}
                onChange={e => setSearchInput(e.target.value)}
                placeholder="Cari nama / kode..."
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
                  onClick={resetSearch}
                  className="px-3 py-2 bg-gray-200 text-gray-700 text-sm font-medium rounded-md hover:bg-gray-300"
                >
                  Reset
                </button>
              )}
            </form>

            <button
              onClick={openAdd}
              className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white text-sm font-medium rounded-md hover:bg-indigo-700 whitespace-nowrap"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              Tambah Sekuritas
            </button>
          </div>
        </div>

        {error && (
          <div className="mb-4 rounded-md bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        )}

        {/* Table */}
        <div className="bg-white shadow sm:rounded-lg overflow-hidden">
          {loading ? (
            <div className="p-12 text-center text-gray-500">Memuat data...</div>
          ) : !data || data.securities.length === 0 ? (
            <div className="p-12 text-center text-gray-500">
              {search
                ? `Tidak ada data untuk pencarian "${search}"`
                : <>Belum ada sekuritas. Klik <span className="font-semibold text-indigo-600">Tambah Sekuritas</span> untuk menambahkan.</>
              }
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">No</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap">Nama Sekuritas</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap">Kode Sekuritas</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                    <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">Aksi</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {data.securities.map((sec, idx) => {
                    const rowNum = (data.page - 1) * LIMIT + idx + 1
                    return (
                      <tr key={sec.id} className="hover:bg-gray-50">
                        <td className="px-4 py-3 text-sm text-gray-500">{rowNum}</td>
                        <td className="px-4 py-3 text-sm font-medium text-gray-900 whitespace-nowrap">{sec.nama}</td>
                        <td className="px-4 py-3 whitespace-nowrap">
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold bg-indigo-100 text-indigo-800">
                            {sec.kode}
                          </span>
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap">
                          <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-bold ${
                            sec.status === 'ACTIVE'
                              ? 'bg-green-100 text-green-800'
                              : 'bg-gray-100 text-gray-500'
                          }`}>
                            {sec.status}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-center">
                          <div className="flex items-center justify-center gap-3">
                            <button
                              onClick={() => openEdit(sec)}
                              className="text-xs text-indigo-600 hover:text-indigo-800 font-medium"
                            >
                              Edit
                            </button>
                            <button
                              onClick={() => handleDelete(sec)}
                              disabled={deletingId === sec.id}
                              className="text-xs text-red-600 hover:text-red-800 disabled:opacity-50"
                            >
                              {deletingId === sec.id ? '...' : 'Hapus'}
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
                <span className="font-medium">{(data.page - 1) * LIMIT + 1}</span>
                {' '}–{' '}
                <span className="font-medium">{Math.min(data.page * LIMIT, data.total)}</span>
                {' '}dari{' '}
                <span className="font-medium">{data.total}</span> data
              </div>
              <div className="flex gap-1">
                <button
                  onClick={() => setPage(1)}
                  disabled={page === 1}
                  className="px-2 py-1 text-sm border rounded disabled:opacity-40 hover:bg-gray-50"
                >«</button>
                <button
                  onClick={() => setPage(p => p - 1)}
                  disabled={page === 1}
                  className="px-3 py-1 text-sm border rounded disabled:opacity-40 hover:bg-gray-50"
                >Prev</button>
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
                    >{p}</button>
                  ))}
                <button
                  onClick={() => setPage(p => p + 1)}
                  disabled={page === data.totalPages}
                  className="px-3 py-1 text-sm border rounded disabled:opacity-40 hover:bg-gray-50"
                >Next</button>
                <button
                  onClick={() => setPage(data.totalPages)}
                  disabled={page === data.totalPages}
                  className="px-2 py-1 text-sm border rounded disabled:opacity-40 hover:bg-gray-50"
                >»</button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Add / Edit Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="fixed inset-0 bg-black/40" onClick={closeModal} />
          <div className="relative z-50 bg-white rounded-xl shadow-2xl w-full max-w-sm mx-4 p-6">
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-lg font-bold text-gray-900">
                {editItem ? 'Edit Sekuritas' : 'Tambah Sekuritas'}
              </h2>
              <button onClick={closeModal} className="text-gray-400 hover:text-gray-600">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">
                  Nama Sekuritas <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={form.nama}
                  onChange={e => setForm(f => ({ ...f, nama: e.target.value }))}
                  placeholder="cth: IPOT, POEMS, BCA Sekuritas"
                  className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:ring-indigo-500 focus:border-indigo-500"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">
                  Kode Sekuritas <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={form.kode}
                  onChange={e => setForm(f => ({ ...f, kode: e.target.value.toUpperCase() }))}
                  placeholder="cth: IPOT01"
                  className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:ring-indigo-500 focus:border-indigo-500"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Status</label>
                <select
                  value={form.status}
                  onChange={e => setForm(f => ({ ...f, status: e.target.value as any }))}
                  className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:ring-indigo-500 focus:border-indigo-500"
                >
                  <option value="ACTIVE">ACTIVE</option>
                  <option value="INACTIVE">INACTIVE</option>
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
                disabled={saving || !form.nama || !form.kode}
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
