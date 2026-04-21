'use client'

import { usePathname } from 'next/navigation'
import { Sidebar } from './Sidebar'

const AUTH_PATHS = ['/login', '/register']

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const isAuthPage = AUTH_PATHS.includes(pathname)

  if (isAuthPage) return <>{children}</>

  return (
    <div className="min-h-screen bg-gray-50">
      <Sidebar />
      <div className="lg:pl-64 pt-14 lg:pt-0">
        {children}
      </div>
    </div>
  )
}
