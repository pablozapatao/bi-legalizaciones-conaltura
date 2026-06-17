import type { Metadata } from 'next'
import { Syne } from 'next/font/google'
import { Toaster } from 'react-hot-toast'
import './globals.css'

const syne = Syne({
  subsets: ['latin'],
  variable: '--font-syne',
  weight: ['400', '600', '700', '800'],
  display: 'swap',
})

export const metadata: Metadata = {
  title: 'BI Legalizaciones — Conaltura',
  description: 'Dashboard analítico de legalizaciones de venta',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es" className={syne.variable}>
      <head>
        <link
          href="https://fonts.googleapis.com/css2?family=Funnel+Sans:wght@300;400;500;600;700&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="bg-beige text-primary antialiased">
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
