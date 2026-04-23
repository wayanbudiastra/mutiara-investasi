import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!(session?.user as any)?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const symbols = (searchParams.get('symbols') ?? '')
      .split(',').map(s => s.trim().toUpperCase()).filter(Boolean)

    if (symbols.length === 0) return NextResponse.json({})

    // Dynamic import avoids build-time type resolution issues with yahoo-finance2
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const yf = require('yahoo-finance2').default ?? require('yahoo-finance2')

    const prices: Record<string, number | null> = {}

    await Promise.all(
      symbols.map(async (sym) => {
        try {
          const result = await yf.quote(`${sym}.JK`)
          prices[sym] = typeof result?.regularMarketPrice === 'number'
            ? result.regularMarketPrice
            : null
        } catch {
          prices[sym] = null
        }
      })
    )

    return NextResponse.json(prices)
  } catch (error) {
    console.error('GET portfolio/price error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
