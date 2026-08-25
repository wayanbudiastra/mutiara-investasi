export const dynamic = 'force-dynamic'
import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { revalidateTag } from 'next/cache'
import { CACHE_TAGS } from '@/lib/cache/dividen'

/**
 * Paksa refresh cache /api/dividends untuk user ini.
 * Dibutuhkan karena cache dividen HANYA ter-invalidasi otomatis lewat mutasi via API
 * (POST/PUT/DELETE /api/dividends). Import massal via scripts/import-dividends.mjs
 * INSERT langsung ke DB tanpa lewat API, jadi cache jadi stale sampai endpoint ini dipanggil.
 */
export async function POST() {
  try {
    const session = await getServerSession(authOptions)
    const userId = (session?.user as any)?.id
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    // @ts-ignore
    revalidateTag(CACHE_TAGS.dividenList(userId))

    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error('POST dividends/revalidate error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
