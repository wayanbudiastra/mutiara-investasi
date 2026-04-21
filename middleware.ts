import { withAuth } from 'next-auth/middleware'

export default withAuth(
  function middleware(req) {
    // Add custom middleware logic here if needed
  },
  {
    callbacks: {
      authorized: ({ token }) => !!token,
    },
  }
)

export const config = {
  matcher: ['/', '/history', '/profile', '/api/calculations', '/api/profile', '/api/watchlist'],
}