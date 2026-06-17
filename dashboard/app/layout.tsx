import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'BI Legalizaciones — Conaltura',
  description: 'Dashboard analítico de legalizaciones de venta',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es">
      <body>{children}</body>
    </html>
  )
}
