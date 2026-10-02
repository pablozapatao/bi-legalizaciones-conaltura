'use client'
import type { ReactNode } from 'react'
import type { KpisResponse } from '@/types'
import { T, AM, OR, PU, YE, fN, pct } from './brand'
import Gauge from './Gauge'

// border-left 3px es el ÚNICO indicador de estado; el número siempre #125160.
export function KpiCard({ label, value, border = T, sub, tip, prog, onClick }: {
  label: string; value: ReactNode; border?: string; sub?: string; tip?: string; prog?: number; onClick?: () => void
}) {
  return (
    <div className={`kpi-card${onClick ? ' clickable' : ''}`} style={{ borderLeftColor: border }} onClick={onClick}>
      <div>
        <p className="kpi-label">
          {label}
          {tip && <span className="tip" data-tip={tip} style={{ color: 'rgba(18,81,96,.3)', fontSize: 11, lineHeight: 1 }}>?</span>}
        </p>
        <p className="kpi-value">{typeof value === 'number' ? value.toLocaleString('es-CO') : value}</p>
      </div>
      <div>
        {prog != null && (
          <div className="progress-track" style={{ marginTop: 7 }}>
            <div className="progress-fill" style={{ width: `${Math.min(prog, 100)}%`, background: border }} />
          </div>
        )}
        {sub && <p className="kpi-sub">{sub}</p>}
      </div>
    </div>
  )
}

export default function KpiGrid({ kpis, onEditMeta, onVentana }: { kpis: KpisResponse; onEditMeta: () => void; onVentana: () => void }) {
  const ger = kpis.aprobadas_gerencia || 0
  const apr = kpis.aprobadas_exitoso + kpis.aprobadas_novedades + ger
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <div className="kpi-grid" style={{ alignItems: 'stretch' }}>
        <div className="card" style={{ padding: '16px 12px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
          <p className="eyebrow" style={{ textAlign: 'center', marginBottom: 6 }}>Cumplimiento</p>
          <Gauge pct={kpis.pct_cumplimiento} meta={kpis.meta_negocios} onEdit={onEditMeta} />
        </div>
        <KpiCard label="Total del mes" value={kpis.total_resolucion} border={T}
          sub={`${apr} aprobadas · ${kpis.rechazadas} rechazadas`}
          prog={kpis.meta_negocios > 0 ? pct(kpis.total_resolucion, kpis.meta_negocios) : undefined} />
        <KpiCard label="Sin novedad" value={kpis.aprobadas_exitoso} border={AM}
          sub={apr > 0 ? `${pct(kpis.aprobadas_exitoso, apr)}% de aprobadas` : undefined}
          prog={apr > 0 ? pct(kpis.aprobadas_exitoso, apr) : undefined} />
        <KpiCard label="Con novedad" value={kpis.aprobadas_novedades} border={YE}
          sub={apr > 0 ? `${pct(kpis.aprobadas_novedades, apr)}% de aprobadas` : undefined}
          prog={apr > 0 ? pct(kpis.aprobadas_novedades, apr) : undefined} />
        <KpiCard label="Gerencia" value={ger} border={PU}
          tip="Aprobados por Gerencia Comercial — Con Novedades."
          sub={apr > 0 ? `${pct(ger, apr)}% de aprobadas` : undefined}
          prog={apr > 0 ? pct(ger, apr) : undefined} />
      </div>
      <div className="kpi-grid">
        <div />
        <KpiCard label="Rechazados" value={kpis.rechazadas} border={kpis.rechazadas > 0 ? OR : T} />
        <KpiCard label="Caídas" value={kpis.ventas_caidas} border={kpis.ventas_caidas > 0 ? OR : T} />
        <KpiCard label="Ventana de cierre ↗" value={`${fN(kpis.pct_ventana_cierre, 1)}%`}
          border={kpis.pct_ventana_cierre > 40 ? YE : AM}
          sub={`${kpis.en_ventana_cierre} clientes · clic para desglose`}
          tip="% de aprobaciones en los últimos días del mes (día 25+). Clic para ver proyectos y clientes."
          prog={kpis.pct_ventana_cierre} onClick={onVentana} />
        <div />
      </div>
    </div>
  )
}
