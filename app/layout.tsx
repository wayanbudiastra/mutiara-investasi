import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import { Providers } from '@/components/Providers'
import { AppShell } from '@/components/AppShell'
import './globals.css'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'Mutiara Investasi',
  description: 'Platform rekap investasi saham — portofolio, dividen, dan simulasi',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body className={inter.className}>
        <Providers>
          <AppShell>
            {children}
          </AppShell>
        </Providers>
      </body>
    </html>
  )
}