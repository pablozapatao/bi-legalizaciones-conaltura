'use client'
import { T, AM, OR, PU, fN, shortName } from './brand'
import { SecHeader } from './ui'

export interface MotivoAgg { motivo: string; total: number; dirs: Record<string, number> }
export interface DirAgg { director: string; total: number }

const COLS = [T, '#1a6b7a', '#1a7d6e', AM, '#279752', OR, PU, '#92400E']

export default function MotivosSection({ motivos, directores, loading, selected, onSelect }: {
  motivos: MotivoAgg[]; directores: DirAgg[]; loading: boolean; selected: string | null; onSelect: (m: string) => void
}) {
  const maxT = motivos[0]?.total || 1, maxD = directores[0]?.total || 1
  return (
    <section>
      <SecHeader title="Motivos de observación" sub="¿Por qué se generan observaciones? · top 8 motivos y ranking por director" />
      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) 340px', gap: 14 }}>
        <div className="card" style={{ padding: 18 }}>
          <p className="eyebrow" style={{ marginBottom: 4 }}>Top motivos — frecuencia</p>
          <p style={{ fontSize: 10, color: 'rgba(18,81,96,.4)', marginBottom: 12 }}>Clic en un motivo para ver las legalizaciones afectadas</p>
          {loading ? <div className="shimmer" style={{ height: 180 }} />
            : motivos.length === 0 ? <p style={{ textAlign: 'center', padding: '60px 0', color: 'rgba(18,81,96,.35)', fontSize: 13 }}>Sin observaciones en el período seleccionado</p>
            : <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {motivos.map((m, i) => {
                const col = COLS[i % COLS.length], on = selected === m.motivo
                return (
                  <div key={m.motivo} onClick={() => onSelect(m.motivo)} style={{ cursor: 'pointer', padding: '8px 10px', borderRadius: 9, border: `1.5px solid ${on ? col : 'transparent'}`, background: on ? `${col}12` : 'transparent', transition: 'all .15s' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 5 }}>
                      <span style={{ fontSize: 11, fontWeight: on ? 700 : 600, flex: 1, paddingRight: 8, lineHeight: 1.3 }}>{m.motivo}</span>
                      <span style={{ fontSize: 13, fontWeight: 900 }}>{m.total}<span style={{ fontSize: 9, color: 'rgba(18,81,96,.4)', marginLeft: 6 }}>→</span></span>
                    </div>
                    <div className="progress-track lg"><div className="progress-fill" style={{ width: `${Math.max(m.total / maxT * 100, 4)}%`, background: col }} /></div>
                  </div>
                )
              })}
            </div>}
        </div>

        <div className="card" style={{ padding: 18 }}>
          <p className="eyebrow" style={{ marginBottom: 14 }}>Ranking por director</p>
          {loading ? <div className="shimmer" style={{ height: 180 }} />
            : directores.length === 0 ? <p style={{ fontSize: 12, color: 'rgba(18,81,96,.35)', textAlign: 'center', paddingTop: 16 }}>Sin datos</p>
            : <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {directores.map((d, i) => (
                <div key={d.director}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                    <span style={{ fontSize: 11, fontWeight: 600 }}>{i + 1}. {shortName(d.director)}</span>
                    <span style={{ fontSize: 13, fontWeight: 900 }}>{fN(d.total)}</span>
                  </div>
                  <div className="progress-track lg"><div className="progress-fill" style={{ width: `${Math.max(d.total / maxD * 100, 6)}%`, background: i === 0 ? OR : T }} /></div>
                </div>
              ))}
              <p style={{ fontSize: 10, color: 'rgba(18,81,96,.35)', marginTop: 6, paddingTop: 8, borderTop: '1px solid rgba(18,81,96,.07)', lineHeight: 1.5 }}>
                Registros con motivo de observación en el período, todos los motivos.
              </p>
            </div>}
        </div>
      </div>
    </section>
  )
}
