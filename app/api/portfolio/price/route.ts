import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'

// Singleton instance — hindari re-instantiate per request
let _yf: { quote: (symbol: string) => Promise<{ regularMarketPrice?: number }> } | null = null

function getYF() {
  if (!_yf) {
    // yahoo-finance2 v3: default export adalah class, harus di-instantiate
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const YFClass = require('yahoo-finance2').default
    _yf = new YFClass({ suppressNotices: ['yahooSurvey'] })
  }
  return _yf!
}

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

    const yf = getYF()
    const prices: Record<string, number | null> = {}

    await Promise.all(
      symbols.map(async (sym) => {
        try {
          const quote = await yf.quote(`${sym}.JK`)
          prices[sym] = typeof quote?.regularMarketPrice === 'number'
            ? quote.regularMarketPrice
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
