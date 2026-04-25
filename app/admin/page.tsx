'use client'

import { useEffect, useState } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'

interface UserRow {
  id: string
  name: string | null
  email: string
  createdAt: string
  plan: string | null
  subStatus: string | null
  startedAt: string | null
  expiredAt: string | null
  totalPaid: number
  paymentCount: number
}

const PLAN_LABELS: Record<string, string> = {
  FREE_TRIAL: 'Free Trial',
  MONTHLY:    'Bulanan',
  QUARTERLY:  'Kuartalan',
  SEMESTER:   'Semester',
  YEARLY:     'Tahunan',
}

const rp  = (v: number) => `Rp ${v.toLocaleString('id-ID')}`
const fmt = (d: string) => new Date(d).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })

function daysLeft(expiredAt: string | null) {
  if (!expiredAt) return null
  return Math.ceil((new Date(expiredAt).getTime() - Date.now()) / 86400000)
}

export default function AdminPage() {
  const { data: session, status } = useSession()
  const router = useRouter()

  const [users, setUsers]         = useState<UserRow[]>([])
  const [loading, setLoading]     = useState(true)
  const [forbidden, setForbidden] = useState(false)
  const [search, setSearch]       = useState('')
  const [filterPlan, setFilterPlan] = useState('')

  useEffect(() => {
    if (status === 'unauthenticated') router.push('/login')
  }, [status, router])

  useEffect(() => {
    if (status !== 'authenticated') return
    fetch('/api/admin/users')
      .then(r => {
        if (r.status === 403) { setForbidden(true); return [] }
        return r.json()
      })
      .then(data => { if (Array.isArray(data)) setUsers(data) })
      .finally(() => setLoading(false))
  }, [status])

  if (status === 'loading' || loading) return null

  if (forbidden) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="text-6xl mb-4">🔒</div>
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Akses Ditolak</h1>
          <p className="text-gray-500">Halaman ini hanya untuk Super Admin.</p>
        </div>
      </div>
    )
  }

  // Filter & search
  const filtered = users.filter(u => {
    const matchSearch = !search ||
      u.name?.toLowerCase().includes(search.toLowerCase()) ||
      u.email.toLowerCase().includes(search.toLowerCase())
    const matchPlan = !filterPlan ||
      (filterPlan === 'none' ? !u.plan : u.plan === filterPlan)
    return matchSearch && matchPlan
  })

  // Summary stats
  const totalUsers     = users.length
  const activeUsers    = users.filter(u => u.subStatus === 'ACTIVE').length
  const trialUsers     = users.filter(u => u.plan === 'FREE_TRIAL' && u.subStatus === 'ACTIVE').length
  const proUsers       = users.filter(u => u.plan && u.plan !== 'FREE_TRIAL' && u.subStatus === 'ACTIVE').length
  const totalRevenue   = users.reduce((s, u) => s + Number(u.totalPaid), 0)

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">

        {/* Header */}
        <div className="mb-6">
          <div className="flex items-center gap-3 mb-1">
            <span className="px-2 py-0.5 rounded text-xs font-bold bg-red-100 text-red-700">SUPER ADMIN</span>
            <h1 className="text-2xl font-bold text-gray-900">Monitoring User</h1>
          </div>
          <p className="text-sm text-gray-500">Daftar semua user terdaftar beserta status langganan aktif</p>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-4 mb-6">
          {[
            { label: 'Total User',    value: totalUsers,    color: 'text-gray-900' },
            { label: 'Akun Aktif',   value: activeUsers,   color: 'text-green-600' },
            { label: 'Free Trial',   value: trialUsers,    color: 'text-amber-600' },
            { label: 'Pro Berbayar', value: proUsers,      color: 'text-indigo-600' },
            { label: 'Total Revenue', value: rp(totalRevenue), color: 'text-green-700' },
          ].map(c => (
            <div key={c.label} className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
              <p className="text-xs text-gray-500 mb-1">{c.label}</p>
              <p className={`text-xl font-bold ${c.color}`}>{c.value}</p>
            </div>
          ))}
        </div>

        {/* Filter & Search */}
        <div className="mb-4 flex flex-wrap gap-3 items-center">
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Cari nama / email..."
            className="border border-gray-300 rounded-md px-3 py-1.5 text-sm w-56 focus:ring-indigo-500 focus:border-indigo-500"
          />
          <select
            value={filterPlan}
            onChange={e => setFilterPlan(e.target.value)}
            className="border border-gray-300 rounded-md px-3 py-1.5 text-sm focus:ring-indigo-500 focus:border-indigo-500"
          >
            <option value="">Semua Paket</option>
            <option value="FREE_TRIAL">Free Trial</option>
            <option value="MONTHLY">Bulanan</option>
            <option value="QUARTERLY">Kuartalan</option>
            <option value="SEMESTER">Semester</option>
            <option value="YEARLY">Tahunan</option>
            <option value="none">Tidak Ada Langganan</option>
          </select>
          {(search || filterPlan) && (
            <button
              onClick={() => { setSearch(''); setFilterPlan('') }}
              className="px-3 py-1.5 bg-gray-100 text-gray-600 text-sm rounded-md hover:bg-gray-200"
            >
              Reset
            </button>
          )}
          <span className="ml-auto text-xs text-gray-400">{filtered.length} user</span>
        </div>

        {/* Table */}
        <div className="bg-white shadow-sm rounded-lg border border-gray-200 overflow-hidden">
          {filtered.length === 0 ? (
            <div className="p-12 text-center text-gray-400">Tidak ada data</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm divide-y divide-gray-100">
                <thead className="bg-gray-50">
                  <tr>
                    {['No', 'Nama', 'Email', 'Tgl Daftar', 'Paket', 'Status', 'Berlaku Hingga', 'Sisa Hari', 'Total Bayar', 'Tx'].map(h => (
                      <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider whitespace-nowrap">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {filtered.map((u, idx) => {
                    const days     = daysLeft(u.expiredAt)
                    const isTrial  = u.plan === 'FREE_TRIAL'
                    const isPro    = u.plan && !isTrial && u.subStatus === 'ACTIVE'
                    const isExpired = !u.subStatus || u.subStatus !== 'ACTIVE'

                    return (
                      <tr key={u.id} className="hover:bg-gray-50">
                        <td className="px-4 py-3 text-gray-400 text-xs">{idx + 1}</td>
                        <td className="px-4 py-3 font-medium text-gray-900 whitespace-nowrap">
                          {u.name ?? <span className="text-gray-400 italic">—</span>}
                        </td>
                        <td className="px-4 py-3 text-gray-600 whitespace-nowrap">{u.email}</td>
                        <td className="px-4 py-3 text-gray-500 whitespace-nowrap">{fmt(u.createdAt)}</td>
                        <td className="px-4 py-3 whitespace-nowrap">
                          {u.plan ? (
                            <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-bold ${
                              isTrial  ? 'bg-amber-100 text-amber-700' :
                              isPro    ? 'bg-indigo-100 text-indigo-700' :
                              'bg-gray-100 text-gray-500'
                            }`}>
                              {PLAN_LABELS[u.plan] ?? u.plan}
                            </span>
                          ) : (
                            <span className="text-gray-300 text-xs">—</span>
                          )}
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap">
                          {u.subStatus === 'ACTIVE' ? (
                            <span className="inline-flex items-center gap-1 text-xs font-bold text-green-700">
                              <span className="w-1.5 h-1.5 rounded-full bg-green-500 inline-block" />
                              AKTIF
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-xs font-bold text-gray-400">
                              <span className="w-1.5 h-1.5 rounded-full bg-gray-300 inline-block" />
                              {isExpired ? 'TIDAK AKTIF' : u.subStatus ?? '—'}
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-gray-600 whitespace-nowrap">
                          {u.expiredAt ? fmt(u.expiredAt) : <span className="text-gray-300">—</span>}
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap">
                          {days !== null ? (
                            <span className={`text-xs font-semibold ${
                              days <= 0  ? 'text-red-600' :
                              days <= 7  ? 'text-orange-500' :
                              days <= 30 ? 'text-yellow-600' :
                              'text-green-600'
                            }`}>
                              {days <= 0 ? 'Habis' : `${days} hari`}
                            </span>
                          ) : (
                            <span className="text-gray-300 text-xs">—</span>
                          )}
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap">
                          <span className={`text-xs font-semibold ${Number(u.totalPaid) > 0 ? 'text-green-700' : 'text-gray-400'}`}>
                            {Number(u.totalPaid) > 0 ? rp(Number(u.totalPaid)) : '—'}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-center">
                          <span className="text-xs text-gray-500">{Number(u.paymentCount)}</span>
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
    </div>
  )
}
