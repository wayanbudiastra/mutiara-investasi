export const dynamic = 'force-dynamic'
import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { checkProAccess } from '@/lib/subscription'
import { getCachedInvestorFlow, getLatestInvestorFlowDate } from '@/lib/cache/investorFlow'
import { getLatestBrokerDate } from '@/lib/cache/brokersTop'

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    const userId = (session?.user as any)?.id
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const pro = await checkProAccess(userId)
    if (!pro.hasAccess) return NextResponse.json({ error: 'Pro access required' }, { status: 403 })

    const { searchParams } = new URL(request.url)
    const requestedDate = searchParams.get('date') ?? await getLatestBrokerDate()
    if (!requestedDate) return NextResponse.json({ date: null, requestedDate: null, foreign: null, domestic: null })

    let result = await getCachedInvestorFlow(requestedDate)

    // investor_flows disinkron per bulan — kalau tanggal yang dipilih (dari data harian
    // broker/saham) belum punya baris di sini, fallback ke tanggal terakhir yang tersedia.
    if (!result.foreign && !result.domestic) {
      const fallbackDate = await getLatestInvestorFlowDate()
      if (fallbackDate && fallbackDate !== requestedDate) {
        result = await getCachedInvestorFlow(fallbackDate)
      }
    }

    return NextResponse.json({ ...result, requestedDate })
  } catch (error) {
    console.error('GET investor-flow error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
