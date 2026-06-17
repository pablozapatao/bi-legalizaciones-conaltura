// Fase 5 — Shell del dashboard. Se expande en Fase 6.
// Esta página confirma que Next.js + Neon está conectado correctamente.
import { Suspense } from 'react'

async function StatusCheck() {
  // Verificación server-side de que la BD responde
  let dbOk  = false
  let total = 0
  try {
    const { neon } = await import('@neondatabase/serverless')
    const sql = neon(process.env.DATABASE_URL!)
    const rows = await sql(`SELECT COUNT(*) AS n FROM raw_legalizaciones`)
    total = Number(rows[0].n)
    dbOk  = true
  } catch {
    dbOk = false
  }

  return (
    <div className="card p-6 max-w-lg mx-auto mt-16">
      <div className="flex items-center gap-3 mb-4">
        <div className="w-3 h-3 rounded-full" style={{ background: dbOk ? '#A1D81A' : '#FF795A' }} />
        <span className="font-semibold text-sm">
          {dbOk ? 'Base de datos conectada ✓' : 'Error de conexión a Neon'}
        </span>
      </div>
      {dbOk && (
        <p className="text-sm opacity-70">
          {total.toLocaleString('es-CO')} legalizaciones en Neon
        </p>
      )}
      <p className="text-xs mt-4 opacity-50">
        El dashboard completo se construye en Fase 6.
      </p>
    </div>
  )
}

export default function DashboardPage() {
  return (
    <main className="min-h-screen p-8">
      <div className="max-w-7xl mx-auto">

        {/* Header */}
        <div className="flex items-center gap-4 mb-10">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center"
               style={{ background: 'var(--primary)' }}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
              <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"
                    stroke="#A1D81A" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </div>
          <div>
            <h1 className="font-display text-2xl font-bold" style={{ color: 'var(--primary)' }}>
              BI Legalizaciones
            </h1>
            <p className="text-xs opacity-50 mt-0.5">Conaltura · Fase 5 — Capa de datos activa</p>
          </div>
        </div>

        {/* Status */}
        <Suspense fallback={
          <div className="shimmer h-32 max-w-lg mx-auto mt-16 rounded-xl" />
        }>
          <StatusCheck />
        </Suspense>

        {/* Endpoints disponibles */}
        <div className="mt-12 card p-6 max-w-2xl">
          <h2 className="font-semibold text-sm mb-4 opacity-70 uppercase tracking-wide">
            Endpoints disponibles — prueba en tu URL de Vercel
          </h2>
          <div className="space-y-2">
            {[
              ['/api/kpis',       'KPIs 1-7 del mes actual'],
              ['/api/pipeline',   'Pipeline activo + caídas del mes'],
              ['/api/proyectos',  'Desglose por proyecto'],
              ['/api/tendencia',  'Tendencia mensual (14 meses)'],
              ['/api/tiempos',    'Lead time y tiempos por stage'],
              ['/api/timeline?id=XXXX', 'Timeline de una legalización'],
              ['/api/canales',    'Análisis por canal'],
              ['/api/mapa',       'Datos geográficos por ciudad'],
              ['/api/detalle',    'Tabla drill-down paginada'],
              ['/api/metas',      'Meta mensual de compañía'],
            ].map(([path, desc]) => (
              <div key={path} className="flex items-start gap-3 py-2 border-b last:border-0"
                   style={{ borderColor: 'rgba(18,81,96,0.06)' }}>
                <code className="text-xs font-mono px-2 py-0.5 rounded shrink-0"
                      style={{ background: 'var(--beige-dk)', color: 'var(--primary)' }}>
                  {path}
                </code>
                <span className="text-xs opacity-60">{desc}</span>
              </div>
            ))}
          </div>
        </div>

      </div>
    </main>
  )
}
