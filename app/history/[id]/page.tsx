import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { prisma } from '@/lib/prisma'
import { calculateAdvancedStockProfit } from '@/lib/calculations'

export default async function HistoryDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const session = await getServerSession(authOptions)
  if (!session) redirect('/login')

  const { id } = await params
  const userId = (session.user as any)?.id

  const rows = await prisma.$queryRawUnsafe(
    `SELECT * FROM "calculations" WHERE "id" = $1 AND "userId" = $2`,
    id,
    userId
  ) as any[]

  if (!rows.length) redirect('/history')

  const c = rows[0]

  const result = calculateAdvancedStockProfit({
    stockSymbol: String(c.stockSymbol),
    quantity: Number(c.quantity),
    buyPricePerShare: Number(c.buyPricePerShare),
    sellPricePerShare: c.sellPricePerShare ? Number(c.sellPricePerShare) : undefined,
    feeBuyPercentage: Number(c.feeBuyPercentage),
    feeSellPercentage: Number(c.feeSellPercentage),
    targetProfitPercentage: c.targetProfitPercentage ? Number(c.targetProfitPercentage) : undefined,
    cutLossPercentage: c.cutLossPercentage ? Number(c.cutLossPercentage) : undefined,
  })

  const savedDate = new Date(String(c.createdAt)).toLocaleDateString('id-ID', {
    day: '2-digit', month: 'long', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  })

  const rp = (v: number) => `Rp ${v.toLocaleString('id-ID')}`

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">

        {/* Header */}
        <div className="mb-6 flex items-center gap-4">
          <Link
            href="/history"
            className="text-sm text-gray-500 hover:text-gray-700 flex items-center gap-1"
          >
            ← Kembali ke Riwayat
          </Link>
        </div>

        <div className="mb-8 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-3xl font-bold text-gray-900">Detail Simulasi</h1>
              <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-bold bg-indigo-100 text-indigo-800">
                {c.stockSymbol}
              </span>
            </div>
            <p className="mt-1 text-sm text-gray-500">Disimpan pada {savedDate}</p>
          </div>
        </div>

        <div className="space-y-6">
          {/* RINGKASAN POSISI */}
          <div className="bg-white shadow sm:rounded-lg p-6">
            <h3 className="text-sm font-bold text-gray-700 tracking-wide mb-6">RINGKASAN POSISI</h3>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-6">
              <div>
                <p className="text-xs text-gray-500 mb-1">Modal digunakan</p>
                <p className="text-2xl font-bold text-gray-900">{rp(result.modal)}</p>
                <p className="text-xs text-gray-600 mt-1">
                  {(result.quantity / 100).toLocaleString('id-ID')} lot ({result.quantity.toLocaleString('id-ID')} lembar)
                </p>
              </div>
              <div>
                <p className="text-xs text-gray-500 mb-1">Harga beli / lembar</p>
                <p className="text-2xl font-bold text-gray-900">{rp(result.buyPricePerShare)}</p>
                <p className="text-xs text-gray-600 mt-1">per lembar saham</p>
              </div>
              <div>
                <p className="text-xs text-gray-500 mb-1">Total keluar (+ fee beli)</p>
                <p className="text-2xl font-bold text-gray-900">
                  {rp(result.modal + result.feeBuyAmount)}
                </p>
                <p className="text-xs text-gray-600 mt-1">termasuk fee {result.feeBuyPercentage}%</p>
              </div>
            </div>
          </div>

          {/* SKENARIO UNTUNG & RUGI */}
          {(result.targetSellPrice !== undefined || result.cutLossSellPrice !== undefined) && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {result.targetSellPrice !== undefined && (
                <div className="bg-gradient-to-br from-green-50 to-green-100 border border-green-300 rounded-lg p-6">
                  <h3 className="text-sm font-bold text-green-900 mb-6">SKENARIO UNTUNG</h3>
                  <div className="space-y-4">
                    <div>
                      <p className="text-xs text-green-700 mb-1">Nilai jual bruto</p>
                      <p className="text-xl font-bold text-gray-900">
                        {rp(result.targetSellPriceGross ?? 0)}
                      </p>
                      <p className="text-xs text-green-700 mt-1">
                        Untung bruto: +{rp(result.targetProfitBruto ?? 0)}
                      </p>
                    </div>
                    <div className="border-t border-green-300 pt-4">
                      <div className="flex justify-between items-end mb-2">
                        <span className="text-sm text-green-700">Net keuntungan</span>
                        <span className="text-xs text-green-700">(+{result.targetProfitPercentage}%)</span>
                      </div>
                      <p className="text-2xl font-bold text-green-600">
                        {rp(result.targetProfitNetto ?? 0)}
                      </p>
                      <p className="text-xs text-green-700 mt-2">
                        Harga jual target: {rp(result.targetSellPrice)} / lembar
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {result.cutLossSellPrice !== undefined && (
                <div className="bg-gradient-to-br from-red-50 to-red-100 border border-red-300 rounded-lg p-6">
                  <h3 className="text-sm font-bold text-red-900 mb-6">SKENARIO RUGI</h3>
                  <div className="space-y-4">
                    <div>
                      <p className="text-xs text-red-700 mb-1">Nilai jual (cut loss)</p>
                      <p className="text-xl font-bold text-gray-900">
                        {rp(result.cutLossSellPriceGross ?? 0)}
                      </p>
                      <p className="text-xs text-red-700 mt-1">
                        Rugi bruto: -{rp(Math.abs(result.cutLossProfitBruto ?? 0))}
                      </p>
                    </div>
                    <div className="border-t border-red-300 pt-4">
                      <div className="flex justify-between items-end mb-2">
                        <span className="text-sm text-red-700">Net kerugian</span>
                        <span className="text-xs text-red-700">(-{result.cutLossPercentage}%)</span>
                      </div>
                      <p className="text-2xl font-bold text-red-600">
                        -{rp(Math.abs(result.cutLossProfitNetto ?? 0))}
                      </p>
                      <p className="text-xs text-red-700 mt-2">
                        Harga jual cut loss: {rp(result.cutLossSellPrice)} / lembar
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Skenario Harga Jual (jika ada sellPricePerShare) */}
          {result.sellPricePerShare !== undefined && (
            <div className={`border rounded-lg p-6 ${(result.profitNetto ?? 0) >= 0 ? 'bg-gradient-to-br from-green-50 to-green-100 border-green-300' : 'bg-gradient-to-br from-red-50 to-red-100 border-red-300'}`}>
              <h3 className={`text-sm font-bold mb-6 ${(result.profitNetto ?? 0) >= 0 ? 'text-green-900' : 'text-red-900'}`}>
                REALISASI HARGA JUAL
              </h3>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                <div>
                  <p className="text-xs text-gray-600 mb-1">Harga jual / lembar</p>
                  <p className="text-xl font-bold text-gray-900">{rp(result.sellPricePerShare)}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-600 mb-1">Nilai jual bruto</p>
                  <p className="text-xl font-bold text-gray-900">{rp(result.sellPriceGross ?? 0)}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-600 mb-1">Profit / Rugi Netto</p>
                  <p className={`text-2xl font-bold ${(result.profitNetto ?? 0) >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                    {(result.profitNetto ?? 0) >= 0 ? '+' : ''}{rp(result.profitNetto ?? 0)}
                  </p>
                  <p className="text-xs text-gray-600 mt-1">
                    Return: {(result.returnPercentage ?? 0).toFixed(2)}%
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* RINCIAN FEE TRANSAKSI */}
          <div className="bg-white shadow sm:rounded-lg p-6">
            <h3 className="text-sm font-bold text-gray-700 tracking-wide mb-6">RINCIAN FEE TRANSAKSI</h3>
            <div className="space-y-0">
              <div className="flex justify-between items-center py-3 border-b border-gray-200">
                <span className="text-gray-700">Fee beli ({result.feeBuyPercentage}%)</span>
                <span className="font-bold text-gray-900">{rp(result.feeBuyAmount)}</span>
              </div>

              {result.targetFeeSellAmount !== undefined && (
                <div className="flex justify-between items-center py-3 border-b border-gray-200">
                  <span className="text-gray-700">Fee jual — skenario untung ({result.feeSellPercentage}%)</span>
                  <span className="font-bold text-gray-900">{rp(result.targetFeeSellAmount)}</span>
                </div>
              )}

              {result.cutLossFeeSellAmount !== undefined && (
                <div className="flex justify-between items-center py-3 border-b border-gray-200">
                  <span className="text-gray-700">Fee jual — skenario rugi ({result.feeSellPercentage}%)</span>
                  <span className="font-bold text-gray-900">{rp(result.cutLossFeeSellAmount)}</span>
                </div>
              )}

              {result.feeSellAmount !== undefined && (
                <div className="flex justify-between items-center py-3 border-b border-gray-200">
                  <span className="text-gray-700">Fee jual realisasi ({result.feeSellPercentage}%)</span>
                  <span className="font-bold text-gray-900">{rp(result.feeSellAmount)}</span>
                </div>
              )}

              {result.targetFeeSellAmount !== undefined && (
                <div className="flex justify-between items-center py-3 bg-gray-50 px-3 rounded-lg mt-2">
                  <span className="font-bold text-gray-900">Total fee (skenario untung)</span>
                  <span className="font-bold text-gray-900">
                    {rp(result.feeBuyAmount + result.targetFeeSellAmount)}
                  </span>
                </div>
              )}

              {result.cutLossFeeSellAmount !== undefined && (
                <div className="flex justify-between items-center py-3 bg-gray-50 px-3 rounded-lg mt-2">
                  <span className="font-bold text-gray-900">Total fee (skenario rugi)</span>
                  <span className="font-bold text-gray-900">
                    {rp(result.feeBuyAmount + result.cutLossFeeSellAmount)}
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* Parameter Input */}
          <div className="bg-white shadow sm:rounded-lg p-6">
            <h3 className="text-sm font-bold text-gray-700 tracking-wide mb-4">PARAMETER SIMULASI</h3>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <div className="bg-gray-50 rounded-md p-3">
                <p className="text-xs text-gray-500">Fee Beli</p>
                <p className="text-sm font-semibold text-gray-900">{Number(c.feeBuyPercentage)}%</p>
              </div>
              <div className="bg-gray-50 rounded-md p-3">
                <p className="text-xs text-gray-500">Fee Jual</p>
                <p className="text-sm font-semibold text-gray-900">{Number(c.feeSellPercentage)}%</p>
              </div>
              <div className="bg-gray-50 rounded-md p-3">
                <p className="text-xs text-gray-500">Target Untung</p>
                <p className="text-sm font-semibold text-gray-900">
                  {c.targetProfitPercentage ? `${Number(c.targetProfitPercentage)}%` : '-'}
                </p>
              </div>
              <div className="bg-gray-50 rounded-md p-3">
                <p className="text-xs text-gray-500">Cut Loss</p>
                <p className="text-sm font-semibold text-gray-900">
                  {c.cutLossPercentage ? `${Number(c.cutLossPercentage)}%` : '-'}
                </p>
              </div>
            </div>
          </div>

          <div className="flex justify-between pt-2">
            <Link
              href="/history"
              className="inline-flex items-center px-4 py-2 border border-gray-300 shadow-sm text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50"
            >
              ← Kembali ke Riwayat
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}
