'use client'
import { useEffect, useState } from 'react'
import toast from 'react-hot-toast'
import type { DetalleRow } from '@/types'
import { T, OR, fM } from './brand'
import { Drawer, EmptyState, HubspotLink, DownloadIcon } from './ui'
import { fetchAllRows, exportRechazadosXLSX } from './exports'

export default function RechazadosDrawer({ qs, onClose, onSelectRow }: { qs: string; onClose: () => void; onSelectRow: (r: DetalleRow) => void }) {
  const [rows, setRows] = useState<DetalleRow[]>([])
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState<'rechazados' | 'caidas'>('rechazados')

  useEffect(() => {
    let alive = true
    setLoading(true)
    fetchAllRows(qs, 'todos')
      .then(r => { if (alive) setRows(r.filter(x => x.etapa_codigo === 'negocio_rechazado' || x.etapa_codigo === 'venta_caida')) })
      .catch(() => toast.error('Error cargando rechazados'))
      .finally(() => { if (alive) setLoading(false) })
    return () => { alive = false }
  }, [qs])

  const rech = rows.filter(r => r.etapa_codigo === 'negocio_rechazado')
  const cai = rows.filter(r => r.etapa_codigo === 'venta_caida')
  const visible = tab === 'rechazados' ? rech : cai

  return (
    <Drawer width={560} color={OR} onClose={onClose}>
      <div className="drawer-head">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
          <div>
            <h3 style={{ fontSize: 16, fontWeight: 900 }}>Rechazados y Ventas Caídas</h3>
            <p style={{ fontSize: 11, color: 'rgba(18,81,96,.5)', marginTop: 2 }}>{loading ? 'Cargando…' : `${rech.length} rechazados · ${cai.length} caídas en el período`}</p>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="btn btn-cta" disabled={loading || !rows.length} onClick={() => exportRechazadosXLSX(rows)}><DownloadIcon /> Excel</button>
            <button className="btn btn-icon" onClick={onClose}>✕</button>
          </div>
        </div>
        <div className="tabs">
          <button className={`tab${tab === 'rechazados' ? ' active' : ''}`} onClick={() => setTab('rechazados')}>Rechazados ({rech.length})</button>
          <button className={`tab${tab === 'caidas' ? ' active' : ''}`} onClick={() => setTab('caidas')}>Ventas Caídas ({cai.length})</button>
        </div>
      </div>
      <div className="drawer-body">
        {loading ? Array(4).fill(0).map((_, i) => <div key={i} className="shimmer" style={{ height: 80, marginBottom: 8 }} />)
          : visible.length === 0 ? <EmptyState>No hay registros en esta categoría para el período</EmptyState>
          : visible.map(r => (
            <div key={r.hs_object_id} className="item-card" onClick={() => onSelectRow(r)} style={{ borderLeft: `3px solid ${OR}` }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
                <div style={{ flex: 1 }}>
                  <p style={{ fontWeight: 700, fontSize: 13, marginBottom: 2 }}>{r.nombrecomprador || 'Sin nombre'}</p>
                  <p style={{ fontSize: 11, color: 'rgba(18,81,96,.55)', marginBottom: 4 }}>{r.nombre_legalizacion || `#${r.hs_object_id}`} · {r.proyecto || '—'}</p>
                  {r.motivo_de_observacion && <p style={{ fontSize: 11, color: OR, fontWeight: 600, marginBottom: 2 }}>{r.motivo_de_observacion}</p>}
                  <div style={{ display: 'flex', gap: 12, marginTop: 4, flexWrap: 'wrap' }}>
                    {([['Director', r.director], ['Ciudad', r.ciudad], ['Canal', r.canal_atribucion], ['Doc.', r.documento_comprador_1]] as const).filter(([, v]) => v).map(([l, v]) => (
                      <span key={l} style={{ fontSize: 10, color: 'rgba(18,81,96,.45)' }}><strong>{l}:</strong> {v}</span>
                    ))}
                  </div>
                </div>
                <div style={{ textAlign: 'right', flexShrink: 0 }}>
                  <p style={{ fontSize: 13, fontWeight: 900, color: T, marginBottom: 4 }}>{fM(r.valor_del_inmueble)}</p>
                  <HubspotLink row={r} />
                </div>
              </div>
            </div>
          ))}
      </div>
      <div className="drawer-foot" style={{ display: 'flex', justifyContent: 'space-between' }}>
        <span>{visible.length} registros · clic para ver detalle completo</span>
      </div>
    </Drawer>
  )
}
