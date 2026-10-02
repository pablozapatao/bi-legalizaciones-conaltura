'use client'
import type { KpisResponse } from '@/types'
import { T, AM, YE, PU, F, fN, pct } from './brand'

const TOTAL_DEG = 270
const START_DEG = -225

function polar(deg: number, r: number, cx: number, cy: number) {
  const rad = deg * Math.PI / 180
  return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) }
}
function arcPath(start: number, sweep: number, r: number, cx: number, cy: number) {
  if (sweep <= 0) return ''
  const s = polar(start, r, cx, cy), e = polar(start + sweep, r, cx, cy)
  return `M${s.x.toFixed(2)} ${s.y.toFixed(2)} A${r} ${r} 0 ${sweep > 180 ? 1 : 0} 1 ${e.x.toFixed(2)} ${e.y.toFixed(2)}`
}

export default function SemaforoDistribucion({ kpis }: { kpis: KpisResponse }) {
  const ger = kpis.aprobadas_gerencia || 0
  const apr = kpis.aprobadas_exitoso + kpis.aprobadas_novedades + ger
  if (apr === 0) return null
  const segs = [
    { label: 'Aprobado sin novedades', sub: 'Todo correcto', v: kpis.aprobadas_exitoso, col: AM },
    { label: 'Aprobado con novedades', sub: 'Requiere seguimiento', v: kpis.aprobadas_novedades, col: YE },
    { label: 'Aprobado — Gerencia Comercial', sub: 'Decisión de gerencia', v: ger, col: PU },
  ]
  let cur = START_DEG
  const arcs = segs.map(s => {
    const sweep = s.v / apr * TOTAL_DEG
    const path = arcPath(cur, Math.max(sweep - (s.v < apr ? 2 : 0), 0), 52, 70, 70)
    cur += sweep
    return { ...s, path, pct: pct(s.v, apr) }
  })
  const stats = [
    { l: 'Tasa de aprobación', v: kpis.total_resolucion > 0 ? `${pct(apr, kpis.total_resolucion)}%` : '—', sub: 'aprobadas / total resolución', col: T },
    { l: 'Sin novedad', v: `${pct(kpis.aprobadas_exitoso, apr)}%`, sub: 'aprobaciones limpias', col: AM },
    { l: 'Con novedad', v: `${pct(kpis.aprobadas_novedades + ger, apr)}%`, sub: 'requieren gestión', col: YE },
  ]
  return (
    <div className="card" style={{ padding: '20px 24px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 32, flexWrap: 'wrap' }}>
        <svg width="140" height="140" viewBox="0 0 140 140" style={{ overflow: 'visible', flexShrink: 0 }}>
          <path d={arcPath(START_DEG, TOTAL_DEG, 52, 70, 70)} fill="none" stroke="rgba(18,81,96,.07)" strokeWidth="14" strokeLinecap="round" />
          {arcs.filter(a => a.path).map((a, i) => (
            <path key={i} d={a.path} fill="none" stroke={a.col} strokeWidth="14" strokeLinecap="round" />
          ))}
          <text x="70" y="68" textAnchor="middle" fontSize="24" fontWeight="900" fontFamily={F} fill={T}>{apr}</text>
          <text x="70" y="82" textAnchor="middle" fontSize="9" fontWeight="600" fontFamily={F} fill="rgba(18,81,96,.45)">APROBADAS</text>
        </svg>

        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 8, minWidth: 280 }}>
          {arcs.map((a, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '9px 14px', borderRadius: 10, background: `${a.col}1a`, border: `1px solid ${a.col}44` }}>
              <span style={{ width: 12, height: 12, borderRadius: '50%', background: a.col, flexShrink: 0 }} />
              <div style={{ flex: 1 }}>
                <p style={{ fontSize: 12, fontWeight: 700, color: T, lineHeight: 1.3 }}>{a.label}</p>
                <p style={{ fontSize: 10, color: 'rgba(18,81,96,.5)' }}>{a.sub}</p>
              </div>
              <div style={{ width: 80, flexShrink: 0 }}>
                <div className="progress-track lg" style={{ marginBottom: 3 }}>
                  <div className="progress-fill" style={{ width: `${a.pct}%`, background: a.col }} />
                </div>
                <p style={{ fontSize: 10, color: 'rgba(18,81,96,.45)', textAlign: 'right' }}>{a.pct}%</p>
              </div>
              <p className="kpi-value" style={{ fontSize: 22, minWidth: 36, textAlign: 'right' }}>{fN(a.v)}</p>
            </div>
          ))}
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, flexShrink: 0, minWidth: 150 }}>
          {stats.map(s => (
            <div key={s.l} className="kpi-card" style={{ borderLeftColor: s.col, minHeight: 0, padding: '9px 12px' }}>
              <p className="kpi-label" style={{ marginBottom: 3 }}>{s.l}</p>
              <p className="kpi-value" style={{ fontSize: 20 }}>{s.v}</p>
              <p className="kpi-sub" style={{ marginTop: 2 }}>{s.sub}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
