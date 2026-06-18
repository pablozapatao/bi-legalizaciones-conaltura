import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import { Toaster } from 'react-hot-toast'
import './globals.css'

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
  weight: ['400','500','600','700'],
  display: 'swap',
})

export const metadata: Metadata = {
  title: 'BI Legalizaciones — Conaltura',
  description: 'Dashboard analítico de legalizaciones',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es" className={`dark ${inter.variable}`}>
      <body>
        {children}
        <Toaster position="bottom-right" toastOptions={{
          style: { background: '#0B1120', color: '#e2e8f0', border: '1px solid rgba(161,216,26,0.3)', fontSize: '13px' },
        }}/>
      </body>
    </html>
  )
}
