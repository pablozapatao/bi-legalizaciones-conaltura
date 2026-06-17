import type { Metadata } from 'next'
import { Syne, Inter } from 'next/font/google'
import { Toaster } from 'react-hot-toast'
import './globals.css'

const syne = Syne({
  subsets: ['latin'],
  variable: '--font-syne',
  weight: ['400', '600', '700', '800'],
  display: 'swap',
})

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
  weight: ['400', '500', '600', '700'],
  display: 'swap',
})

export const metadata: Metadata = {
  title: 'BI Legalizaciones — Conaltura',
  description: 'Dashboard analítico de legalizaciones de venta',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es" className={`${syne.variable} ${inter.variable}`}>
      <body style={{ margin: 0, padding: 0 }}>
        {children}
        <Toaster
          position="bottom-right"
          toastOptions={{
            style: {
              background: '#125160',
              color: '#F4F0E5',
              fontSize: '0.875rem',
              borderRadius: '8px',
            },
          }}
        />
      </body>
    </html>
  )
}
