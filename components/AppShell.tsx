'use client'

import { usePathname } from 'next/navigation'
import { Sidebar } from './Sidebar'

const AUTH_PATHS = ['/login', '/register', '/forgot-password', '/reset-password']
const PUBLIC_PATHS = ['/'] // landing page — no sidebar

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const isAuthPage   = AUTH_PATHS.includes(pathname)
  const isPublicPage = PUBLIC_PATHS.includes(pathname)

  if (isAuthPage || isPublicPage) return <>{children}</>

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="print:hidden">
        <Sidebar />
      </div>
      <div className="lg:pl-64 pt-14 lg:pt-0 print:pl-0 print:pt-0">
        {children}
      </div>
    </div>
  )
}
