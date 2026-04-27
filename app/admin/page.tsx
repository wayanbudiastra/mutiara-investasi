'use client'

import { useEffect, useState, useCallback } from 'react'
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
  isGranted: boolean
  subscriptionId: string | null
  grantNote: string | null
  totalPaid: number
  paymentCount: number
}

const PLAN_LABELS: Record<string, string> = {
  FREE_TRIAL: 'Free Trial',
  GRANTED:    'Akses Khusus',
  MONTHLY:    'Bulanan',
  QUARTERLY:  'Kuartalan',
  SEMESTER:   'Semester',
  YEARLY:     'Tahunan',
}

const rp  = (v: number) => `Rp ${v.toLocaleString('id-ID')}`
const fmt = (d: string) => new Date(d).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })
const daysLeft = (exp: string | null) => exp ? Math.ceil((new Date(exp).getTime() - Date.now()) / 86400000) : null

const DURATION_OPTIONS = [
  { label: '7 hari',  value: 7 },
  { label: '30 hari', value: 30 },
  { label: '90 hari', value: 90 },
  { label: 'Custom',  value: 0 },
]

export default function AdminPage() {
  const { status } = useSession()
  const router = useRouter()

  const [users, setUsers]         = useState<UserRow[]>([])
  const [loading, setLoading]     = useState(true)
  const [forbidden, setForbidden] = useState(false)
  const [search, setSearch]       = useState('')
  const [filterPlan, setFilterPlan] = useState('')

  // Modal state
  const [grantTarget, setGrantTarget]   = useState<UserRow | null>(null)
  const [duration, setDuration]         = useState(30)
  const [customDays, setCustomDays]     = useState('')
  const [grantNote, setGrantNote]       = useState('')
  const [selectedDuration, setSelectedDuration] = useState(30)
  const [saving, setSaving]             = useState(false)
  const [toastMsg, setToastMsg]         = useState('')

  useEffect(() => {
    if (status === 'unauthenticated') router.push('/login')
  }, [status, router])

  const fetchUsers = useCallback(() => {
    fetch('/api/admin/users')
      .then(r => { if (r.status === 403) { setForbidden(true); return null } return r.json() })
      .then(data => { if (data && Array.isArray(data)) setUsers(data) })
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => { if (status === 'authenticated') fetchUsers() }, [status, fetchUsers])

  const toast = (msg: string) => { setToastMsg(msg); setTimeout(() => setToastMsg(''), 3000) }

  const handleGrant = async () => {
    if (!grantTarget) return
    const days = selectedDuration === 0 ? parseInt(customDays) : selectedDuration
    if (!days || days < 1) return
    setSaving(true)
    try {
      const res = await fetch('/api/admin/members', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ targetUserId: grantTarget.id, durationDays: days, note: grantNote }),
      })
      if (!res.ok) throw new Error((await res.json()).error)
      const data = await res.json()
      toast(`✓ Akses diberikan hingga ${fmt(data.expiredAt)}`)
      setGrantTarget(null)
      setGrantNote('')
      fetchUsers()
    } catch (e) { toast(`✗ ${(e as Error).message}`) }
    finally { setSaving(false) }
  }

  const handleRevoke = async (u: UserRow) => {
    if (!confirm(`Cabut akses khusus untuk ${u.name ?? u.email}?`)) return
    const res = await fetch('/api/admin/members', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'revoke', subscriptionId: u.subscriptionId }),
    })
    if (res.ok) { toast('✓ Akses berhasil dicabut'); fetchUsers() }
    else toast('✗ Gagal mencabut akses')
  }

  const handleExtend = async (u: UserRow) => {
    const input = prompt(`Perpanjang akses ${u.name ?? u.email} berapa hari?`, '30')
    const days  = parseInt(input ?? '')
    if (!days || days < 1) return
    const res = await fetch('/api/admin/members', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'extend', subscriptionId: u.subscriptionId, additionalDays: days }),
    })
    if (res.ok) {
      const data = await res.json()
      toast(`✓ Diperpanjang hingga ${fmt(data.expiredAt)}`)
      fetchUsers()
    } else toast('✗ Gagal memperpanjang akses')
  }

  if (status === 'loading' || loading) return null
  if (forbidden) return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <div className="text-center">
        <div className="text-6xl mb-4">🔒</div>
        <h1 className="text-2xl font-bold text-gray-900 mb-2">Akses Ditolak</h1>
        <p className="text-gray-500">Halaman ini hanya untuk Super Admin.</p>
      </div>
    </div>
  )

  const filtered = users.filter(u => {
    const matchSearch = !search ||
      u.name?.toLowerCase().includes(search.toLowerCase()) ||
      u.email.toLowerCase().includes(search.toLowerCase())
    const matchPlan = !filterPlan ||
      (filterPlan === 'none' ? !u.plan : u.plan === filterPlan)
    return matchSearch && matchPlan
  })

  const totalUsers   = users.length
  const activeUsers  = users.filter(u => u.subStatus === 'ACTIVE').length
  const trialUsers   = users.filter(u => u.plan === 'FREE_TRIAL' && u.subStatus === 'ACTIVE').length
  const grantedUsers = users.filter(u => u.isGranted && u.subStatus === 'ACTIVE').length
  const proUsers     = users.filter(u => u.plan && !['FREE_TRIAL','GRANTED'].includes(u.plan) && u.subStatus === 'ACTIVE').length
  const totalRevenue = users.reduce((s, u) => s + Number(u.totalPaid), 0)

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">

        {/* Toast */}
        {toastMsg && (
          <div className="fixed top-4 right-4 z-50 bg-gray-900 text-white text-sm px-4 py-2.5 rounded-lg shadow-lg">
            {toastMsg}
          </div>
        )}

        {/* Header */}
        <div className="mb-6">
          <div className="flex items-center gap-3 mb-1">
            <span className="px-2 py-0.5 rounded text-xs font-bold bg-red-100 text-red-700">SUPER ADMIN</span>
            <h1 className="text-2xl font-bold text-gray-900">Monitoring User</h1>
          </div>
          <p className="text-sm text-gray-500">Daftar semua user terdaftar beserta status langganan aktif</p>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-6 gap-3 mb-6">
          {[
            { label: 'Total User',     value: totalUsers,       color: 'text-gray-900' },
            { label: 'Akun Aktif',     value: activeUsers,      color: 'text-green-600' },
            { label: 'Free Trial',     value: trialUsers,       color: 'text-amber-600' },
            { label: 'Akses Khusus',   value: grantedUsers,     color: 'text-purple-600' },
            { label: 'Pro Berbayar',   value: proUsers,         color: 'text-indigo-600' },
            { label: 'Total Revenue',  value: rp(totalRevenue), color: 'text-green-700' },
          ].map(c => (
            <div key={c.label} className="bg-white rounded-lg shadow-sm border border-gray-200 p-3">
              <p className="text-xs text-gray-500 mb-1">{c.label}</p>
              <p className={`text-lg font-bold ${c.color}`}>{c.value}</p>
            </div>
          ))}
        </div>

        {/* Filter & Search */}
        <div className="mb-4 flex flex-wrap gap-3 items-center">
          <input type="text" value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Cari nama / email..."
            className="border border-gray-300 rounded-md px-3 py-1.5 text-sm w-56 focus:ring-indigo-500 focus:border-indigo-500" />
          <select value={filterPlan} onChange={e => setFilterPlan(e.target.value)}
            className="border border-gray-300 rounded-md px-3 py-1.5 text-sm focus:ring-indigo-500 focus:border-indigo-500">
            <option value="">Semua Paket</option>
            <option value="FREE_TRIAL">Free Trial</option>
            <option value="GRANTED">Akses Khusus</option>
            <option value="MONTHLY">Bulanan</option>
            <option value="QUARTERLY">Kuartalan</option>
            <option value="SEMESTER">Semester</option>
            <option value="YEARLY">Tahunan</option>
            <option value="none">Tidak Ada Langganan</option>
          </select>
          {(search || filterPlan) && (
            <button onClick={() => { setSearch(''); setFilterPlan('') }}
              className="px-3 py-1.5 bg-gray-100 text-gray-600 text-sm rounded-md hover:bg-gray-200">Reset</button>
          )}
          <span className="ml-auto text-xs text-gray-400">{filtered.length} user</span>
        </div>

        {/* Table */}
        <div className="bg-white shadow-sm rounded-lg border border-gray-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm divide-y divide-gray-100">
              <thead className="bg-gray-50">
                <tr>
                  {['No','Nama','Email','Tgl Daftar','Paket','Status','Berlaku Hingga','Sisa','Revenue','Aksi'].map(h => (
                    <th key={h} className="px-3 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filtered.length === 0 ? (
                  <tr><td colSpan={10} className="p-12 text-center text-gray-400">Tidak ada data</td></tr>
                ) : filtered.map((u, idx) => {
                  const days      = daysLeft(u.expiredAt)
                  const isTrial   = u.plan === 'FREE_TRIAL'
                  const isGranted = u.isGranted
                  const isPro     = u.plan && !isTrial && !isGranted && u.subStatus === 'ACTIVE'
                  const isActive  = u.subStatus === 'ACTIVE'

                  return (
                    <tr key={u.id} className={`hover:bg-gray-50 ${isGranted ? 'bg-purple-50/30' : ''}`}>
                      <td className="px-3 py-3 text-gray-400 text-xs">{idx + 1}</td>
                      <td className="px-3 py-3 font-medium text-gray-900 whitespace-nowrap">
                        {u.name ?? <span className="text-gray-400 italic text-xs">—</span>}
                      </td>
                      <td className="px-3 py-3 text-gray-600 whitespace-nowrap text-xs">{u.email}</td>
                      <td className="px-3 py-3 text-gray-500 whitespace-nowrap text-xs">{fmt(u.createdAt)}</td>
                      <td className="px-3 py-3 whitespace-nowrap">
                        {u.plan ? (
                          <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-bold ${
                            isGranted ? 'bg-purple-100 text-purple-700' :
                            isTrial   ? 'bg-amber-100 text-amber-700' :
                            isPro     ? 'bg-indigo-100 text-indigo-700' :
                                        'bg-gray-100 text-gray-500'
                          }`}>
                            {PLAN_LABELS[u.plan] ?? u.plan}
                          </span>
                        ) : <span className="text-gray-300 text-xs">—</span>}
                        {u.grantNote && (
                          <p className="text-xs text-purple-500 mt-0.5 max-w-28 truncate" title={u.grantNote}>
                            {u.grantNote}
                          </p>
                        )}
                      </td>
                      <td className="px-3 py-3 whitespace-nowrap">
                        {isActive ? (
                          <span className="inline-flex items-center gap-1 text-xs font-bold text-green-700">
                            <span className="w-1.5 h-1.5 rounded-full bg-green-500" />AKTIF
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-xs font-bold text-gray-400">
                            <span className="w-1.5 h-1.5 rounded-full bg-gray-300" />TIDAK AKTIF
                          </span>
                        )}
                      </td>
                      <td className="px-3 py-3 text-gray-600 whitespace-nowrap text-xs">
                        {u.expiredAt ? fmt(u.expiredAt) : <span className="text-gray-300">—</span>}
                      </td>
                      <td className="px-3 py-3 whitespace-nowrap">
                        {days !== null ? (
                          <span className={`text-xs font-semibold ${
                            days <= 0 ? 'text-red-600' : days <= 7 ? 'text-orange-500' :
                            days <= 30 ? 'text-yellow-600' : 'text-green-600'
                          }`}>
                            {days <= 0 ? 'Habis' : `${days}h`}
                          </span>
                        ) : <span className="text-gray-300 text-xs">—</span>}
                      </td>
                      <td className="px-3 py-3 whitespace-nowrap text-xs">
                        <span className={Number(u.totalPaid) > 0 ? 'text-green-700 font-semibold' : 'text-gray-400'}>
                          {Number(u.totalPaid) > 0 ? rp(Number(u.totalPaid)) : '—'}
                        </span>
                      </td>
                      <td className="px-3 py-3 whitespace-nowrap">
                        <div className="flex items-center gap-1">
                          {/* Tombol Berikan Akses — selalu tampil */}
                          <button
                            onClick={() => { setGrantTarget(u); setSelectedDuration(30); setCustomDays(''); setGrantNote('') }}
                            className="px-2 py-1 text-xs font-medium bg-purple-100 text-purple-700 rounded hover:bg-purple-200 whitespace-nowrap"
                          >
                            + Akses
                          </button>
                          {/* Tombol Cabut & Perpanjang — hanya jika punya granted aktif */}
                          {isGranted && isActive && u.subscriptionId && (
                            <>
                              <button
                                onClick={() => handleExtend(u)}
                                className="px-2 py-1 text-xs font-medium bg-blue-100 text-blue-700 rounded hover:bg-blue-200"
                              >
                                +Hari
                              </button>
                              <button
                                onClick={() => handleRevoke(u)}
                                className="px-2 py-1 text-xs font-medium bg-red-100 text-red-700 rounded hover:bg-red-200"
                              >
                                Cabut
                              </button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Modal Grant Akses */}
      {grantTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="fixed inset-0 bg-black/40" onClick={() => setGrantTarget(null)} />
          <div className="relative z-50 bg-white rounded-xl shadow-2xl w-full max-w-sm mx-4 p-6">
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-base font-bold text-gray-900">Berikan Akses Khusus</h2>
              <button onClick={() => setGrantTarget(null)} className="text-gray-400 hover:text-gray-600">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* User info */}
            <div className="bg-purple-50 rounded-lg px-3 py-2 mb-4">
              <p className="text-xs font-semibold text-purple-900">{grantTarget.name ?? '—'}</p>
              <p className="text-xs text-purple-600">{grantTarget.email}</p>
            </div>

            {/* Pilih durasi */}
            <div className="mb-4">
              <label className="block text-xs font-medium text-gray-700 mb-2">Durasi Akses</label>
              <div className="grid grid-cols-4 gap-2">
                {DURATION_OPTIONS.map(opt => (
                  <button
                    key={opt.value}
                    onClick={() => setSelectedDuration(opt.value)}
                    className={`py-2 rounded-lg text-xs font-semibold border transition-colors ${
                      selectedDuration === opt.value
                        ? 'bg-purple-600 text-white border-purple-600'
                        : 'bg-white text-gray-700 border-gray-300 hover:border-purple-400'
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
              {selectedDuration === 0 && (
                <div className="mt-2">
                  <input
                    type="number"
                    value={customDays}
                    onChange={e => setCustomDays(e.target.value)}
                    placeholder="Jumlah hari"
                    min={1}
                    className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:ring-purple-500 focus:border-purple-500"
                  />
                </div>
              )}
            </div>

            {/* Catatan */}
            <div className="mb-5">
              <label className="block text-xs font-medium text-gray-700 mb-1">Catatan (opsional)</label>
              <input
                type="text"
                value={grantNote}
                onChange={e => setGrantNote(e.target.value)}
                placeholder="cth: Beta tester, Kolega, dll"
                className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:ring-purple-500 focus:border-purple-500"
              />
            </div>

            {/* Preview */}
            <div className="bg-gray-50 rounded-lg px-3 py-2 mb-5 text-xs text-gray-600">
              Akses berlaku <strong>{selectedDuration === 0 ? (customDays || '?') : selectedDuration} hari</strong>
              {' '}mulai sekarang hingga{' '}
              <strong>
                {fmt(new Date(Date.now() + ((selectedDuration === 0 ? parseInt(customDays) || 0 : selectedDuration) * 86400000)).toISOString())}
              </strong>
            </div>

            <div className="flex gap-3 justify-end">
              <button onClick={() => setGrantTarget(null)}
                className="px-4 py-2 text-sm text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50">
                Batal
              </button>
              <button
                onClick={handleGrant}
                disabled={saving || (selectedDuration === 0 && (!customDays || parseInt(customDays) < 1))}
                className="px-4 py-2 text-sm font-semibold text-white bg-purple-600 rounded-lg hover:bg-purple-700 disabled:opacity-50"
              >
                {saving ? 'Menyimpan...' : 'Berikan Akses'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
