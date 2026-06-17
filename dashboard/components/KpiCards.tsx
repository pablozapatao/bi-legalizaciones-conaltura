'use client'
import { useEffect, useRef, useState } from 'react'
import type { KpisResponse } from '@/types'
import { MES_NAMES, fmtNum } from '@/types'

// ── Gauge semicircular animado ────────────────────────────────────────────
function Gauge({ pct, meta }: { pct: number; meta: number }) {
  const [displayed, setDisplayed] = useState(0)
  const rafRef = useRef<number>()

  useEffect(() => {
    const target = Math.min(pct, 150)
    const duration = 1200
    const start = performance.now()
    const animate = (now: number) => {
      const t = Math.min((now - start) / duration, 1)
      const ease = 1 - Math.pow(1 - t, 3)
      setDisplayed(Math.round(ease * target))
      if (t < 1) rafRef.current = requestAnimationFrame(animate)
    }
    rafRef.current = requestAnimationFrame(animate)
    return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current) }
  }, [pct])

  // SVG arc geometry
  const R = 70, cx = 90, cy = 88
  const startAngle = -210, sweepTotal = 240
  const clampedPct = Math.min(displayed, 100)
  const sweepFill  = (clampedPct / 100) * sweepTotal
  const toRad = (d: number) => (d * Math.PI) / 180
  const arcPath = (startDeg: number, sweepDeg: number) => {
    const s = toRad(startDeg), e = toRad(startDeg + sweepDeg)
    const x1 = cx + R * Math.cos(s), y1 = cy + R * Math.sin(s)
    const x2 = cx + R * Math.cos(e), y2 = cy + R * Math.sin(e)
    const large = sweepDeg > 180 ? 1 : 0
    return `M ${x1} ${y1} A ${R} ${R} 0 ${large} 1 ${x2} ${y2}`
  }
  const trackPath = arcPath(startAngle, sweepTotal)
  const fillPath  = sweepFill > 0 ? arcPath(startAngle, sweepFill) : null

  const color = displayed >= 90 ? '#166534' : displayed >= 60 ? '#92400E' : '#FF795A'
  const label = displayed >= 90 ? 'En meta' : displayed >= 60 ? 'En riesgo' : 'Crítico'

  return (
    <div className="flex flex-col items-center">
      <svg width="180" height="110" viewBox="0 0 180 110" style={{ overflow: 'visible' }}>
        {/* Track */}
        <path d={trackPath} fill="none" stroke="rgba(18,81,96,0.1)" strokeWidth="10" strokeLinecap="round" />
        {/* Fill */}
        {fillPath && (
          <path d={fillPath} fill="none" stroke={color} strokeWidth="10" strokeLinecap="round" />
        )}
        {/* Número central */}
        <text x={cx} y={cy + 4} textAnchor="middle" fontSize="28" fontWeight="800"
              fontFamily="var(--font-syne, Syne, sans-serif)" fill={color}>
          {displayed}%
        </text>
        {/* Etiqueta */}
        <text x={cx} y={cy + 22} textAnchor="middle" fontSize="10" fontWeight="600"
              fontFamily="var(--font-funnel, sans-serif)" fill={color} opacity="0.8">
          {label}
        </text>
        {/* Meta */}
        {meta > 0 && (
          <text x={cx} y={cy + 38} textAnchor="middle" fontSize="9"
                fontFamily="var(--font-funnel, sans-serif)" fill="rgba(18,81,96,0.45)">
            meta: {fmtNum(meta)}
          </text>
        )}
        {/* Ticks 0% y 100% */}
        <text x={cx - R - 6} y={cy + 18} textAnchor="end" fontSize="8" fill="rgba(18,81,96,0.3)">0</text>
        <text x={cx + R + 6} y={cy + 18} textAnchor="start" fontSize="8" fill="rgba(18,81,96,0.3)">100</text>
      </svg>
    </div>
  )
}

// ── KPI card individual ───────────────────────────────────────────────────
function KpiCard({
  label, value, sub, color, accent,
}: {
  label: string
  value: string | number
  sub?: string
  color?: string
  accent?: string
}) {
  return (
    <div className="card-beige px-5 py-4">
      <p className="text-xs font-semibold uppercase tracking-wide opacity-50 mb-1">{label}</p>
      <p className="kpi-number text-3xl" style={{ color: color || 'var(--primary)' }}>
        {typeof value === 'number' ? fmtNum(value) : value}
      </p>
      {sub && (
        <p className="text-xs mt-1" style={{ color: accent || 'rgba(18,81,96,0.5)' }}>{sub}</p>
      )}
    </div>
  )
}

// ── Componente principal ──────────────────────────────────────────────────
export default function KpiCards({
  data,
  onEditMeta,
}: {
  data: KpisResponse
  onEditMeta: () => void
}) {
  const aprobadas = data.aprobadas_exitoso + data.aprobadas_novedades
  const mesLabel  = `${MES_NAMES[data.mes]} ${data.anio}`

  return (
    <section>
      {/* Header de sección */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-widest opacity-40">
            Resolución del mes
          </p>
          <h2 className="font-display text-xl font-bold" style={{ color: 'var(--primary)' }}>
            {mesLabel}
          </h2>
        </div>
        {data.ultima_actualizacion && (
          <span className="text-xs opacity-40">
            Actualizado {new Date(data.ultima_actualizacion).toLocaleString('es-CO', {
              month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
            })}
          </span>
        )}
      </div>

      {/* Hero: gauge de cumplimiento + KPIs de resolución */}
      <div className="grid grid-cols-1 lg:grid-cols-[220px_1fr] gap-4 mb-4">

        {/* Gauge */}
        <div className="card p-5 flex flex-col items-center justify-center">
          <p className="text-xs font-semibold uppercase tracking-wide opacity-40 mb-2 text-center">
            Cumplimiento vs meta
          </p>
          <Gauge pct={data.pct_cumplimiento} meta={data.meta_negocios} />
          {data.meta_negocios === 0 && (
            <button
              onClick={onEditMeta}
              className="mt-2 text-xs font-semibold px-3 py-1.5 rounded-full transition-colors"
              style={{ background: 'var(--accent-lt)', color: 'var(--primary)' }}
            >
              + Fijar meta del mes
            </button>
          )}
          {data.meta_negocios > 0 && (
            <button
              onClick={onEditMeta}
              className="mt-2 text-xs opacity-40 hover:opacity-70 transition-opacity"
            >
              Editar meta →
            </button>
          )}
        </div>

        {/* Grid de KPIs */}
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          <KpiCard
            label="Legalizaciones del mes"
            value={data.total_resolucion}
            sub={`${aprobadas} aprobadas · ${data.rechazadas} rechazadas`}
          />
          <KpiCard
            label="Aprobadas sin novedades"
            value={data.aprobadas_exitoso}
            color="var(--success)"
            sub={aprobadas > 0 ? `${((data.aprobadas_exitoso / aprobadas) * 100).toFixed(0)}% del total aprobado` : undefined}
          />
          <KpiCard
            label="Aprobadas con novedades"
            value={data.aprobadas_novedades}
            color="var(--warning)"
            sub={aprobadas > 0 ? `${((data.aprobadas_novedades / aprobadas) * 100).toFixed(0)}% del total aprobado` : undefined}
          />
          <KpiCard
            label="Rechazadas"
            value={data.rechazadas}
            color={data.rechazadas > 0 ? 'var(--coral)' : 'var(--primary)'}
          />
          <KpiCard
            label="Ventas caídas"
            value={data.ventas_caidas}
            color={data.ventas_caidas > 0 ? '#991B1B' : 'var(--primary)'}
          />
          <KpiCard
            label="En ventana de cierre"
            value={`${data.pct_ventana_cierre}%`}
            sub={`${data.en_ventana_cierre} aprobadas en los últimos 3 + primeros 4 días`}
            color={data.pct_ventana_cierre > 40 ? 'var(--warning)' : 'var(--primary)'}
          />
        </div>
      </div>
    </section>
  )
}
