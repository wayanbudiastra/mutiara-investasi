export const dynamic = 'force-dynamic'
import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { checkProAccess } from '@/lib/subscription'

export async function GET() {
  try {
    const session = await getServerSession(authOptions)
    const userId = (session?.user as any)?.id
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const result = await checkProAccess(userId)
    return NextResponse.json(result)
  } catch (error) {
    console.error('subscription/status error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
