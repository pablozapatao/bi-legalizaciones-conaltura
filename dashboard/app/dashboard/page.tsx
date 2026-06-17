'use client'
import { useState, useEffect, useCallback, useRef } from 'react'
import {
  AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, Cell, Legend,
} from 'recharts'

// ─── TOKENS ────────────────────────────────────────────────────────────────
const C = {
  primary: '#125160', primaryLt: '#1a6b7a', beige: '#F4F0E5', beigeDk: '#EAE5D8',
  accent: '#A1D81A', accentLt: '#DBFF69', coral: '#FF795A', success: '#166534',
  warning: '#92400E', dark: '#0a3340', white: '#ffffff',
  stage: ['#125160','#1a6b7a','#1a7d6e','#279752'],
  red: '#991B1B',
}
const card: React.CSSProperties = {
  background: C.white, borderRadius: 14,
  border: `1px solid rgba(18,81,96,0.09)`,
  boxShadow: '0 1px 4px rgba(18,81,96,0.07)',
}
const cardBeige: React.CSSProperties = {
  background: C.beigeDk, borderRadius: 14,
  border: `1px solid rgba(18,81,96,0.07)`,
}

// ─── HELPERS ───────────────────────────────────────────────────────────────
const MES = ['','Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic']
const fmt  = (n: number | null | undefined, dec = 0) =>
  n == null ? '—' : n.toLocaleString('es-CO', { maximumFractionDigits: dec })
const fmtCOP = (n: number | null | undefined) =>
  n == null ? '—' : `$${(n/1_000_000).toLocaleString('es-CO', { maximumFractionDigits: 1 })}M`
const fmtD  = (n: number | null | undefined) => n == null ? '—' : `${n.toFixed(1)}d`
const nowCOL = () => {
  const d = new Date(new Date().toLocaleString('en-US', { timeZone: 'America/Bogota' }))
  return { anio: d.getFullYear(), mes: d.getMonth() + 1 }
}

// ─── GAUGE ANIMADO ─────────────────────────────────────────────────────────
function Gauge({ pct, meta, onEditMeta }: { pct: number; meta: number; onEditMeta: () => void }) {
  const [v, setV] = useState(0)
  const raf = useRef<number>()
  useEffect(() => {
    const target = Math.min(pct, 150), dur = 1400, t0 = performance.now()
    const go = (now: number) => {
      const p = Math.min((now - t0) / dur, 1)
      setV(Math.round((1 - Math.pow(1 - p, 3)) * target))
      if (p < 1) raf.current = requestAnimationFrame(go)
    }
    raf.current = requestAnimationFrame(go)
    return () => { if (raf.current) cancelAnimationFrame(raf.current) }
  }, [pct])

  const R = 68, cx = 88, cy = 85, startDeg = -210, sweep = 240
  const arc = (sd: number, sw: number) => {
    const toR = (d: number) => d * Math.PI / 180
    const [s, e] = [toR(sd), toR(sd + sw)]
    const [x1, y1, x2, y2] = [cx + R*Math.cos(s), cy + R*Math.sin(s), cx + R*Math.cos(e), cy + R*Math.sin(e)]
    return `M ${x1} ${y1} A ${R} ${R} 0 ${sw > 180 ? 1 : 0} 1 ${x2} ${y2}`
  }
  const fill  = Math.min(v, 100) / 100 * sweep
  const color = v >= 90 ? C.success : v >= 60 ? C.warning : C.coral
  const lbl   = v >= 90 ? 'En meta ✓' : v >= 60 ? 'En riesgo' : 'Crítico'

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
      <svg width="176" height="108" viewBox="0 0 176 108" style={{ overflow: 'visible' }}>
        <path d={arc(startDeg, sweep)} fill="none" stroke="rgba(18,81,96,0.1)" strokeWidth="11" strokeLinecap="round"/>
        {fill > 0 && <path d={arc(startDeg, fill)} fill="none" stroke={color} strokeWidth="11" strokeLinecap="round"/>}
        <text x={cx} y={cy + 2} textAnchor="middle" fontSize="30" fontWeight="800"
              fontFamily="Syne, sans-serif" fill={color}>{v}%</text>
        <text x={cx} y={cy + 20} textAnchor="middle" fontSize="11" fontWeight="600"
              fontFamily="Inter, sans-serif" fill={color} opacity=".85">{lbl}</text>
        {meta > 0 && <text x={cx} y={cy + 36} textAnchor="middle" fontSize="9.5"
              fontFamily="Inter, sans-serif" fill="rgba(18,81,96,0.45)">meta: {fmt(meta)}</text>}
      </svg>
      <button onClick={onEditMeta}
        style={{ fontSize: 11, fontWeight: 600, padding: '4px 12px', borderRadius: 99,
          background: meta > 0 ? 'rgba(18,81,96,0.08)' : C.accentLt,
          color: C.primary, border: 'none', cursor: 'pointer' }}>
        {meta > 0 ? 'Editar meta' : '+ Fijar meta del mes'}
      </button>
    </div>
  )
}

// ─── MAPA COLOMBIA ─────────────────────────────────────────────────────────
const COORDS: Record<string, { x: number; y: number }> = {
  'Barranquilla': { x: 178, y: 64 }, 'Cartagena': { x: 148, y: 81 },
  'Medellín': { x: 153, y: 202 },    'Bogotá': { x: 192, y: 258 },
  'Cali': { x: 150, y: 298 },
}
const COL_PATH = `M158 30 L198 25 L232 36 L247 58 L262 67 L257 88 L237 92 L222 77 L207 82 L218 102 L227 118 L232 138 L222 158 L217 178 L226 198 L221 218 L211 232 L216 252 L206 272 L196 287 L186 302 L176 317 L161 331 L146 341 L131 331 L121 316 L116 296 L126 276 L116 256 L111 236 L106 216 L116 196 L111 176 L101 161 L96 141 L101 121 L111 106 L106 86 L116 71 L126 56 L141 41 Z`

function MapaColombia({ ciudades }: { ciudades: any[] }) {
  const [hov, setHov] = useState<string | null>(null)
  const [met, setMet] = useState<'aprobadas' | 'pipeline_activo' | 'ventas_caidas'>('aprobadas')
  const maxV = Math.max(...ciudades.map(c => c[met] || 0), 1)
  const metColor = { aprobadas: C.primary, pipeline_activo: C.primaryLt, ventas_caidas: C.red }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* Selector */}
      <div style={{ display: 'flex', gap: 8 }}>
        {(['aprobadas', 'pipeline_activo', 'ventas_caidas'] as const).map(k => (
          <button key={k} onClick={() => setMet(k)} style={{
            fontSize: 11, fontWeight: 600, padding: '5px 12px', borderRadius: 99, border: 'none', cursor: 'pointer',
            background: met === k ? metColor[k] : C.beigeDk,
            color: met === k ? C.white : 'rgba(18,81,96,0.6)',
          }}>
            {k === 'aprobadas' ? 'Aprobadas' : k === 'pipeline_activo' ? 'En proceso' : 'Caídas'}
          </button>
        ))}
      </div>

      <div style={{ display: 'flex', gap: 24, alignItems: 'flex-start', flexWrap: 'wrap' }}>
        {/* SVG mapa */}
        <div style={{ position: 'relative', flexShrink: 0 }}>
          <svg width="290" height="360" viewBox="80 20 200 330"
               style={{ filter: 'drop-shadow(0 2px 10px rgba(18,81,96,0.12))' }}>
            <path d={COL_PATH} fill={C.beigeDk} stroke="rgba(18,81,96,0.18)" strokeWidth="1.5"/>
            {ciudades.map(c => {
              const pos = COORDS[c.ciudad]; if (!pos) return null
              const val = c[met] || 0
              const r   = val > 0 ? Math.max(9, Math.min(30, (val / maxV) * 30)) : 5
              const col = metColor[met]
              return (
                <g key={c.ciudad} onMouseEnter={() => setHov(c.ciudad)} onMouseLeave={() => setHov(null)}
                   style={{ cursor: 'pointer' }}>
                  {hov === c.ciudad && <circle cx={pos.x} cy={pos.y} r={r+7} fill={col} opacity={.12}/>}
                  <circle cx={pos.x} cy={pos.y} r={r} fill={col}
                          opacity={val > 0 ? (hov === c.ciudad ? 0.95 : 0.72) : 0.18}/>
                  {r >= 14 && <text x={pos.x} y={pos.y + 4} textAnchor="middle" fontSize="10"
                    fontWeight="700" fill="white" fontFamily="Syne, sans-serif">{val}</text>}
                  {r < 14 && val > 0 && <text x={pos.x} y={pos.y - r - 3} textAnchor="middle"
                    fontSize="9" fontWeight="600" fill={col} fontFamily="Inter, sans-serif">{val}</text>}
                </g>
              )
            })}
          </svg>

          {/* Tooltip */}
          {hov && (() => {
            const c = ciudades.find(x => x.ciudad === hov); if (!c) return null
            return (
              <div style={{ ...card, position: 'absolute', top: 12, right: -12,
                transform: 'translateX(100%)', padding: '10px 14px', minWidth: 160, zIndex: 10,
                fontSize: 12 }}>
                <p style={{ fontWeight: 700, marginBottom: 8, color: C.primary }}>{c.ciudad}</p>
                {[
                  ['Aprobadas', c.aprobadas, C.success],
                  ['En proceso', c.pipeline_activo, C.primary],
                  ['Caídas', c.ventas_caidas, C.red],
                  ['Lead time', fmtD(c.avg_lead_time), 'rgba(18,81,96,0.6)'],
                ].map(([lbl, val, col]) => (
                  <div key={lbl as string} style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                    <span style={{ color: 'rgba(18,81,96,0.5)' }}>{lbl}</span>
                    <span style={{ fontWeight: 600, color: col as string }}>{val}</span>
                  </div>
                ))}
              </div>
            )
          })()}
        </div>

        {/* Tabla ciudades */}
        <div style={{ flex: 1, minWidth: 200 }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ background: C.beigeDk }}>
                {['Ciudad','Aprobadas','En proceso','Caídas','Lead time'].map(h => (
                  <th key={h} style={{ padding: '9px 12px', textAlign: h === 'Ciudad' ? 'left' : 'right',
                    fontWeight: 600, fontSize: 11, textTransform: 'uppercase', letterSpacing: '.04em',
                    color: C.primary, opacity: .7, borderBottom: `1.5px solid rgba(18,81,96,0.1)` }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {[...ciudades].sort((a,b) => b.aprobadas - a.aprobadas).map(c => (
                <tr key={c.ciudad}
                    onMouseEnter={() => setHov(c.ciudad)} onMouseLeave={() => setHov(null)}
                    style={{ background: hov === c.ciudad ? 'rgba(18,81,96,0.03)' : C.white,
                      cursor: 'default', borderBottom: `1px solid rgba(18,81,96,0.05)` }}>
                  <td style={{ padding: '10px 12px', fontWeight: 600 }}>{c.ciudad}</td>
                  <td style={{ padding: '10px 12px', textAlign: 'right', fontWeight: 700, color: C.success }}>{fmt(c.aprobadas)}</td>
                  <td style={{ padding: '10px 12px', textAlign: 'right' }}>{fmt(c.pipeline_activo)}</td>
                  <td style={{ padding: '10px 12px', textAlign: 'right', color: c.ventas_caidas > 0 ? C.red : undefined }}>{fmt(c.ventas_caidas)}</td>
                  <td style={{ padding: '10px 12px', textAlign: 'right', opacity: .65 }}>{fmtD(c.avg_lead_time)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

// ─── TABLA PROYECTOS ────────────────────────────────────────────────────────
function TablaProyectos({ proyectos, totalAprobadas }: { proyectos: any[]; totalAprobadas: number }) {
  return (
    <div style={{ overflowX: 'auto' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
        <thead>
          <tr style={{ background: C.beigeDk }}>
            {['Proyecto','Director','Ciudad','Aprobadas','% total','Con novedades','Rechazadas','Caídas','Pipeline','Valor (COP)','Lead time'].map(h => (
              <th key={h} style={{ padding: '9px 12px', textAlign: h === 'Proyecto' || h === 'Director' || h === 'Ciudad' ? 'left' : 'right',
                fontWeight: 600, fontSize: 11, textTransform: 'uppercase', letterSpacing: '.04em',
                color: C.primary, opacity: .65, borderBottom: `1.5px solid rgba(18,81,96,0.1)`,
                whiteSpace: 'nowrap' }}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {proyectos.map((p, i) => {
            const aprobadas = (p.exitosas || 0) + (p.con_novedades || 0)
            const pct = totalAprobadas > 0 ? (aprobadas / totalAprobadas * 100).toFixed(1) : '0.0'
            return (
              <tr key={p.proyecto || i} style={{ borderBottom: `1px solid rgba(18,81,96,0.055)`,
                background: i % 2 === 0 ? C.white : 'rgba(244,240,229,0.4)' }}>
                <td style={{ padding: '10px 12px', fontWeight: 600, maxWidth: 180, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {p.proyecto || 'Sin proyecto'}
                </td>
                <td style={{ padding: '10px 12px', fontSize: 12, opacity: .7, whiteSpace: 'nowrap' }}>{p.director || '—'}</td>
                <td style={{ padding: '10px 12px', fontSize: 12, opacity: .7 }}>{p.ciudad || '—'}</td>
                <td style={{ padding: '10px 12px', textAlign: 'right', fontWeight: 700, color: C.success }}>{fmt(aprobadas)}</td>
                <td style={{ padding: '10px 12px', textAlign: 'right' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 6 }}>
                    <div style={{ width: 40, height: 4, borderRadius: 99, background: 'rgba(18,81,96,0.1)', overflow: 'hidden' }}>
                      <div style={{ width: `${Math.min(Number(pct), 100)}%`, height: '100%', background: C.primary, borderRadius: 99 }}/>
                    </div>
                    <span style={{ fontWeight: 600 }}>{pct}%</span>
                  </div>
                </td>
                <td style={{ padding: '10px 12px', textAlign: 'right', color: C.warning }}>{fmt(p.con_novedades)}</td>
                <td style={{ padding: '10px 12px', textAlign: 'right', color: p.rechazadas > 0 ? C.coral : undefined }}>{fmt(p.rechazadas)}</td>
                <td style={{ padding: '10px 12px', textAlign: 'right', color: (p.ventas_caidas || 0) > 0 ? C.red : undefined }}>{fmt(p.ventas_caidas)}</td>
                <td style={{ padding: '10px 12px', textAlign: 'right', color: C.primaryLt }}>{fmt(p.pipeline_activo)}</td>
                <td style={{ padding: '10px 12px', textAlign: 'right', fontWeight: 600 }}>{fmtCOP(p.suma_valor_inmueble)}</td>
                <td style={{ padding: '10px 12px', textAlign: 'right', opacity: .7 }}>{fmtD(p.avg_lead_time)}</td>
              </tr>
            )
          })}
        </tbody>
        <tfoot>
          <tr style={{ background: C.beigeDk, fontWeight: 700 }}>
            <td colSpan={3} style={{ padding: '10px 12px', fontSize: 12 }}>TOTAL</td>
            <td style={{ padding: '10px 12px', textAlign: 'right', color: C.success }}>{fmt(totalAprobadas)}</td>
            <td style={{ padding: '10px 12px', textAlign: 'right' }}>100%</td>
            <td colSpan={6}></td>
          </tr>
        </tfoot>
      </table>
    </div>
  )
}

// ─── TABLA LEGALIZACIONES DETALLE ──────────────────────────────────────────
const STAGE_LABEL: Record<string, string> = {
  consignacion: 'Consignación', legal_espera: 'Espera Director',
  legal_aprobada_dir: 'Aprobada Dir.', revision_sinco: 'Rev. SINCO',
  aprobado_exitoso: 'Aprobado ✓', aprobado_novedades: 'Con novedades',
  negocio_rechazado: 'Rechazado', venta_caida: 'Caída',
}
const STAGE_COLOR: Record<string, { bg: string; color: string }> = {
  aprobado_exitoso:   { bg: 'rgba(22,101,52,.12)',  color: '#166534' },
  aprobado_novedades: { bg: 'rgba(146,64,14,.12)',  color: '#92400E' },
  negocio_rechazado:  { bg: 'rgba(255,121,90,.15)', color: '#FF795A' },
  venta_caida:        { bg: 'rgba(153,27,27,.12)',  color: '#991B1B' },
  consignacion:       { bg: 'rgba(18,81,96,.09)',   color: '#125160' },
  legal_espera:       { bg: 'rgba(26,107,122,.1)',  color: '#1a6b7a' },
  legal_aprobada_dir: { bg: 'rgba(26,125,110,.1)',  color: '#1a7d6e' },
  revision_sinco:     { bg: 'rgba(30,143,98,.1)',   color: '#1e8f62' },
}

function BadgeStage({ codigo }: { codigo: string }) {
  const s = STAGE_COLOR[codigo] || { bg: 'rgba(18,81,96,.08)', color: C.primary }
  return (
    <span style={{ ...s, padding: '2px 9px', borderRadius: 99, fontSize: 11,
      fontWeight: 600, whiteSpace: 'nowrap', display: 'inline-block' }}>
      {STAGE_LABEL[codigo] || codigo}
    </span>
  )
}

function TablaDetalle({ rows, total, pagina, onPage, loading }: {
  rows: any[]; total: number; pagina: number; onPage: (p: number) => void; loading: boolean
}) {
  const totalPags = Math.ceil(total / 50)
  return (
    <div>
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
          <thead>
            <tr style={{ background: C.beigeDk }}>
              {['Nombre / ID','Proyecto','Etapa','Canal','Comprador','Valor','Fecha aprobación','Lead time',''].map(h => (
                <th key={h} style={{ padding: '9px 12px', textAlign: h === '' || h === 'Valor' || h === 'Lead time' ? 'right' : 'left',
                  fontWeight: 600, fontSize: 11, textTransform: 'uppercase', letterSpacing: '.04em',
                  color: C.primary, opacity: .65, borderBottom: `1.5px solid rgba(18,81,96,0.1)`,
                  whiteSpace: 'nowrap' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading
              ? Array(6).fill(0).map((_, i) => (
                <tr key={i}>
                  {Array(9).fill(0).map((_, j) => (
                    <td key={j} style={{ padding: '11px 12px' }}>
                      <div style={{ height: 12, borderRadius: 6, background: 'rgba(18,81,96,0.07)',
                        animation: 'pulse 1.5s ease infinite' }}/>
                    </td>
                  ))}
                </tr>
              ))
              : rows.map(r => (
                <tr key={r.hs_object_id} style={{ borderBottom: `1px solid rgba(18,81,96,0.055)` }}>
                  <td style={{ padding: '10px 12px' }}>
                    <p style={{ fontWeight: 600, fontSize: 12, marginBottom: 1 }}>
                      {r.nombre_legalizacion || `#${r.hs_object_id}`}
                    </p>
                    <p style={{ fontSize: 11, opacity: .45 }}>ID {r.hs_object_id}</p>
                  </td>
                  <td style={{ padding: '10px 12px' }}>
                    <p style={{ fontSize: 12, fontWeight: 500 }}>{r.proyecto || '—'}</p>
                    <p style={{ fontSize: 11, opacity: .45 }}>{r.director || ''}</p>
                  </td>
                  <td style={{ padding: '10px 12px' }}><BadgeStage codigo={r.etapa_codigo}/></td>
                  <td style={{ padding: '10px 12px', fontSize: 12, opacity: .7 }}>{r.canal_atribucion || '—'}</td>
                  <td style={{ padding: '10px 12px', fontSize: 12 }}>{r.nombrecomprador || '—'}</td>
                  <td style={{ padding: '10px 12px', textAlign: 'right', fontSize: 12, fontWeight: 600 }}>
                    {fmtCOP(r.valor_del_inmueble)}
                  </td>
                  <td style={{ padding: '10px 12px', fontSize: 12, opacity: .65 }}>
                    {r.fecha_aprobacion_final
                      ? new Date(r.fecha_aprobacion_final).toLocaleDateString('es-CO', { day: 'numeric', month: 'short', year: '2-digit' })
                      : <span style={{ opacity: .4 }}>En proceso</span>}
                  </td>
                  <td style={{ padding: '10px 12px', textAlign: 'right', fontSize: 12, fontWeight: 600,
                    color: !r.dias_lead_time ? undefined : r.dias_lead_time > 30 ? C.coral : r.dias_lead_time > 15 ? C.warning : C.success }}>
                    {fmtD(r.dias_lead_time)}
                  </td>
                  <td style={{ padding: '10px 12px', textAlign: 'right' }}>
                    <a href={r.hubspot_url} target="_blank" rel="noopener noreferrer"
                       style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                         width: 28, height: 28, borderRadius: 8, background: C.primary,
                         textDecoration: 'none' }} title="Ver en HubSpot">
                      <svg width="11" height="11" viewBox="0 0 24 24" fill="none">
                        <path d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6M15 3h6v6M10 14L21 3"
                              stroke="#A1D81A" strokeWidth="2.5" strokeLinecap="round"/>
                      </svg>
                    </a>
                  </td>
                </tr>
              ))}
          </tbody>
        </table>
      </div>
      {totalPags > 1 && (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '12px 16px', borderTop: `1px solid rgba(18,81,96,0.07)` }}>
          <button onClick={() => onPage(pagina - 1)} disabled={pagina <= 1}
            style={{ fontSize: 12, fontWeight: 600, padding: '6px 14px', borderRadius: 8, border: 'none', cursor: 'pointer',
              background: C.beigeDk, color: C.primary, opacity: pagina <= 1 ? .35 : 1 }}>← Anterior</button>
          <span style={{ fontSize: 12, opacity: .5 }}>{pagina} / {totalPags} · {fmt(total)} registros</span>
          <button onClick={() => onPage(pagina + 1)} disabled={pagina >= totalPags}
            style={{ fontSize: 12, fontWeight: 600, padding: '6px 14px', borderRadius: 8, border: 'none', cursor: 'pointer',
              background: C.beigeDk, color: C.primary, opacity: pagina >= totalPags ? .35 : 1 }}>Siguiente →</button>
        </div>
      )}
    </div>
  )
}

// ─── META MODAL ─────────────────────────────────────────────────────────────
function MetaModal({ anio, mes, actual, onClose, onSaved }: {
  anio: number; mes: number; actual: number; onClose: () => void; onSaved: (n: number) => void
}) {
  const [val, setVal] = useState(actual > 0 ? String(actual) : '')
  const [saving, setSaving] = useState(false)
  async function save() {
    const n = parseInt(val, 10)
    if (isNaN(n) || n < 0) return
    setSaving(true)
    try {
      await fetch('/api/metas/upsert', { method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ anio, mes, meta_negocios: n }) })
      onSaved(n); onClose()
    } finally { setSaving(false) }
  }
  return (
    <div onClick={e => e.target === e.currentTarget && onClose()}
         style={{ position: 'fixed', inset: 0, zIndex: 50, display: 'flex', alignItems: 'center',
           justifyContent: 'center', padding: 16, background: 'rgba(18,81,96,0.4)', backdropFilter: 'blur(6px)' }}>
      <div style={{ ...card, padding: 28, width: '100%', maxWidth: 380 }}>
        <h3 style={{ fontFamily: 'Syne, sans-serif', fontSize: 18, fontWeight: 700, marginBottom: 4, color: C.primary }}>
          Meta de legalizaciones
        </h3>
        <p style={{ fontSize: 12, opacity: .5, marginBottom: 20 }}>
          {MES[mes]} {anio} · aprobaciones objetivo (exitosas + con novedades)
        </p>
        <label style={{ display: 'block', fontSize: 11, fontWeight: 600, textTransform: 'uppercase',
          letterSpacing: '.04em', opacity: .55, marginBottom: 8 }}>Número objetivo</label>
        <input type="number" min="0" value={val} onChange={e => setVal(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && save()}
          autoFocus placeholder="ej. 150"
          style={{ width: '100%', padding: '12px 16px', borderRadius: 10, border: `1.5px solid rgba(18,81,96,0.2)`,
            fontSize: 20, fontWeight: 700, color: C.primary, marginBottom: 16, outline: 'none', fontFamily: 'Syne, sans-serif' }}/>
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={onClose} style={{ flex: 1, padding: '11px 0', borderRadius: 10, border: 'none', cursor: 'pointer',
            background: C.beigeDk, color: 'rgba(18,81,96,0.6)', fontWeight: 600, fontSize: 13 }}>Cancelar</button>
          <button onClick={save} disabled={saving || !val}
            style={{ flex: 1, padding: '11px 0', borderRadius: 10, border: 'none', cursor: 'pointer',
              background: C.accentLt, color: C.primary, fontWeight: 700, fontSize: 13,
              opacity: (saving || !val) ? .5 : 1 }}>
            {saving ? 'Guardando…' : 'Guardar meta'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── SECTION WRAPPER ────────────────────────────────────────────────────────
function Section({ title, sub, children, id }: {
  title: string; sub?: string; children: React.ReactNode; id?: string
}) {
  return (
    <section id={id} style={{ marginBottom: 40 }}>
      <div style={{ marginBottom: 16 }}>
        {sub && <p style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.08em', opacity: .4, marginBottom: 2 }}>{sub}</p>}
        <h2 style={{ fontFamily: 'Syne, sans-serif', fontSize: 22, fontWeight: 700, color: C.primary, margin: 0 }}>{title}</h2>
      </div>
      <div style={card}>{children}</div>
    </section>
  )
}

function Sk({ h = 120 }: { h?: number }) {
  return <div style={{ height: h, borderRadius: 14, background: 'rgba(18,81,96,0.07)',
    animation: 'shimmer 1.5s ease infinite',
    backgroundImage: 'linear-gradient(90deg,rgba(18,81,96,0.05) 25%,rgba(18,81,96,0.1) 50%,rgba(18,81,96,0.05) 75%)',
    backgroundSize: '200% 100%' }}/>
}

// ─── TOOLTIP ────────────────────────────────────────────────────────────────
const TT = {
  contentStyle: { background: C.white, border: `1px solid rgba(18,81,96,0.12)`,
    borderRadius: 10, fontSize: 12, fontFamily: 'Inter, sans-serif',
    boxShadow: '0 4px 16px rgba(18,81,96,0.1)' },
  labelStyle: { color: C.primary, fontWeight: 700, marginBottom: 4 },
}

// ════════════════════════════════════════════════════════════════════════════
// DASHBOARD PRINCIPAL
// ════════════════════════════════════════════════════════════════════════════
export default function Dashboard() {
  const hoy = nowCOL()
  const [anio, setAnio] = useState(hoy.anio)
  const [mes,  setMes]  = useState(hoy.mes)
  const [ciudad,    setCiudad]    = useState('')
  const [director,  setDirector]  = useState('')
  const [canal,     setCanal]     = useState('')
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [showMeta,    setShowMeta]    = useState(false)
  const [pagina,      setPagina]      = useState(1)

  const [kpis,      setKpis]      = useState<any>(null)
  const [pipeline,  setPipeline]  = useState<any>(null)
  const [tendencia, setTendencia] = useState<any>(null)
  const [tiempos,   setTiempos]   = useState<any>(null)
  const [mapa,      setMapa]      = useState<any>(null)
  const [proyectos, setProyectos] = useState<any>(null)
  const [canales,   setCanales]   = useState<any>(null)
  const [detalle,   setDetalle]   = useState<any>(null)
  const [loadDet,   setLoadDet]   = useState(false)

  const qs = useCallback(() => {
    const p = new URLSearchParams({ anio: String(anio), mes: String(mes) })
    if (ciudad)   p.set('ciudad',          ciudad)
    if (director) p.set('director',        director)
    if (canal)    p.set('canal_atribucion', canal)
    return p.toString()
  }, [anio, mes, ciudad, director, canal])

  const fetchAll = useCallback(async () => {
    const q = qs()
    setKpis(null); setPipeline(null); setTiempos(null); setMapa(null); setProyectos(null); setCanales(null)
    const [k,pi,ti,ma,pr,ca,te] = await Promise.all([
      fetch(`/api/kpis?${q}`).then(r=>r.json()),
      fetch(`/api/pipeline?${q}`).then(r=>r.json()),
      fetch(`/api/tiempos?${q}`).then(r=>r.json()),
      fetch(`/api/mapa?${q}`).then(r=>r.json()),
      fetch(`/api/proyectos?${q}`).then(r=>r.json()),
      fetch(`/api/canales?${q}`).then(r=>r.json()),
      fetch(`/api/tendencia?${new URLSearchParams({meses:'14',...Object.fromEntries(new URLSearchParams(q))})}`).then(r=>r.json()),
    ])
    setKpis(k); setPipeline(pi); setTiempos(ti); setMapa(ma); setProyectos(pr); setCanales(ca); setTendencia(te)
  }, [qs])

  const fetchDet = useCallback(async (p = 1) => {
    setLoadDet(true)
    try {
      const q = qs()
      setDetalle(await fetch(`/api/detalle?${q}&pagina=${p}&por_pagina=50`).then(r=>r.json()))
      setPagina(p)
    } finally { setLoadDet(false) }
  }, [qs])

  useEffect(() => { fetchAll() }, [fetchAll])
  useEffect(() => { fetchDet(1) }, [fetchDet])

  // Opciones de período
  const periodos: {anio:number;mes:number;lbl:string}[] = []
  let pa = hoy.anio, pm = hoy.mes
  for (let i=0;i<18;i++) {
    periodos.push({ anio:pa, mes:pm, lbl:`${MES[pm]} ${pa}` })
    pm--; if (pm < 1) { pm=12; pa-- }
  }

  // Colores de canales
  const canalColors = ['#125160','#1a6b7a','#1a7d6e','#279752','#4d7c0f','#166534']

  return (
    <div style={{ minHeight: '100vh', background: C.beige, fontFamily: 'Inter, sans-serif', color: C.primary }}>
      <style>{`
        @keyframes shimmer { 0%{background-position:-200% 0} 100%{background-position:200% 0} }
        @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:.5} }
        ::-webkit-scrollbar{width:5px;height:5px}
        ::-webkit-scrollbar-thumb{background:rgba(18,81,96,0.2);border-radius:99px}
        select option{background:white;color:#125160}
      `}</style>

      {/* SIDEBAR */}
      {sidebarOpen && (
        <div onClick={() => setSidebarOpen(false)}
             style={{ position:'fixed',inset:0,zIndex:20,background:'rgba(0,0,0,0.25)' }}/>
      )}
      <aside style={{ position:'fixed',inset:'0 auto 0 0',zIndex:30,width:240,
        background:C.dark,display:'flex',flexDirection:'column',
        transform: sidebarOpen ? 'translateX(0)' : 'translateX(-100%)',
        transition:'transform .3s cubic-bezier(.4,0,.2,1)' }}>

        {/* Logo */}
        <div style={{ padding:'20px 20px 16px', borderBottom:'1px solid rgba(255,255,255,0.07)', display:'flex',alignItems:'center',gap:12 }}>
          <div style={{ width:34,height:34,borderRadius:10,background:'rgba(161,216,26,0.15)',
            display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0 }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
              <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"
                    stroke="#A1D81A" strokeWidth="2.5" strokeLinecap="round"/>
            </svg>
          </div>
          <div style={{ flex:1 }}>
            <p style={{ color:'white',fontFamily:'Syne,sans-serif',fontWeight:700,fontSize:13,margin:0,lineHeight:1.2 }}>BI Legalizaciones</p>
            <p style={{ color:'rgba(255,255,255,0.38)',fontSize:11,margin:0 }}>Conaltura</p>
          </div>
          <button onClick={()=>setSidebarOpen(false)} style={{ color:'rgba(255,255,255,0.35)',background:'none',border:'none',cursor:'pointer',fontSize:16,lineHeight:1 }}>✕</button>
        </div>

        {/* Período */}
        <div style={{ padding:'16px 16px 12px', borderBottom:'1px solid rgba(255,255,255,0.05)' }}>
          <p style={{ color:'rgba(255,255,255,0.38)',fontSize:10,fontWeight:600,textTransform:'uppercase',letterSpacing:'.07em',marginBottom:8 }}>Período</p>
          <select value={`${anio}-${mes}`} onChange={e=>{const[a,m]=e.target.value.split('-').map(Number);setAnio(a);setMes(m)}}
            style={{ width:'100%',background:'rgba(255,255,255,0.08)',color:'white',border:'none',
              borderRadius:8,padding:'7px 10px',fontSize:13,fontWeight:600,outline:'none',cursor:'pointer' }}>
            {periodos.map(o=>(
              <option key={`${o.anio}-${o.mes}`} value={`${o.anio}-${o.mes}`}>{o.lbl}</option>
            ))}
          </select>
        </div>

        {/* Filtros */}
        <div style={{ padding:'16px', flex:1, overflowY:'auto' }}>
          <p style={{ color:'rgba(255,255,255,0.38)',fontSize:10,fontWeight:600,textTransform:'uppercase',letterSpacing:'.07em',marginBottom:12 }}>Filtros</p>
          {[
            { lbl:'Ciudad', val:ciudad, set:setCiudad, opts:['Medellín','Bogotá','Barranquilla','Cartagena','Cali'] },
            { lbl:'Director', val:director, set:setDirector, opts:['Alba Luz Consuegra','Carolina Cárdenas','Ingrid Marcela Matta','Leonardo Villegas','Natalia Giraldo','Patricia Herrera'] },
          ].map(f=>(
            <div key={f.lbl} style={{ marginBottom:12 }}>
              <label style={{ display:'block',color:'rgba(255,255,255,0.45)',fontSize:11,marginBottom:5 }}>{f.lbl}</label>
              <select value={f.val} onChange={e=>f.set(e.target.value)}
                style={{ width:'100%',background:'rgba(255,255,255,0.08)',color:'white',border:'none',
                  borderRadius:8,padding:'7px 10px',fontSize:12,outline:'none',cursor:'pointer' }}>
                <option value="">Todos</option>
                {f.opts.map(o=><option key={o} value={o}>{o}</option>)}
              </select>
            </div>
          ))}
          {(ciudad||director||canal) && (
            <button onClick={()=>{setCiudad('');setDirector('');setCanal('')}}
              style={{ width:'100%',padding:'8px',borderRadius:8,border:'none',cursor:'pointer',marginTop:4,
                background:'rgba(255,121,90,0.18)',color:'#FF795A',fontSize:12,fontWeight:600 }}>
              Limpiar filtros
            </button>
          )}
        </div>

        {/* Última actualización */}
        <div style={{ padding:'12px 16px', borderTop:'1px solid rgba(255,255,255,0.05)' }}>
          {kpis?.ultima_actualizacion && (
            <p style={{ color:'rgba(255,255,255,0.28)',fontSize:11 }}>
              ETL {new Date(kpis.ultima_actualizacion).toLocaleString('es-CO',{month:'short',day:'numeric',hour:'2-digit',minute:'2-digit'})}
            </p>
          )}
          <div style={{ display:'flex',alignItems:'center',gap:6,marginTop:4 }}>
            <div style={{ width:6,height:6,borderRadius:'50%',background:C.accent }}/>
            <p style={{ color:'rgba(255,255,255,0.38)',fontSize:11,margin:0 }}>Live · cada 2h</p>
          </div>
        </div>
      </aside>

      {/* MAIN */}
      <main>
        {/* Topbar */}
        <header style={{ position:'sticky',top:0,zIndex:10,display:'flex',alignItems:'center',gap:12,
          padding:'12px 24px', background:'rgba(244,240,229,0.94)',backdropFilter:'blur(10px)',
          borderBottom:`1px solid rgba(18,81,96,0.09)` }}>
          <button onClick={()=>setSidebarOpen(true)}
            style={{ width:36,height:36,borderRadius:9,background:C.primary,border:'none',cursor:'pointer',
              display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0 }}>
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none">
              <path d="M3 12h18M3 6h18M3 18h18" stroke={C.accent} strokeWidth="2.5" strokeLinecap="round"/>
            </svg>
          </button>

          <div style={{ display:'flex',alignItems:'center',gap:8,flex:1,overflow:'hidden' }}>
            <span style={{ fontFamily:'Syne,sans-serif',fontWeight:700,fontSize:15,color:C.primary,whiteSpace:'nowrap' }}>
              BI Legalizaciones
            </span>
            <span style={{ opacity:.25,fontSize:14 }}>/</span>
            <span style={{ fontSize:14,opacity:.55,whiteSpace:'nowrap' }}>{MES[mes]} {anio}</span>
            {/* Chips de filtros activos */}
            <div style={{ display:'flex',gap:6,flexWrap:'wrap' }}>
              {[ciudad&&{l:ciudad,c:setCiudad}, director&&{l:director,c:setDirector}, canal&&{l:canal,c:setCanal}]
                .filter(Boolean).map((f:any) => (
                  <span key={f.l} style={{ display:'inline-flex',alignItems:'center',gap:4,
                    padding:'3px 10px',borderRadius:99,fontSize:11,fontWeight:600,
                    background:'rgba(18,81,96,0.09)',color:C.primary }}>
                    {f.l}
                    <button onClick={()=>f.c('')} style={{ background:'none',border:'none',cursor:'pointer',
                      opacity:.5,fontSize:12,padding:0,lineHeight:1,color:C.primary }}>✕</button>
                  </span>
                ))}
            </div>
          </div>

          {/* Selector rápido período */}
          <select value={`${anio}-${mes}`} onChange={e=>{const[a,m]=e.target.value.split('-').map(Number);setAnio(a);setMes(m)}}
            style={{ fontSize:13,fontWeight:600,padding:'6px 10px',borderRadius:8,
              border:`1px solid rgba(18,81,96,0.15)`,background:'white',color:C.primary,outline:'none',cursor:'pointer' }}>
            {periodos.map(o=>(
              <option key={`${o.anio}-${o.mes}`} value={`${o.anio}-${o.mes}`}>{o.lbl}</option>
            ))}
          </select>
        </header>

        {/* CONTENIDO */}
        <div style={{ maxWidth: 1280, margin:'0 auto', padding:'32px 24px 64px' }}>

          {/* ═══ 1. KPIs ═══════════════════════════════════════════════════ */}
          <section style={{ marginBottom: 40 }} id="kpis">
            <div style={{ display:'flex',alignItems:'flex-end',justifyContent:'space-between',marginBottom:20 }}>
              <div>
                <p style={{ fontSize:11,fontWeight:600,textTransform:'uppercase',letterSpacing:'.08em',opacity:.4,marginBottom:3 }}>
                  Resolución del mes
                </p>
                <h2 style={{ fontFamily:'Syne,sans-serif',fontSize:26,fontWeight:800,color:C.primary,margin:0 }}>
                  {MES[mes]} {anio}
                </h2>
              </div>
              {kpis?.ultima_actualizacion && (
                <p style={{ fontSize:11,opacity:.4 }}>
                  Actualizado {new Date(kpis.ultima_actualizacion).toLocaleString('es-CO',{month:'short',day:'numeric',hour:'2-digit',minute:'2-digit'})}
                </p>
              )}
            </div>

            {!kpis ? <Sk h={260}/> : (
              <div style={{ display:'grid',gridTemplateColumns:'240px 1fr',gap:16 }}>
                {/* GAUGE */}
                <div style={{ ...card, padding:24, display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center' }}>
                  <p style={{ fontSize:10,fontWeight:600,textTransform:'uppercase',letterSpacing:'.08em',opacity:.4,marginBottom:8,textAlign:'center' }}>
                    Cumplimiento vs meta
                  </p>
                  <Gauge pct={kpis.pct_cumplimiento} meta={kpis.meta_negocios} onEditMeta={()=>setShowMeta(true)}/>
                </div>

                {/* 6 KPI CARDS */}
                <div style={{ display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:12 }}>
                  {[
                    { lbl:'Total del mes',       val:kpis.total_resolucion,    color:C.primary, sub:`${kpis.aprobadas_exitoso + kpis.aprobadas_novedades} aprobadas · ${kpis.rechazadas} rechazadas` },
                    { lbl:'Aprobadas sin novedades', val:kpis.aprobadas_exitoso, color:C.success, sub:`${kpis.total_resolucion>0?((kpis.aprobadas_exitoso/kpis.total_resolucion)*100).toFixed(0):0}% del total` },
                    { lbl:'Aprobadas con novedades', val:kpis.aprobadas_novedades, color:C.warning, sub:`${kpis.total_resolucion>0?((kpis.aprobadas_novedades/kpis.total_resolucion)*100).toFixed(0):0}% del total` },
                    { lbl:'Rechazadas',          val:kpis.rechazadas,          color:kpis.rechazadas>0?C.coral:C.primary, sub:undefined },
                    { lbl:'Ventas caídas',        val:kpis.ventas_caidas,       color:kpis.ventas_caidas>0?C.red:C.primary, sub:undefined },
                    { lbl:'En ventana de cierre', val:`${kpis.pct_ventana_cierre}%`, color:kpis.pct_ventana_cierre>40?C.warning:C.primary,
                      sub:`${kpis.en_ventana_cierre} aprobadas en últimos 3 + primeros 4 días` },
                  ].map(k=>(
                    <div key={k.lbl} style={{ ...cardBeige, padding:'18px 20px' }}>
                      <p style={{ fontSize:11,fontWeight:600,textTransform:'uppercase',letterSpacing:'.05em',opacity:.5,marginBottom:8,lineHeight:1.3 }}>{k.lbl}</p>
                      <p style={{ fontFamily:'Syne,sans-serif',fontSize:32,fontWeight:800,color:k.color,margin:0,lineHeight:1,letterSpacing:'-.02em' }}>
                        {typeof k.val === 'number' ? fmt(k.val) : k.val}
                      </p>
                      {k.sub && <p style={{ fontSize:11,marginTop:6,opacity:.55,lineHeight:1.4 }}>{k.sub}</p>}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </section>

          {/* ═══ 2. PIPELINE ══════════════════════════════════════════════ */}
          <Section title={`Pipeline activo — ${pipeline ? fmt(pipeline.total_pipeline) : '…'} en proceso`} sub="Lo que viene en camino" id="pipeline">
            {!pipeline ? <div style={{ padding:32 }}><Sk h={100}/></div> : (
              <div style={{ padding:24 }}>
                {pipeline.caidas_del_mes > 0 && (
                  <div style={{ display:'inline-flex',alignItems:'center',gap:6,padding:'6px 14px',borderRadius:99,
                    background:'rgba(153,27,27,0.1)',marginBottom:20 }}>
                    <span style={{ fontWeight:700,fontSize:13,color:C.red }}>{pipeline.caidas_del_mes}</span>
                    <span style={{ fontSize:12,color:C.red }}>ventas caídas este mes</span>
                  </div>
                )}

                {/* Barras proporcionales */}
                <div style={{ display:'flex',gap:4,height:56,borderRadius:10,overflow:'hidden',marginBottom:16 }}>
                  {pipeline.stages?.map((s: any, i: number) => {
                    if (s.count === 0) return null
                    return (
                      <div key={s.etapa_codigo} title={`${s.etapa_label}: ${s.count}`}
                           style={{ flex:s.count, background:C.stage[i], minWidth:4,
                             display:'flex',alignItems:'center',justifyContent:'center',
                             borderRadius:s.count/(pipeline.total_pipeline||1) > 0.08 ? 6 : 0,
                             transition:'all .6s cubic-bezier(.4,0,.2,1)' }}>
                        {s.pct_del_total > 8 && (
                          <span style={{ color:'white',fontSize:14,fontFamily:'Syne,sans-serif',fontWeight:700 }}>
                            {s.count}
                          </span>
                        )}
                      </div>
                    )
                  })}
                </div>

                {/* Leyenda */}
                <div style={{ display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:12 }}>
                  {pipeline.stages?.map((s: any, i: number) => (
                    <div key={s.etapa_codigo} style={{ display:'flex',alignItems:'flex-start',gap:8 }}>
                      <div style={{ width:10,height:10,borderRadius:3,background:C.stage[i],marginTop:2,flexShrink:0 }}/>
                      <div>
                        <p style={{ fontSize:12,fontWeight:600,margin:0,lineHeight:1.3 }}>{s.etapa_label}</p>
                        <p style={{ fontSize:11,opacity:.5,margin:0,marginTop:2 }}>
                          {fmt(s.count)} · {s.pct_del_total}%
                          {s.aging_promedio != null ? ` · ${s.aging_promedio}d prom.` : ''}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </Section>

          {/* ═══ 3. TENDENCIA ══════════════════════════════════════════════ */}
          <Section title="Tendencia mensual" sub="Últimos 14 meses" id="tendencia">
            {!tendencia ? <div style={{padding:32}}><Sk h={220}/></div> : (
              <div style={{ padding:24 }}>
                <div style={{ display:'flex',gap:16,flexWrap:'wrap',marginBottom:16 }}>
                  {[{c:C.primary,l:'Aprobadas'},{c:C.coral,l:'Rechazadas'},{c:C.red,l:'Caídas'},{c:C.accent,l:'Meta',d:true}]
                    .map(({c,l,d})=>(
                    <div key={l} style={{ display:'flex',alignItems:'center',gap:6 }}>
                      <div style={{ width:20,height:d?0:2,borderTop:d?`2px dashed ${c}`:undefined,background:d?undefined:c,borderRadius:99 }}/>
                      <span style={{ fontSize:12,opacity:.6 }}>{l}</span>
                    </div>
                  ))}
                </div>
                <ResponsiveContainer width="100%" height={230}>
                  <AreaChart data={tendencia.meses} margin={{top:4,right:8,left:-20,bottom:0}}>
                    <defs>
                      <linearGradient id="gA" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor={C.primary} stopOpacity={.12}/>
                        <stop offset="95%" stopColor={C.primary} stopOpacity={0}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(18,81,96,0.06)"/>
                    <XAxis dataKey="label" tick={{fontSize:10,fill:'rgba(18,81,96,0.5)'}} axisLine={false} tickLine={false}/>
                    <YAxis tick={{fontSize:10,fill:'rgba(18,81,96,0.4)'}} axisLine={false} tickLine={false}/>
                    <Tooltip {...TT} formatter={(v:any,n:any)=>[fmt(v), n==='aprobadas'?'Aprobadas':n==='rechazadas'?'Rechazadas':n==='ventas_caidas'?'Caídas':'Meta']}/>
                    <Area type="monotone" dataKey="meta" stroke={C.accent} strokeWidth={1.5} strokeDasharray="5 3" fill="none" dot={false} connectNulls/>
                    <Area type="monotone" dataKey="aprobadas" stroke={C.primary} strokeWidth={2} fill="url(#gA)" dot={{fill:C.primary,r:3,strokeWidth:0}} activeDot={{r:5}}/>
                    <Area type="monotone" dataKey="rechazadas" stroke={C.coral} strokeWidth={1.5} fill="none" dot={{fill:C.coral,r:2,strokeWidth:0}}/>
                    <Area type="monotone" dataKey="ventas_caidas" stroke={C.red} strokeWidth={1.5} fill="none" dot={{fill:C.red,r:2,strokeWidth:0}}/>
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            )}
          </Section>

          {/* ═══ 4. TIEMPOS ═══════════════════════════════════════════════ */}
          <Section title="Velocidad del proceso" sub="Tiempos de legalización" id="tiempos">
            {!tiempos ? <div style={{padding:32}}><Sk h={200}/></div> : (
              <div style={{ padding:24 }}>
                {/* Resumen global */}
                {tiempos.global?.p50_lead_time != null && (
                  <div style={{ display:'flex',gap:32,marginBottom:28,padding:'20px 24px',borderRadius:10,
                    background:C.beigeDk, flexWrap:'wrap' }}>
                    <div>
                      <p style={{ fontSize:11,opacity:.45,marginBottom:4 }}>La mitad se aprueba en menos de</p>
                      <p style={{ fontFamily:'Syne,sans-serif',fontSize:40,fontWeight:800,color:C.primary,margin:0,lineHeight:1 }}>
                        {tiempos.global.p50_lead_time}<span style={{ fontSize:18,fontWeight:400,opacity:.5,marginLeft:4 }}>días</span>
                      </p>
                    </div>
                    <div style={{ display:'flex',gap:24 }}>
                      {[['Promedio',tiempos.global.avg_lead_time],['P90 (más lento)',tiempos.global.p90_lead_time]].map(([lbl,v])=>(
                        <div key={lbl as string}>
                          <p style={{ fontSize:11,opacity:.45,marginBottom:4 }}>{lbl}</p>
                          <p style={{ fontFamily:'Syne,sans-serif',fontSize:22,fontWeight:700,color:C.primary,margin:0 }}>{fmtD(v as number)}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Por stage */}
                <div style={{ marginBottom:24 }}>
                  <p style={{ fontSize:11,fontWeight:600,textTransform:'uppercase',letterSpacing:'.07em',opacity:.4,marginBottom:16 }}>
                    Duración promedio por etapa
                  </p>
                  <div style={{ display:'grid',gridTemplateColumns:'repeat(2,1fr)',gap:16 }}>
                    {tiempos.por_stage?.filter((s:any)=>s.n>0).map((s:any)=>{
                      const color = !s.p50_dias ? 'rgba(18,81,96,0.3)' : s.p50_dias<=15 ? C.success : s.p50_dias<=30 ? C.warning : C.coral
                      return (
                        <div key={s.stage}>
                          <div style={{ display:'flex',justifyContent:'space-between',marginBottom:6 }}>
                            <span style={{ fontSize:13,fontWeight:600 }}>{s.label}</span>
                            <div style={{ display:'flex',alignItems:'center',gap:8 }}>
                              <span style={{ fontSize:11,fontWeight:600,color }}>
                                {s.p50_dias!=null ? (s.p50_dias<=15?'● Rápido':s.p50_dias<=30?'● Normal':'● Lento') : ''}
                              </span>
                              <span style={{ fontSize:13,fontWeight:700 }}>{fmtD(s.avg_dias)}</span>
                            </div>
                          </div>
                          <div style={{ height:8,borderRadius:99,background:'rgba(18,81,96,0.08)',overflow:'hidden',position:'relative' }}>
                            <div style={{ position:'absolute',inset:'0 auto 0 0',width:`${Math.min((15/60)*100,100)}%`,background:C.success,opacity:.2 }}/>
                            <div style={{ position:'absolute',inset:'0 auto 0 0',left:`${Math.min((15/60)*100,100)}%`,
                              width:`${Math.max(0,(15/60)*100)}%`,background:C.warning,opacity:.2 }}/>
                            {s.avg_dias != null && (
                              <div style={{ position:'absolute',top:'50%',transform:'translateY(-50%)',
                                left:`${Math.min((s.avg_dias/60)*100,98)}%`,
                                width:12,height:12,borderRadius:'50%',background:C.primary,border:'2px solid white',marginLeft:-6 }}/>
                            )}
                          </div>
                          <div style={{ display:'flex',gap:12,marginTop:4 }}>
                            <span style={{ fontSize:10,opacity:.35 }}>Med. {fmtD(s.p50_dias)}</span>
                            <span style={{ fontSize:10,opacity:.35 }}>P90: {fmtD(s.p90_dias)}</span>
                            <span style={{ fontSize:10,opacity:.35 }}>n={fmt(s.n)}</span>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>

                {/* Ranking proyectos */}
                {tiempos.por_proyecto?.length > 0 && (
                  <div>
                    <p style={{ fontSize:11,fontWeight:600,textTransform:'uppercase',letterSpacing:'.07em',opacity:.4,marginBottom:16 }}>
                      Ranking proyectos por velocidad
                    </p>
                    <div style={{ display:'flex',flexDirection:'column',gap:10 }}>
                      {tiempos.por_proyecto.slice(0,10).map((p:any)=>{
                        const maxLt = tiempos.por_proyecto[0]?.avg_lead_time || 1
                        const color = p.semaforo==='verde'?C.success:p.semaforo==='amarillo'?C.warning:p.semaforo==='rojo'?C.coral:'rgba(18,81,96,0.3)'
                        return (
                          <div key={p.proyecto}>
                            <div style={{ display:'flex',justifyContent:'space-between',marginBottom:4 }}>
                              <div style={{ display:'flex',alignItems:'center',gap:6 }}>
                                <div style={{ width:8,height:8,borderRadius:'50%',background:color,flexShrink:0 }}/>
                                <span style={{ fontSize:12,fontWeight:600,maxWidth:200,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap' }}>{p.proyecto}</span>
                                <span style={{ fontSize:11,opacity:.4 }}>({fmt(p.n)})</span>
                              </div>
                              <span style={{ fontSize:12,fontWeight:700 }}>{fmtD(p.avg_lead_time)}</span>
                            </div>
                            <div style={{ height:4,borderRadius:99,background:'rgba(18,81,96,0.08)' }}>
                              <div style={{ height:'100%',borderRadius:99,background:color,opacity:.7,
                                width:`${((p.avg_lead_time||0)/maxLt)*100}%`,transition:'width .6s' }}/>
                            </div>
                          </div>
                        )
                      })}
                    </div>
                    <div style={{ display:'flex',gap:16,marginTop:16,paddingTop:12,borderTop:`1px solid rgba(18,81,96,0.07)` }}>
                      {[{c:C.success,l:'Rápido (≤15d)'},{c:C.warning,l:'Normal (16–30d)'},{c:C.coral,l:'Lento (>30d)'}]
                        .map(({c,l})=>(
                        <div key={l} style={{ display:'flex',alignItems:'center',gap:5 }}>
                          <div style={{ width:8,height:8,borderRadius:'50%',background:c }}/>
                          <span style={{ fontSize:11,opacity:.5 }}>{l}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </Section>

          {/* ═══ 5. MAPA ══════════════════════════════════════════════════ */}
          <Section title="Distribución geográfica" sub="Por ciudad" id="mapa">
            {!mapa ? <div style={{padding:32}}><Sk h={300}/></div> : (
              <div style={{ padding:24 }}>
                <MapaColombia ciudades={mapa.ciudades || []}/>
              </div>
            )}
          </Section>

          {/* ═══ 6. CANALES ═══════════════════════════════════════════════ */}
          <Section title="Canales de atribución" sub="Análisis por canal" id="canales">
            {!canales ? <div style={{padding:32}}><Sk h={200}/></div> : (
              <div style={{ padding:24 }}>
                {/* Tabs */}
                {[
                  { key:'por_atribucion', label:'Atribución' },
                  { key:'por_gestion_original', label:'Gestión original' },
                  { key:'por_gestion_secundario', label:'Gestión secundario' },
                ].map(({ key, label })=>{
                  const rows = canales[key] || []
                  if (!rows.length) return null
                  const maxA = Math.max(...rows.map((r:any)=>r.aprobadas), 1)
                  return (
                    <div key={key} style={{ marginBottom:28 }}>
                      <p style={{ fontSize:12,fontWeight:600,opacity:.5,marginBottom:12,textTransform:'uppercase',letterSpacing:'.05em' }}>{label}</p>
                      <div style={{ display:'flex',flexDirection:'column',gap:8 }}>
                        {rows.map((r:any, i:number)=>(
                          <div key={r.canal} style={{ display:'flex',alignItems:'center',gap:12 }}>
                            <span style={{ fontSize:12,fontWeight:600,width:180,flexShrink:0,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap' }}>
                              {r.canal || '(Sin canal)'}
                            </span>
                            <div style={{ flex:1,height:24,borderRadius:6,background:'rgba(18,81,96,0.06)',overflow:'hidden',position:'relative' }}>
                              <div style={{ position:'absolute',inset:'0 auto 0 0',
                                width:`${(r.aprobadas/maxA)*100}%`,
                                background:canalColors[i % canalColors.length],
                                borderRadius:6,opacity:.8,transition:'width .6s' }}/>
                              <span style={{ position:'absolute',left:8,top:'50%',transform:'translateY(-50%)',
                                fontSize:11,fontWeight:700,color:'white',zIndex:1,
                                opacity: r.aprobadas/maxA > 0.12 ? 1 : 0 }}>
                                {fmt(r.aprobadas)}
                              </span>
                            </div>
                            <span style={{ fontSize:11,fontWeight:600,width:44,textAlign:'right',flexShrink:0 }}>{r.pct_del_total}%</span>
                            <span style={{ fontSize:11,opacity:.45,width:48,textAlign:'right',flexShrink:0 }}>{fmtD(r.avg_lead_time)}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </Section>

          {/* ═══ 7. PROYECTOS ═════════════════════════════════════════════ */}
          <Section title="Resultados por proyecto" sub="Unidades y valor" id="proyectos">
            {!proyectos ? <div style={{padding:32}}><Sk h={200}/></div> : (
              <TablaProyectos
                proyectos={proyectos.proyectos || []}
                totalAprobadas={proyectos.total_aprobadas || 0}
              />
            )}
          </Section>

          {/* ═══ 8. DETALLE ═══════════════════════════════════════════════ */}
          <Section title="Legalizaciones individuales" sub="Tabla con trazabilidad" id="detalle">
            {!detalle ? <div style={{padding:32}}><Sk h={300}/></div> : (
              <TablaDetalle
                rows={detalle.rows || []}
                total={detalle.total || 0}
                pagina={pagina}
                loading={loadDet}
                onPage={p => fetchDet(p)}
              />
            )}
          </Section>

        </div>
      </main>

      {/* MODAL META */}
      {showMeta && kpis && (
        <MetaModal
          anio={anio} mes={mes} actual={kpis.meta_negocios}
          onClose={() => setShowMeta(false)}
          onSaved={n => {
            setKpis((prev: any) => prev ? {
              ...prev, meta_negocios: n,
              pct_cumplimiento: n > 0
                ? parseFloat(((prev.aprobadas_exitoso + prev.aprobadas_novedades) / n * 100).toFixed(1)) : 0
            } : prev)
            setShowMeta(false)
          }}
        />
      )}
    </div>
  )
}
