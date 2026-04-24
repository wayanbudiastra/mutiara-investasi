'use client'

import Link from 'next/link'

export function ProGate() {
  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center py-16 px-4">
      <div className="max-w-md w-full text-center">

        {/* Icon */}
        <div className="mx-auto mb-6 w-16 h-16 bg-indigo-100 rounded-full flex items-center justify-center">
          <svg className="w-8 h-8 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
          </svg>
        </div>

        {/* Badge */}
        <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-bold bg-indigo-600 text-white mb-4">
          FITUR PRO
        </span>

        <h2 className="text-2xl font-bold text-gray-900 mb-3">
          Akses Dibatasi
        </h2>
        <p className="text-gray-500 mb-8 leading-relaxed">
          Fitur ini tersedia untuk pengguna <strong>Pro</strong>.
          Berlangganan untuk mengakses Rekap Dividen, Rekap Chart, dan Daftar Sekuritas.
        </p>

        {/* Plans preview */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-8">
          {[
            { label: 'Bulanan',   price: 'Rp 15.000', sub: '/ bulan' },
            { label: 'Kuartalan', price: 'Rp 35.000', sub: '/ 3 bulan' },
            { label: 'Semester',  price: 'Rp 50.000', sub: '/ 6 bulan' },
            { label: 'Tahunan',   price: 'Rp 100.000', sub: '/ tahun', highlight: true },
          ].map(p => (
            <div
              key={p.label}
              className={`rounded-lg p-3 text-center border ${
                p.highlight
                  ? 'border-indigo-500 bg-indigo-50'
                  : 'border-gray-200 bg-white'
              }`}
            >
              <p className={`text-xs font-semibold mb-1 ${p.highlight ? 'text-indigo-700' : 'text-gray-600'}`}>
                {p.label}
              </p>
              <p className={`text-sm font-bold ${p.highlight ? 'text-indigo-700' : 'text-gray-900'}`}>
                {p.price}
              </p>
              <p className="text-xs text-gray-400">{p.sub}</p>
            </div>
          ))}
        </div>

        <Link
          href="/pricing"
          className="inline-flex items-center justify-center w-full px-6 py-3 bg-indigo-600 text-white text-sm font-semibold rounded-lg hover:bg-indigo-700 transition-colors"
        >
          Lihat Paket & Berlangganan
        </Link>

        <p className="mt-4 text-xs text-gray-400">
          Sudah berlangganan?{' '}
          <Link href="/subscription" className="text-indigo-600 hover:underline">
            Cek status langganan
          </Link>
        </p>
      </div>
    </div>
  )
}
