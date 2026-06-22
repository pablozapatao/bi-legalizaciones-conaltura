import type { Metadata } from 'next'
import { Toaster } from 'react-hot-toast'
import './globals.css'

export const metadata: Metadata = {
  title: 'BI Legalizaciones — Conaltura',
  description: 'Dashboard analítico de legalizaciones de venta',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es">
      <body>
        {children}
        <Toaster position="bottom-right" toastOptions={{
          style: {
            background: '#125160', color: '#F4F0E5',
            fontFamily: "'Funnel Sans', Arial, sans-serif",
            fontSize: '13px', borderRadius: '10px',
            border: '1px solid rgba(219,255,105,0.3)',
          },
        }}/>
      </body>
    </html>
  )
}
