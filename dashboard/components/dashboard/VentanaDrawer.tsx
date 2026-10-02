'use client'
import { useState } from 'react'
import type { VentanaResponse, VentanaCliente } from '@/types'
import { T, AM, PU, fN, fM, dtF, MESF, STAGE_COLOR, shortName } from './brand'
import { Drawer, EmptyState, HubspotLink, StageBadge, DownloadIcon } from './ui'
import { exportVentanaXLSX, exportFileName } from './exports'

export default function VentanaDrawer({ data, loading, anio, mes, onClose, onSelectClient }: {
  data: VentanaResponse | null; loading: boolean; anio: number; mes: number
  onClose: () => void; onSelectClient: (c: VentanaCliente) => void
}) {
  const [vista, setVista] = useState<'proyectos' | 'clientes'>('proyectos')
  const [pf, setPf] = useState('')
  const porProy = data?.por_proyecto || []
  const clientes = data?.clientes || []
  const total = data?.total || 0
  const maxP = Math.max(...porProy.map(p => p.total), 1)
  const visibles = pf ? clientes.filter(c => c.proyecto === pf) : clientes
  const xlsAll = () => exportVentanaXLSX(clientes, `Conaltura_VentanaCierre_${anio}_${String(mes).padStart(2, '0')}.xlsx`)
  const xlsProy = (p: string) => exportVentanaXLSX(clientes.filter(c => c.proyecto === p), exportFileName.ventanaProyecto(p))
  const cols = [T, '#1a6b7a', '#1a7d6e', '#279752', AM, '#4d7c0f']

  return (
    <Drawer width={680} color={AM} onClose={onClose}>
      <div className="drawer-head" style={{ padding: '18px 22px 14px' }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
          <div style={{ flex: 1 }}>
            <span className="badge badge-active">Ventana de cierre · Día 25+</span>
            <h3 style={{ fontSize: 16, fontWeight: 900, margin: '6px 0 3px' }}>Aprobaciones en ventana de cierre</h3>
            <p style={{ fontSize: 11, color: 'rgba(18,81,96,.5)' }}>{MESF[mes]} {anio} · {loading ? 'Cargando…' : `${total} clientes en ${porProy.length} proyectos`}</p>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="btn btn-cta" onClick={xlsAll} disabled={loading || !total}><DownloadIcon /> Descargar todo</button>
            <button className="btn btn-icon" onClick={onClose}>✕</button>
          </div>
        </div>
        <div className="tabs" style={{ marginTop: 12 }}>
          <button className={`tab${vista === 'proyectos' ? ' active' : ''}`} onClick={() => { setVista('proyectos'); setPf('') }}>Por proyecto ({porProy.length})</button>
          <button className={`tab${vista === 'clientes' ? ' active' : ''}`} onClick={() => { setVista('clientes'); setPf('') }}>Clientes individuales ({total})</button>
        </div>
      </div>

      <div className="drawer-body" style={{ padding: '14px 18px' }}>
        {loading ? Array(5).fill(0).map((_, i) => <div key={i} className="shimmer" style={{ height: 64, marginBottom: 8 }} />)
        : vista === 'proyectos' ? (
          porProy.length === 0 ? <EmptyState>Sin aprobaciones en ventana de cierre para este período</EmptyState> : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {porProy.map((p, i) => {
                const col = cols[i % cols.length]
                return (
                  <div key={p.proyecto} className="card" style={{ borderLeft: `3px solid ${col}`, padding: '12px 16px', display: 'flex', alignItems: 'center', gap: 10 }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <p style={{ fontSize: 13, fontWeight: 900 }}>{p.proyecto}</p>
                        <span style={{ fontSize: 10, color: 'rgba(18,81,96,.45)' }}>{p.ciudad} · {shortName(p.director)}</span>
                      </div>
                      <div className="progress-track lg" style={{ marginTop: 6 }}><div className="progress-fill" style={{ width: `${Math.max(p.total / maxP * 100, 6)}%`, background: col }} /></div>
                      <div style={{ display: 'flex', gap: 8, marginTop: 6, flexWrap: 'wrap', alignItems: 'center' }}>
                        {p.exitosas > 0 && <span className="badge" style={{ background: 'rgba(161,216,26,.18)', color: '#166534' }}>{p.exitosas} Sin novedad</span>}
                        {p.con_novedades > 0 && <span className="badge" style={{ background: 'rgba(245,194,66,.22)', color: '#92400E' }}>{p.con_novedades} Con novedad</span>}
                        {p.gerencia > 0 && <span className="badge" style={{ background: 'rgba(179,130,255,.15)', color: '#7c3aed' }}>{p.gerencia} Gerencia</span>}
                        {!!p.dia_promedio && <span style={{ fontSize: 10, color: 'rgba(18,81,96,.45)' }}>Día prom. {p.dia_promedio}</span>}
                        {!!p.valor_total && <span style={{ fontSize: 10, color: 'rgba(18,81,96,.45)' }}>{fM(p.valor_total)}</span>}
                      </div>
                    </div>
                    <div style={{ textAlign: 'right', flexShrink: 0 }}>
                      <p className="kpi-value" style={{ marginBottom: 6 }}>{fN(p.total)}</p>
                      <div style={{ display: 'flex', gap: 6 }}>
                        <button className="btn" style={{ fontSize: 10, padding: '3px 10px' }} onClick={() => { setVista('clientes'); setPf(p.proyecto) }}>Ver clientes</button>
                        <button className="btn btn-cta" style={{ fontSize: 10, padding: '3px 10px' }} onClick={() => xlsProy(p.proyecto)}>↓ xlsx</button>
                      </div>
                    </div>
                  </div>
                )
              })}
              <div style={{ background: T, borderRadius: 10, padding: '12px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: 12, color: 'rgba(255,255,255,.7)', fontWeight: 600 }}>Total en ventana de cierre</span>
                <div style={{ display: 'flex', gap: 20, alignItems: 'center' }}>
                  {([[porProy.reduce((s, p) => s + p.exitosas, 0), 'Sin novedad', AM], [porProy.reduce((s, p) => s + p.con_novedades, 0), 'Con novedad', '#F5C242'], [porProy.reduce((s, p) => s + p.gerencia, 0), 'Gerencia', PU]] as const).filter(([v]) => v > 0).map(([v, l, c]) => (
                    <div key={l} style={{ textAlign: 'center' }}><p style={{ fontSize: 18, fontWeight: 900, color: c, lineHeight: 1 }}>{fN(v)}</p><p style={{ fontSize: 9, color: 'rgba(255,255,255,.5)' }}>{l}</p></div>
                  ))}
                  <div style={{ textAlign: 'center', borderLeft: '1px solid rgba(255,255,255,.15)', paddingLeft: 20 }}><p style={{ fontSize: 24, fontWeight: 900, color: '#DBFF69', lineHeight: 1 }}>{fN(total)}</p><p style={{ fontSize: 9, color: 'rgba(255,255,255,.5)' }}>Total</p></div>
                </div>
              </div>
            </div>
          )
        ) : (
          <div>
            {porProy.length > 1 && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
                <select className="inp-light" value={pf} onChange={e => setPf(e.target.value)} style={{ flex: 1, maxWidth: 320 }}>
                  <option value="">Todos los proyectos ({total})</option>
                  {porProy.map(p => <option key={p.proyecto} value={p.proyecto}>{p.proyecto} ({p.total})</option>)}
                </select>
                {pf && <button className="btn btn-cta" onClick={() => xlsProy(pf)}>↓ Excel este proyecto</button>}
                <span style={{ fontSize: 11, color: 'rgba(18,81,96,.45)' }}>{visibles.length} clientes</span>
              </div>
            )}
            {visibles.length === 0 ? <EmptyState>Sin clientes en ventana de cierre</EmptyState> : visibles.map(c => (
              <div key={c.hs_object_id} className="item-card" onClick={() => onSelectClient(c)} style={{ borderLeft: `3px solid ${STAGE_COLOR[c.etapa_codigo] || T}`, display: 'grid', gridTemplateColumns: '1fr 1fr auto', gap: '8px 16px', alignItems: 'center', padding: '10px 14px', marginBottom: 7 }}>
                <div>
                  <p style={{ fontWeight: 700, fontSize: 12, marginBottom: 2 }}>{c.nombrecomprador || 'Sin nombre'}</p>
                  <p style={{ fontSize: 10, color: 'rgba(18,81,96,.5)' }}>{c.documento_comprador_1 && `Doc ${c.documento_comprador_1} · `}{c.proyecto}</p>
                </div>
                <div>
                  <StageBadge code={c.etapa_codigo} />
                  <p style={{ fontSize: 10, color: 'rgba(18,81,96,.5)', marginTop: 3 }}>Día {c.dia_aprobacion} · {dtF(c.fecha_aprobacion_final)}{c.canal_atribucion && ` · ${c.canal_atribucion}`}</p>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <p style={{ fontSize: 13, fontWeight: 900, marginBottom: 4 }}>{fM(c.valor_del_inmueble)}</p>
                  <HubspotLink row={c} compact />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
      <div className="drawer-foot" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span>Clic en un cliente para ver el detalle completo</span>
        <button className="btn btn-cta" onClick={xlsAll} disabled={loading || !total}>↓ Descargar {total} clientes (.xlsx)</button>
      </div>
    </Drawer>
  )
}
