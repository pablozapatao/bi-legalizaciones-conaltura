'use client'
import { CIUDADES } from '@/types'
import { A, OR, DIRECTORES, MES, shortName, nowBogota } from './brand'

export interface FiltersState {
  anio: number; mes: number; semana: number | null
  ciudades: string[]; director: string; proyecto: string
}

const SEMANAS = [
  { n: 1, l: 'Semana 1 (1–7)' }, { n: 2, l: 'Semana 2 (8–14)' }, { n: 3, l: 'Semana 3 (15–21)' },
  { n: 4, l: 'Semana 4 (22–28)' }, { n: 5, l: 'Semana 5 (29–fin)' },
]
const lbl = { fontSize: 9, fontWeight: 700, textTransform: 'uppercase' as const, letterSpacing: '.1em', color: 'rgba(219,255,105,.55)' }

export default function Sidebar({ f, set, proyectos, loading, etl, onRefresh, onClear }: {
  f: FiltersState; set: (p: Partial<FiltersState>) => void; proyectos: string[]
  loading: boolean; etl?: string; onRefresh: () => void; onClear: () => void
}) {
  const hoy = nowBogota()
  const periodos: { y: number; m: number }[] = []
  let y = hoy.y, m = hoy.mo
  for (let i = 0; i < 18; i++) { periodos.push({ y, m }); m--; if (m < 1) { m = 12; y-- } }
  const hayFiltros = f.ciudades.length > 0 || f.director || f.proyecto || f.semana !== null
  const toggleCiudad = (c: string) => set({ ciudades: f.ciudades.includes(c) ? f.ciudades.filter(x => x !== c) : [...f.ciudades, c] })

  return (
    <aside style={{ width: 230, flexShrink: 0, display: 'flex', flexDirection: 'column', background: '#125160', borderRight: '1px solid rgba(255,255,255,.08)', overflowY: 'auto', zIndex: 20 }}>
      <div style={{ padding: '18px 16px 14px', borderBottom: '1px solid rgba(255,255,255,.08)' }}>
        <p style={{ fontSize: 14, fontWeight: 900, color: 'rgba(255,255,255,.95)' }}>conaltura <span style={{ color: A }}>·</span> BI</p>
        <p style={{ ...lbl, marginTop: 1 }}>Legalizaciones</p>
      </div>

      <div style={{ padding: '12px 14px 10px', borderBottom: '1px solid rgba(255,255,255,.06)' }}>
        <p style={{ ...lbl, marginBottom: 7 }}>Período</p>
        <select className="inp" value={`${f.anio}-${f.mes}`} style={{ fontWeight: 700 }}
          onChange={e => { const [a, mo] = e.target.value.split('-').map(Number); set({ anio: a, mes: mo, semana: null }) }}>
          {periodos.map(o => <option key={`${o.y}-${o.m}`} value={`${o.y}-${o.m}`}>{MES[o.m]} {o.y}</option>)}
        </select>
        <p style={{ ...lbl, margin: '10px 0 6px' }}>
          Cohorte semanal
          <span className="tip" data-tip="Filtra las aprobaciones por semana del mes (días 1-7, 8-14, ...). Pipeline y caídas no se filtran." style={{ marginLeft: 5, color: 'rgba(219,255,105,.5)' }}>?</span>
        </p>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
          <button className={`chip${f.semana === null ? ' active' : ''}`} onClick={() => set({ semana: null })}>Todas</button>
          {SEMANAS.map(s => (
            <button key={s.n} title={s.l} className={`chip${f.semana === s.n ? ' active' : ''}`} onClick={() => set({ semana: f.semana === s.n ? null : s.n })}>S{s.n}</button>
          ))}
        </div>
      </div>

      <div style={{ padding: '12px 14px', flex: 1, display: 'flex', flexDirection: 'column', gap: 14 }}>
        <p style={lbl}>Filtros globales</p>
        <div>
          <p style={{ fontSize: 10, color: 'rgba(255,255,255,.55)', marginBottom: 5 }}>Ciudad (múltiple)</p>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
            {CIUDADES.map(c => <button key={c} className={`chip${f.ciudades.includes(c) ? ' active' : ''}`} onClick={() => toggleCiudad(c)}>{c}</button>)}
          </div>
        </div>
        <div>
          <p style={{ fontSize: 10, color: 'rgba(255,255,255,.55)', marginBottom: 5 }}>Director</p>
          <select className="inp" value={f.director} onChange={e => set({ director: e.target.value })} style={{ fontSize: 11 }}>
            <option value="">Todos los directores</option>
            {DIRECTORES.map(x => <option key={x} value={x}>{shortName(x)}</option>)}
          </select>
        </div>
        <div>
          <p style={{ fontSize: 10, color: 'rgba(255,255,255,.55)', marginBottom: 5 }}>Proyecto</p>
          <select className="inp" value={f.proyecto} onChange={e => set({ proyecto: e.target.value })} style={{ fontSize: 11 }}>
            <option value="">Todos los proyectos</option>
            {proyectos.map(x => <option key={x} value={x}>{x}</option>)}
          </select>
        </div>
        {hayFiltros && (
          <button className="btn" onClick={onClear} style={{ justifyContent: 'center', background: 'rgba(255,121,90,.1)', borderColor: 'rgba(255,121,90,.35)', color: OR }}>✕ Limpiar filtros</button>
        )}
        <button className="btn" onClick={onRefresh} style={{ justifyContent: 'center', borderColor: 'rgba(219,255,105,.25)', color: 'rgba(219,255,105,.85)', background: 'rgba(219,255,105,.08)' }}>
          {loading ? 'Cargando…' : '↺ Actualizar datos'}
        </button>
      </div>

      <div style={{ padding: '10px 14px', borderTop: '1px solid rgba(255,255,255,.06)' }}>
        {etl && <p style={{ fontSize: 9, color: 'rgba(255,255,255,.3)', marginBottom: 5 }}>ETL: {etl}</p>}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <div className="live-dot" />
          <span style={{ fontSize: 10, color: 'rgba(219,255,105,.5)' }}>Live · cada 2h</span>
        </div>
      </div>
    </aside>
  )
}
