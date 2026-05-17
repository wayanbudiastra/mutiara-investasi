'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'

const FEATURES = [
  { icon: '💰', title: 'Rekap Dividen Lengkap', desc: 'Lacak semua dividen yang sudah dan akan diterima dari saham portofoliomu.' },
  { icon: '📈', title: 'Rekap Chart per Tahun', desc: 'Visualisasi kinerja saham dalam grafik tahunan yang bersih dan mudah dibaca.' },
  { icon: '🏦', title: 'Rekap by Sekuritas', desc: 'Pisahkan dan bandingkan kepemilikan saham per akun broker secara otomatis.' },
  { icon: '📂', title: 'Rekap Portofolio', desc: 'Lihat floating P/L, nilai pasar, dan alokasi semua saham dalam satu dashboard.' },
  { icon: '📋', title: 'Daftar Sekuritas', desc: 'Direktori sekuritas yang kamu gunakan, terintegrasi dengan data portofolio.' },
  { icon: '🥧', title: 'Alokasi Saham', desc: 'Pie chart porsi kepemilikan saham dengan histori 5 tahun terakhir.' },
]

const PLANS = [
  { id: 'bulanan',   label: 'Bulanan',   price: 'Rp 15.000',  period: '1 bulan',  perBulan: null,              popular: false },
  { id: 'kuartalan', label: 'Kuartalan', price: 'Rp 35.000',  period: '3 bulan',  perBulan: 'Rp 11.667/bln',   popular: false },
  { id: 'semester',  label: 'Semester',  price: 'Rp 55.000',  period: '6 bulan',  perBulan: 'Rp 9.167/bln',    popular: false },
  { id: 'tahunan',   label: 'Tahunan',   price: 'Rp 100.000', period: '12 bulan', perBulan: 'Rp 8.333/bln',    popular: true  },
]

const PLAN_FEATURES = ['Rekap Dividen lengkap','Rekap Chart per tahun','Rekap By Sekuritas','Rekap Portofolio','Daftar Sekuritas']

function Navbar() {
  const [scrolled, setScrolled] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 60)
    window.addEventListener('scroll', onScroll)
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  return (
    <nav className={`fixed top-0 left-0 right-0 z-50 transition-all duration-200 ${scrolled ? 'bg-white shadow-sm' : 'bg-transparent'}`}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-2">
          <div className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center">
            <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
            </svg>
          </div>
          <span className="font-bold text-gray-900 text-sm">Mutiara Investasi</span>
        </Link>
        <div className="hidden md:flex items-center gap-8">
          <a href="#fitur" className="text-sm text-gray-600 hover:text-indigo-600 transition-colors">Fitur</a>
          <a href="#harga" className="text-sm text-gray-600 hover:text-indigo-600 transition-colors">Harga</a>
        </div>
        <div className="hidden md:flex items-center gap-3">
          <Link href="/login" className="text-sm font-medium text-gray-700 hover:text-indigo-600 px-4 py-2 rounded-lg">Masuk</Link>
          <Link href="/register" className="text-sm font-semibold text-white bg-indigo-600 hover:bg-indigo-700 px-4 py-2 rounded-lg">Daftar Gratis</Link>
        </div>
        <button onClick={() => setMenuOpen(o => !o)} className="md:hidden p-2 rounded-md text-gray-600">
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            {menuOpen
              ? <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              : <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />}
          </svg>
        </button>
      </div>
      {menuOpen && (
        <div className="md:hidden bg-white border-t border-gray-100 px-4 py-4 space-y-2">
          <a href="#fitur" onClick={() => setMenuOpen(false)} className="block text-sm text-gray-700 py-2">Fitur</a>
          <a href="#harga" onClick={() => setMenuOpen(false)} className="block text-sm text-gray-700 py-2">Harga</a>
          <Link href="/login" className="block text-sm font-medium text-gray-700 py-2">Masuk</Link>
          <Link href="/register" className="block text-sm font-semibold text-white bg-indigo-600 px-4 py-2.5 rounded-lg text-center">Daftar Gratis</Link>
        </div>
      )}
    </nav>
  )
}

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-white">
      <Navbar />

      {/* HERO */}
      <section className="pt-28 pb-20 bg-gradient-to-b from-indigo-50 to-white">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 text-center">
          <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold bg-indigo-100 text-indigo-700 mb-6">
            Platform Analisis Dividen IDX
          </span>
          <h1 className="text-4xl sm:text-5xl font-extrabold text-gray-900 leading-tight mb-6">
            Rekap Portofolio &amp; Dividen<br className="hidden sm:block" />
            <span className="text-indigo-600"> Saham Indonesia, Satu Tempat.</span>
          </h1>
          <p className="text-lg text-gray-600 max-w-2xl mx-auto mb-10 leading-relaxed">
            Pantau pertumbuhan dividen, analisis chart tahunan, dan kelola portofolio multi-sekuritas dengan mudah.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link href="/register" className="px-8 py-3.5 bg-indigo-600 text-white font-semibold rounded-xl hover:bg-indigo-700 transition-colors text-base">
              Mulai Sekarang — Gratis 30 Hari
            </Link>
            <a href="#fitur" className="px-8 py-3.5 border border-gray-300 text-gray-700 font-semibold rounded-xl hover:bg-gray-50 transition-colors text-base">
              Lihat Fitur
            </a>
          </div>
        </div>
      </section>

      {/* STATS BAR */}
      <section className="py-10 border-y border-gray-100 bg-white">
        <div className="max-w-5xl mx-auto px-4 grid grid-cols-2 sm:grid-cols-4 gap-6 text-center">
          {[
            { icon: '📊', label: 'Emiten Terlacak',  value: 'Multi Emiten' },
            { icon: '💰', label: 'Rekap Dividen',    value: 'Real-time' },
            { icon: '🏦', label: 'Multi-Sekuritas',  value: 'Semua Broker' },
            { icon: '📅', label: 'Histori Jurnal',   value: '5 Tahun' },
          ].map(s => (
            <div key={s.label}>
              <div className="text-2xl mb-1">{s.icon}</div>
              <div className="text-base font-bold text-gray-900">{s.value}</div>
              <div className="text-xs text-gray-500 mt-0.5">{s.label}</div>
            </div>
          ))}
        </div>
      </section>

      {/* FITUR */}
      <section id="fitur" className="py-20 bg-gray-50">
        <div className="max-w-6xl mx-auto px-4 sm:px-6">
          <div className="text-center mb-14">
            <h2 className="text-3xl font-extrabold text-gray-900 mb-3">Semua yang Kamu Butuhkan untuk Investasi Dividen</h2>
            <p className="text-gray-500 max-w-xl mx-auto">Dari rekap dividen hingga analisis alokasi portofolio — semuanya ada di satu platform.</p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {FEATURES.map(f => (
              <div key={f.title} className="bg-white rounded-2xl p-6 border border-gray-100 shadow-sm hover:shadow-md transition-shadow">
                <div className="text-3xl mb-4">{f.icon}</div>
                <h3 className="text-base font-bold text-gray-900 mb-2">{f.title}</h3>
                <p className="text-sm text-gray-500 leading-relaxed">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* HARGA */}
      <section id="harga" className="py-20 bg-white">
        <div className="max-w-5xl mx-auto px-4 sm:px-6">
          <div className="text-center mb-14">
            <h2 className="text-3xl font-extrabold text-gray-900 mb-3">Pilih Paket Langganan</h2>
            <p className="text-gray-500">Akses penuh ke semua fitur Pro. Makin panjang berlangganan, makin hemat per bulannya.</p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5 mb-6">
            {PLANS.map(plan => (
              <div key={plan.id} className={`relative bg-white rounded-2xl border-2 p-5 flex flex-col ${plan.popular ? 'border-indigo-500 shadow-lg' : 'border-gray-200'}`}>
                {plan.popular && (
                  <span className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-1 rounded-full text-xs font-bold bg-indigo-600 text-white whitespace-nowrap">Paling Hemat</span>
                )}
                <div className="mb-4">
                  <h3 className="font-bold text-gray-900 mb-0.5">{plan.label}</h3>
                  <p className="text-xs text-gray-400">{plan.period} akses penuh</p>
                </div>
                <div className="mb-5">
                  <span className="text-2xl font-extrabold text-gray-900">{plan.price}</span>
                  {plan.perBulan && <p className="text-xs text-green-600 mt-1 font-semibold">{plan.perBulan}</p>}
                </div>
                <ul className="space-y-1.5 mb-6 flex-1">
                  {PLAN_FEATURES.map(f => (
                    <li key={f} className="flex items-center gap-2 text-xs text-gray-600">
                      <svg className="w-3.5 h-3.5 text-green-500 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                      </svg>
                      {f}
                    </li>
                  ))}
                </ul>
                <Link href={`/register?plan=${plan.id}`}
                  className={`w-full py-2.5 rounded-lg text-sm font-semibold text-center transition-colors block ${plan.popular ? 'bg-indigo-600 text-white hover:bg-indigo-700' : 'bg-gray-100 text-gray-800 hover:bg-gray-200'}`}>
                  Pilih Paket
                </Link>
              </div>
            ))}
          </div>
          <p className="text-center text-xs text-gray-400">
            Metode pembayaran: Transfer Bank · Virtual Account · GoPay · OVO · DANA · ShopeePay · QRIS · Kartu Kredit/Debit
          </p>
        </div>
      </section>

      {/* CTA BOTTOM */}
      <section className="py-20 bg-indigo-600">
        <div className="max-w-2xl mx-auto px-4 text-center">
          <h2 className="text-3xl font-extrabold text-white mb-4">Siap Pantau Portofolio Dividenmu?</h2>
          <p className="text-indigo-200 mb-8">Daftar sekarang dan mulai kelola investasimu. Gratis 30 hari pertama.</p>
          <Link href="/register" className="inline-flex items-center justify-center px-8 py-3.5 bg-white text-indigo-700 font-bold rounded-xl hover:bg-indigo-50 transition-colors text-base">
            Daftar Sekarang
          </Link>
        </div>
      </section>

      {/* FOOTER */}
      <footer className="bg-gray-900 text-gray-400 py-12">
        <div className="max-w-6xl mx-auto px-4 sm:px-6">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-8 mb-8">
            <div>
              <div className="flex items-center gap-2 mb-3">
                <div className="w-7 h-7 bg-indigo-600 rounded-md flex items-center justify-center">
                  <svg className="w-3.5 h-3.5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                  </svg>
                </div>
                <span className="font-bold text-white text-sm">Mutiara Investasi</span>
              </div>
              <p className="text-xs leading-relaxed">Platform rekap dividen &amp; portofolio saham IDX untuk investor ritel Indonesia.</p>
            </div>
            <div>
              <p className="text-xs font-semibold text-gray-300 uppercase tracking-wider mb-3">Produk</p>
              <ul className="space-y-2 text-xs">
                <li><a href="#fitur" className="hover:text-white transition-colors">Fitur</a></li>
                <li><a href="#harga" className="hover:text-white transition-colors">Harga</a></li>
                <li><Link href="/register" className="hover:text-white transition-colors">Daftar</Link></li>
                <li><Link href="/login" className="hover:text-white transition-colors">Masuk</Link></li>
              </ul>
            </div>
            <div>
              <p className="text-xs font-semibold text-gray-300 uppercase tracking-wider mb-3">Sosial</p>
              <ul className="space-y-2 text-xs">
                <li>
                  <a href="https://www.youtube.com/@mutiarainvestasi/videos" target="_blank" rel="noopener noreferrer"
                    className="hover:text-white transition-colors flex items-center gap-1.5">
                    <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M23.498 6.186a3.016 3.016 0 00-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 00.502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 002.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 002.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/>
                    </svg>
                    YouTube
                  </a>
                </li>
                <li>
                  <a href="#" className="hover:text-white transition-colors flex items-center gap-1.5">
                    <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z"/>
                    </svg>
                    Instagram
                  </a>
                </li>
              </ul>
            </div>
          </div>
          <div className="border-t border-gray-800 pt-6 text-xs text-center">
            © 2026 Mutiara Investasi. All rights reserved.
          </div>
        </div>
      </footer>
    </div>
  )
}
