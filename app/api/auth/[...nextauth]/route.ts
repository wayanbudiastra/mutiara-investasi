import NextAuth from 'next-auth'
import { authOptions } from '@/lib/auth'

// Paksa selalu dynamic — hindari static generation saat build (butuh DATABASE_URL runtime)
export const dynamic = 'force-dynamic'

const handler = NextAuth(authOptions)

export { handler as GET, handler as POST }