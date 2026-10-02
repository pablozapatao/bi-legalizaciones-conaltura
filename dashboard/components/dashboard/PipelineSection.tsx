'use client'
import type { PipelineResponse, DetalleRow } from '@/types'
import { T, B, OR, F, fN, fD, STAGE_COLOR, STAGE_LABEL, PIPELINE_STAGES, ltColor } from './brand'
import { SecHeader, Skeleton, SemaforoDot } from './ui'

const MAX_CARDS = 40

function Funnel({ stages, active, onClick }: { stages: { code: string; count: number; pct: number }[]; active: string | null; onClick: (c: string) => void }) {
  const W = 220, H = 46, GAP = 6, max = Math.max(...stages.map(s => s.count), 1)
  const total = stages.length * (H + GAP)
  // ancho proporcional por etapa (mín. 14%) con trapecio hacia la siguiente
  const widths = stages.map(s => Math.max(s.count / max, 0.14) * W)
  return (
    <svg viewBox={`0 0 ${W} ${total}`} width="100%" style={{ display: 'block' }}>
      {stages.map((s, i) => {
        const y = i * (H + GAP), w = widths[i], nw = i < stages.length - 1 ? widths[i + 1] : w * 0.85
        const x1 = (W - w) / 2, x2 = (W + w) / 2, nx1 = (W - nw) / 2, nx2 = (W + nw) / 2
        const col = STAGE_COLOR[s.code] || T, on = active === s.code
        return (
          <g key={s.code} onClick={() => onClick(s.code)} style={{ cursor: 'pointer' }}>
            <polygon points={`${x1},${y} ${x2},${y} ${nx2},${y + H} ${nx1},${y + H}`} fill={col} opacity={on || !active ? 0.92 : 0.45}
              stroke={on ? '#DBFF69' : 'none'} strokeWidth={on ? 2.5 : 0} />
            <text x={W / 2} y={y + H / 2 - 2} textAnchor="middle" fontSize="15" fontWeight="900" fontFamily={F} fill="#fff">{fN(s.count)}</text>
            <text x={W / 2} y={y + H / 2 + 11} textAnchor="middle" fontSize="8.5" fontWeight="600" fontFamily={F} fill="rgba(255,255,255,.85)">{STAGE_LABEL[s.code]} · {s.pct}%</text>
          </g>
        )
      })}
    </svg>
  )
}

export default function PipelineSection({ pipe, rows, loadingRows, stage, onStage, onSelect }: {
  pipe: PipelineResponse | null; rows: DetalleRow[]; loadingRows: boolean
  stage: string | null; onStage: (s: string) => void; onSelect: (r: DetalleRow) => void
}) {
  const stages = (pipe?.stages || []).filter(s => PIPELINE_STAGES.includes(s.etapa_codigo))
  return (
    <section>
      <SecHeader title="Pipeline activo" sub="Embudo + Kanban · clic en una etapa para filtrar la trazabilidad individual"
        right={stage && <button className="btn btn-alert" onClick={() => onStage(stage)}>✕ Limpiar selección</button>} />
      {!pipe ? <Skeleton h={260} /> : (
        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(240px,300px) minmax(0,1fr)', gap: 14 }}>
          <div className="card" style={{ padding: 18 }}>
            <p className="eyebrow" style={{ marginBottom: 12 }}>Embudo de proceso</p>
            <Funnel stages={stages.map(s => ({ code: s.etapa_codigo, count: s.count, pct: s.pct_del_total }))} active={stage} onClick={onStage} />
            <div style={{ marginTop: 12, padding: '10px 12px', borderRadius: 9, background: B, border: '1px solid rgba(18,81,96,.08)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ fontSize: 11, color: 'rgba(18,81,96,.6)' }}>Total en proceso</span>
                <span style={{ fontSize: 14, fontWeight: 900 }}>{fN(pipe.total_pipeline)}</span>
              </div>
              {pipe.caidas_del_mes > 0 && (
                <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 5, paddingTop: 5, borderTop: '1px solid rgba(18,81,96,.07)' }}>
                  <span style={{ fontSize: 11, color: OR }}>Caídas este mes</span>
                  <span style={{ fontSize: 13, fontWeight: 900 }}>{fN(pipe.caidas_del_mes)}</span>
                </div>
              )}
            </div>
          </div>

          <div style={{ overflowX: 'auto', paddingBottom: 6 }}>
            <div style={{ display: 'flex', gap: 10, minWidth: 4 * 200 }}>
              {stages.map(s => {
                const col = STAGE_COLOR[s.etapa_codigo] || T, on = stage === s.etapa_codigo
                const cards = rows.filter(r => r.etapa_codigo === s.etapa_codigo)
                  .sort((a, b) => (b.aging_dias ?? 0) - (a.aging_dias ?? 0))
                return (
                  <div key={s.etapa_codigo} className="kanban-col" style={{ border: `1.5px solid ${on ? col : 'transparent'}`, cursor: 'pointer' }} onClick={() => onStage(s.etapa_codigo)}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '4px 6px 10px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                        <span style={{ width: 8, height: 8, borderRadius: '50%', background: col }} />
                        <span style={{ fontSize: 10, fontWeight: 700, color: T }}>{STAGE_LABEL[s.etapa_codigo]}</span>
                      </div>
                      <span className="badge" style={{ background: 'white', color: T, border: '1px solid rgba(18,81,96,.1)' }}>{s.count}</span>
                    </div>
                    <div className="kanban-scroll">
                      {loadingRows ? <div className="shimmer" style={{ height: 60 }} />
                        : cards.length === 0 ? <p style={{ fontSize: 10, color: 'rgba(18,81,96,.3)', textAlign: 'center', padding: '12px 0' }}>Sin negocios</p>
                        : cards.slice(0, MAX_CARDS).map(r => (
                          <div key={r.hs_object_id} className="kanban-card" style={{ borderLeft: `2px solid ${col}` }} onClick={e => { e.stopPropagation(); onSelect(r) }}>
                            <p className="ellipsis" style={{ fontWeight: 600, fontSize: 11, marginBottom: 2 }}>{r.nombre_legalizacion || `#${r.hs_object_id}`}</p>
                            <p className="ellipsis" style={{ fontSize: 10, color: 'rgba(18,81,96,.5)', marginBottom: 4 }}>{r.proyecto || '—'}</p>
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                              <SemaforoDot s={r.motivo_semaforo} motivo={r.motivo_de_observacion} />
                              <span style={{ fontSize: 10, fontWeight: 700, color: ltColor(r.aging_dias) }}>{fD(r.aging_dias)}</span>
                            </div>
                          </div>
                        ))}
                      {cards.length > MAX_CARDS && <p style={{ fontSize: 10, color: 'rgba(18,81,96,.4)', textAlign: 'center', padding: 4 }}>+{cards.length - MAX_CARDS} más</p>}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      )}
    </section>
  )
}
