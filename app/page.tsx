'use client'

import { useState } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { calculateAdvancedStockProfit, CalculationBreakdown } from '@/lib/calculations'

type InputMode = 'lot' | 'nominal'

export default function AdvancedCalculator() {
  const { data: session, status } = useSession()
  const router = useRouter()

  // Input states
  const [inputMode, setInputMode] = useState<InputMode>('lot')
  const [symbol, setSymbol] = useState('')
  const [quantity, setQuantity] = useState<number>(0)
  const [buyPricePerShare, setBuyPricePerShare] = useState<number>(0)
  const [nominal, setNominal] = useState<number>(0)
  const [sellPricePerShare, setSellPricePerShare] = useState<number>(0)
  const [targetProfitPercentage, setTargetProfitPercentage] = useState<number>(10)
  const [cutLossPercentage, setCutLossPercentage] = useState<number>(5)
  const [feeBuyPercentage, setFeeBuyPercentage] = useState<number>(0.19)
  const [feeSellPercentage, setFeeSellPercentage] = useState<number>(0.29)

  const [result, setResult] = useState<CalculationBreakdown | null>(null)
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState('')
  const [saveError, setSaveError] = useState('')

  if (status === 'unauthenticated') {
    router.push('/login')
    return null
  }

  // Auto-calculate quantity when using nominal mode
  const handleNominalChange = (value: number) => {
    setNominal(value)
    if (buyPricePerShare > 0) {
      const calculatedQuantity = Math.floor(value / buyPricePerShare / 100) * 100
      setQuantity(calculatedQuantity)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    if (!symbol.trim()) {
      setError('Stock symbol is required')
      return
    }

    if (buyPricePerShare <= 0) {
      setError('Buy price must be greater than 0')
      return
    }

    const finalQuantity = inputMode === 'lot'
      ? quantity
      : Math.floor(nominal / buyPricePerShare / 100) * 100

    if (finalQuantity <= 0) {
      setError('Quantity must be greater than 0')
      return
    }

    setLoading(true)
    setSaved(false)
    setSaveError('')

    try {
      const breakdown = calculateAdvancedStockProfit({
        stockSymbol: symbol,
        quantity: finalQuantity,
        buyPricePerShare,
        sellPricePerShare: sellPricePerShare > 0 ? sellPricePerShare : undefined,
        feeBuyPercentage,
        feeSellPercentage,
        targetProfitPercentage: targetProfitPercentage > 0 ? targetProfitPercentage : undefined,
        cutLossPercentage: cutLossPercentage > 0 ? cutLossPercentage : undefined,
      })

      setResult(breakdown)
    } catch (err) {
      setError('An error occurred during calculation')
    } finally {
      setLoading(false)
    }
  }

  const handleSave = async () => {
    if (!result) return
    setSaving(true)
    setSaveError('')

    const finalQuantity = inputMode === 'lot'
      ? quantity
      : Math.floor(nominal / buyPricePerShare / 100) * 100

    try {
      const response = await fetch('/api/calculations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          stockSymbol: symbol,
          quantity: finalQuantity,
          buyPricePerShare,
          sellPricePerShare: sellPricePerShare > 0 ? sellPricePerShare : undefined,
          feeBuyPercentage,
          feeSellPercentage,
          targetProfitPercentage: targetProfitPercentage > 0 ? targetProfitPercentage : undefined,
          cutLossPercentage: cutLossPercentage > 0 ? cutLossPercentage : undefined,
          modal: result.modal,
          feeBuyAmount: result.feeBuyAmount,
          profitNetto: result.profitNetto,
          returnPercentage: result.returnPercentage,
        }),
      })

      if (response.ok) {
        setSaved(true)
      } else {
        const errData = await response.json().catch(() => ({}))
        setSaveError(errData.error || 'Gagal menyimpan simulasi')
      }
    } catch (e) {
      setSaveError('Gagal menyimpan simulasi')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-screen-2xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-gray-900">Advanced Stock Calculator</h1>
          <p className="mt-2 text-gray-600">Kalkulator saham lengkap dengan fee breakdown Indonesia</p>
          {session?.user?.name && (
            <p className="mt-1 text-sm text-gray-500">Welcome, {session.user.name}! 👋</p>
          )}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Form Section */}
          <div className="lg:col-span-1">
            <div className="bg-white shadow sm:rounded-lg sticky top-8">
              <div className="px-4 py-5 sm:p-6">
                <h3 className="text-lg leading-6 font-medium text-gray-900 mb-6">
                  CARA INPUT MODAL
                </h3>

                {/* Input Mode Tabs */}
                <div className="flex gap-2 mb-6">
                  <button
                    onClick={() => setInputMode('lot')}
                    className={`flex-1 py-2 px-3 text-sm font-medium rounded-md transition-colors ${
                      inputMode === 'lot'
                        ? 'bg-indigo-600 text-white'
                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    }`}
                  >
                    Input via lot
                  </button>
                  <button
                    onClick={() => setInputMode('nominal')}
                    className={`flex-1 py-2 px-3 text-sm font-medium rounded-md transition-colors ${
                      inputMode === 'nominal'
                        ? 'bg-indigo-600 text-white'
                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    }`}
                  >
                    Input via nominal modal
                  </button>
                </div>

                <form className="space-y-4" onSubmit={handleSubmit}>
                  {error && (
                    <div className="rounded-md bg-red-50 p-4">
                      <p className="text-sm font-medium text-red-800">{error}</p>
                    </div>
                  )}

                  {/* Stock Symbol */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Stock Symbol *</label>
                    <input
                      type="text"
                      value={symbol}
                      onChange={(e) => setSymbol(e.target.value.toUpperCase())}
                      className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm px-3 py-2 focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                      placeholder="e.g., AAPL"
                    />
                  </div>

                  {/* DATA SAHAM */}
                  <div className="pt-4 border-t">
                    <h4 className="text-sm font-bold text-gray-900 mb-4">DATA SAHAM</h4>

                    <div>
                      <label className="block text-sm font-medium text-gray-700">
                        Harga beli / lembar (Rp) *
                      </label>
                      <input
                        type="number"
                        step="1"
                        value={buyPricePerShare || ''}
                        onChange={(e) => setBuyPricePerShare(parseFloat(e.target.value) || 0)}
                        className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm px-3 py-2 focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                        placeholder="mis. 1500"
                        min="0"
                      />
                    </div>

                    {inputMode === 'lot' ? (
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mt-4">
                          Jumlah lot *
                        </label>
                        <input
                          type="number"
                          step="1"
                          value={quantity / 100 || ''}
                          onChange={(e) => setQuantity((parseFloat(e.target.value) || 0) * 100)}
                          className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm px-3 py-2 focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                          placeholder="mis. 10"
                          min="0"
                        />
                        <p className="mt-1 text-xs text-gray-500">1 lot = 100 lembar</p>
                      </div>
                    ) : (
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mt-4">
                          Total modal (Rp) *
                        </label>
                        <input
                          type="number"
                          step="1"
                          value={nominal || ''}
                          onChange={(e) => handleNominalChange(parseFloat(e.target.value) || 0)}
                          className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm px-3 py-2 focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                          placeholder="auto-hitung"
                          min="0"
                        />
                      </div>
                    )}

                    {/* Display calculated quantity/nominal */}
                    <div className="mt-4 p-3 bg-gray-50 rounded-md">
                      <p className="text-xs text-gray-600 mb-1">
                        {inputMode === 'lot' ? 'Total Lembar' : 'Total Modal'}
                      </p>
                      <p className="text-lg font-bold text-gray-900">
                        {inputMode === 'lot'
                          ? `${quantity} lembar`
                          : `Rp ${(quantity * buyPricePerShare).toLocaleString('id-ID')}`}
                      </p>
                    </div>
                  </div>

                  {/* TARGET PERSENTASE */}
                  <div className="pt-4 border-t">
                    <h4 className="text-sm font-bold text-gray-900 mb-4">TARGET PERSENTASE</h4>

                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-sm font-medium text-gray-700">
                          Target untung (%)
                        </label>
                        <div className="relative mt-1">
                          <input
                            type="number"
                            step="0.1"
                            value={targetProfitPercentage || ''}
                            onChange={(e) => setTargetProfitPercentage(parseFloat(e.target.value) || 0)}
                            className="block w-full border border-gray-300 rounded-md shadow-sm px-3 py-2 focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                            placeholder="mis. 10"
                            min="0"
                          />
                          <span className="absolute right-3 top-2 text-gray-500">%</span>
                        </div>
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700">
                          Batas rugi / cut loss (%)
                        </label>
                        <div className="relative mt-1">
                          <input
                            type="number"
                            step="0.1"
                            value={cutLossPercentage || ''}
                            onChange={(e) => setCutLossPercentage(parseFloat(e.target.value) || 0)}
                            className="block w-full border border-gray-300 rounded-md shadow-sm px-3 py-2 focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                            placeholder="mis. 5"
                            min="0"
                          />
                          <span className="absolute right-3 top-2 text-gray-500">%</span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* FEE TRANSAKSI */}
                  <div className="pt-4 border-t">
                    <h4 className="text-sm font-bold text-gray-900 mb-4">FEE TRANSAKSI</h4>

                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-sm font-medium text-gray-700">
                          Fee beli (%)
                        </label>
                        <div className="relative mt-1">
                          <input
                            type="number"
                            step="0.01"
                            value={feeBuyPercentage || ''}
                            onChange={(e) => setFeeBuyPercentage(parseFloat(e.target.value) || 0)}
                            className="block w-full border border-gray-300 rounded-md shadow-sm px-3 py-2 focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                            placeholder="0.19"
                            min="0"
                          />
                          <span className="absolute right-3 top-2 text-gray-500">%</span>
                        </div>
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700">
                          Fee jual (%)
                        </label>
                        <div className="relative mt-1">
                          <input
                            type="number"
                            step="0.01"
                            value={feeSellPercentage || ''}
                            onChange={(e) => setFeeSellPercentage(parseFloat(e.target.value) || 0)}
                            className="block w-full border border-gray-300 rounded-md shadow-sm px-3 py-2 focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                            placeholder="0.29"
                            min="0"
                          />
                          <span className="absolute right-3 top-2 text-gray-500">%</span>
                        </div>
                      </div>
                    </div>
                    <p className="mt-2 text-xs text-gray-500">
                      Default: Sesuai standar sekuritas Indonesia (IDX)
                    </p>
                  </div>

                  {/* Submit Button */}
                  <button
                    type="submit"
                    disabled={loading}
                    className="w-full mt-6 py-2 px-4 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {loading ? 'Calculating...' : 'Calculate'}
                  </button>
                </form>
              </div>
            </div>
          </div>

          {/* Results Section */}
          <div className="lg:col-span-2">
            {result ? (
              <div className="space-y-6">
                {/* RINGKASAN POSISI */}
                <div className="bg-white shadow sm:rounded-lg p-6">
                  <h3 className="text-sm font-bold text-gray-700 tracking-wide mb-6">RINGKASAN POSISI</h3>
                  <div className="grid grid-cols-3 gap-6">
                    <div>
                      <p className="text-xs text-gray-500 mb-1">Modal digunakan</p>
                      <p className="text-2xl font-bold text-gray-900">
                        Rp {result.modal.toLocaleString('id-ID')}
                      </p>
                      <p className="text-xs text-gray-600 mt-1">
                        {result.quantity} lot ({result.quantity} lembar)
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-500 mb-1">Harga beli / lembar</p>
                      <p className="text-2xl font-bold text-gray-900">
                        Rp {result.buyPricePerShare.toLocaleString('id-ID')}
                      </p>
                      <p className="text-xs text-gray-600 mt-1">per lembar saham</p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-500 mb-1">Total keluar (+ fee beli)</p>
                      <p className="text-2xl font-bold text-gray-900">
                        Rp {(result.modal + result.feeBuyAmount).toLocaleString('id-ID')}
                      </p>
                      <p className="text-xs text-gray-600 mt-1">termasuk fee {result.feeBuyPercentage}%</p>
                    </div>
                  </div>
                </div>

                {/* SKENARIO UNTUNG & SKENARIO RUGI - Side by Side */}
                <div className="grid grid-cols-2 gap-4">
                  {/* SKENARIO UNTUNG (Target Profit) */}
                  {result.targetSellPrice !== undefined && (
                    <div className="bg-gradient-to-br from-green-50 to-green-100 border border-green-300 rounded-lg p-6">
                      <h3 className="text-sm font-bold text-green-900 mb-6">SKENARIO UNTUNG</h3>
                      <div className="space-y-4">
                        <div>
                          <p className="text-xs text-green-700 mb-1">Nilai jual bruto</p>
                          <p className="text-xl font-bold text-gray-900">
                            Rp {(result.targetSellPriceGross ?? 0).toLocaleString('id-ID')}
                          </p>
                          <p className="text-xs text-green-700 mt-1">
                            Untung bruto: +Rp {(result.targetProfitBruto ?? 0).toLocaleString('id-ID')}
                          </p>
                        </div>
                        <div className="border-t border-green-300 pt-4">
                          <div className="flex justify-between items-end mb-2">
                            <span className="text-sm text-green-700">Net keuntungan</span>
                            <span className="text-xs text-green-700">(+{result.targetProfitPercentage}%)</span>
                          </div>
                          <p className="text-2xl font-bold text-green-600">
                            Rp {(result.targetProfitNetto ?? 0).toLocaleString('id-ID')}
                          </p>
                          <p className="text-xs text-green-700 mt-2">Setelah semua fee</p>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* SKENARIO RUGI (Cut Loss) */}
                  {result.cutLossSellPrice !== undefined && (
                    <div className="bg-gradient-to-br from-red-50 to-red-100 border border-red-300 rounded-lg p-6">
                      <h3 className="text-sm font-bold text-red-900 mb-6">SKENARIO RUGI</h3>
                      <div className="space-y-4">
                        <div>
                          <p className="text-xs text-red-700 mb-1">Nilai jual (cut loss)</p>
                          <p className="text-xl font-bold text-gray-900">
                            Rp {(result.cutLossSellPriceGross ?? 0).toLocaleString('id-ID')}
                          </p>
                          <p className="text-xs text-red-700 mt-1">
                            Rugi bruto: -Rp {Math.abs(result.cutLossProfitBruto ?? 0).toLocaleString('id-ID')}
                          </p>
                        </div>
                        <div className="border-t border-red-300 pt-4">
                          <div className="flex justify-between items-end mb-2">
                            <span className="text-sm text-red-700">Net kerugian</span>
                            <span className="text-xs text-red-700">(-{result.cutLossPercentage}%)</span>
                          </div>
                          <p className="text-2xl font-bold text-red-600">
                            -Rp {Math.abs(result.cutLossProfitNetto ?? 0).toLocaleString('id-ID')}
                          </p>
                          <p className="text-xs text-red-700 mt-2">Setelah semua fee</p>
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                {/* RINCIAN FEE TRANSAKSI */}
                <div className="bg-white shadow sm:rounded-lg p-6">
                  <h3 className="text-sm font-bold text-gray-700 tracking-wide mb-6">RINCIAN FEE TRANSAKSI</h3>
                  <div className="space-y-4">
                    {/* Fee Beli */}
                    <div className="flex justify-between items-center py-3 border-b border-gray-200">
                      <span className="text-gray-700">Fee beli ({result.feeBuyPercentage}%)</span>
                      <span className="font-bold text-gray-900">Rp {result.feeBuyAmount.toLocaleString('id-ID')}</span>
                    </div>

                    {/* Fee Jual - Skenario Untung */}
                    {result.targetFeeSellAmount !== undefined && (
                      <div className="flex justify-between items-center py-3 border-b border-gray-200">
                        <span className="text-gray-700">Fee jual — skenario untung ({result.feeSellPercentage}%)</span>
                        <span className="font-bold text-gray-900">
                          Rp {result.targetFeeSellAmount.toLocaleString('id-ID')}
                        </span>
                      </div>
                    )}

                    {/* Fee Jual - Skenario Rugi */}
                    {result.cutLossFeeSellAmount !== undefined && (
                      <div className="flex justify-between items-center py-3 border-b border-gray-200">
                        <span className="text-gray-700">Fee jual — skenario rugi ({result.feeSellPercentage}%)</span>
                        <span className="font-bold text-gray-900">
                          Rp {result.cutLossFeeSellAmount.toLocaleString('id-ID')}
                        </span>
                      </div>
                    )}

                    {/* Total Fee - Skenario Untung */}
                    {result.targetFeeSellAmount !== undefined && (
                      <div className="flex justify-between items-center py-3 bg-gray-50 px-3 rounded-lg">
                        <span className="font-bold text-gray-900">Total fee (skenario untung)</span>
                        <span className="font-bold text-gray-900">
                          Rp {(result.feeBuyAmount + result.targetFeeSellAmount).toLocaleString('id-ID')}
                        </span>
                      </div>
                    )}

                    {/* Total Fee - Skenario Rugi */}
                    {result.cutLossFeeSellAmount !== undefined && (
                      <div className="flex justify-between items-center py-3 bg-gray-50 px-3 rounded-lg">
                        <span className="font-bold text-gray-900">Total fee (skenario rugi)</span>
                        <span className="font-bold text-gray-900">
                          Rp {(result.feeBuyAmount + result.cutLossFeeSellAmount).toLocaleString('id-ID')}
                        </span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Simpan Button */}
                <div className="bg-white shadow sm:rounded-lg p-6">
                  {saveError && (
                    <p className="text-sm text-red-600 mb-3">{saveError}</p>
                  )}
                  {saved && (
                    <p className="text-sm text-green-600 mb-3">Simulasi berhasil disimpan ke history.</p>
                  )}
                  <button
                    onClick={handleSave}
                    disabled={saving || saved}
                    className="w-full py-3 px-4 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-green-600 hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {saving ? 'Menyimpan...' : saved ? 'Tersimpan' : 'Simpan Simulasi'}
                  </button>
                </div>
              </div>
            ) : (
              <div className="bg-white shadow sm:rounded-lg p-12">
                <div className="text-center">
                  <p className="text-gray-500 text-lg">📊 Isi form dan klik Calculate untuk melihat hasil</p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
