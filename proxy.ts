import { withAuth } from 'next-auth/middleware'

export default withAuth(
  function middleware(_req) {
    // Add custom middleware logic here if needed
  },
  {
    callbacks: {
      authorized: ({ token }) => !!token,
    },
  }
)

export const config = {
  matcher: ['/simulasi', '/history', '/profile', '/portfolio', '/dividends', '/securities', '/pricing', '/subscription', '/admin', '/api/calculations', '/api/profile', '/api/watchlist', '/api/portfolio', '/api/subscription'],
  // Halaman publik (forgot/reset password) tidak perlu autentikasi — sengaja tidak dimasukkan matcher
}