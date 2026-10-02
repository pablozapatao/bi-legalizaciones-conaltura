'use client'
import type { DetalleRow } from '@/types'
import { T, AM, STAGE_COLOR, fM, shortName } from './brand'
import { Drawer, EmptyState, HubspotLink, SemaforoDot, StageBadge, DownloadIcon } from './ui'

export default function MotivoDrawer({ motivo, rows, onClose, onSelectRow, onExport }: {
  motivo: string; rows: DetalleRow[]; onClose: () => void; onSelectRow: (r: DetalleRow) => void; onExport: () => void
}) {
  const dirMap: Record<string, number> = {}
  rows.forEach(r => { const d = r.director || 'Sin director'; dirMap[d] = (dirMap[d] || 0) + 1 })
  const dirs = Object.entries(dirMap).sort((a, b) => b[1] - a[1])
  return (
    <Drawer width={580} color={AM} onClose={onClose}>
      <div className="drawer-head">
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10 }}>
          <div style={{ flex: 1 }}>
            <span className="badge badge-active" style={{ marginBottom: 5 }}>Motivo de observación</span>
            <h3 style={{ fontSize: 14, fontWeight: 900, lineHeight: 1.4, wordBreak: 'break-word', margin: '5px 0 4px' }}>&ldquo;{motivo}&rdquo;</h3>
            <p style={{ fontSize: 11, color: 'rgba(18,81,96,.5)' }}>{rows.length} legalizaciones con este motivo en el período</p>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="btn btn-cta" onClick={onExport} disabled={!rows.length}><DownloadIcon /> Excel</button>
            <button className="btn btn-icon" onClick={onClose}>✕</button>
          </div>
        </div>
      </div>
      {dirs.length > 0 && (
        <div style={{ padding: '12px 18px', borderBottom: '1px solid rgba(18,81,96,.08)', background: 'rgba(161,216,26,.06)' }}>
          <p className="eyebrow" style={{ marginBottom: 8 }}>Consolidado por director</p>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {dirs.map(([d, n]) => (
              <div key={d} style={{ background: 'white', borderRadius: 9, padding: '8px 12px', border: '1px solid rgba(18,81,96,.08)' }}>
                <p style={{ fontSize: 10, color: 'rgba(18,81,96,.5)', marginBottom: 2 }}>{shortName(d)}</p>
                <p style={{ fontSize: 18, fontWeight: 900 }}>{n}</p>
              </div>
            ))}
            <div style={{ background: T, borderRadius: 9, padding: '8px 12px' }}>
              <p style={{ fontSize: 10, color: 'rgba(255,255,255,.6)', marginBottom: 2 }}>Total</p>
              <p style={{ fontSize: 18, fontWeight: 900, color: '#DBFF69' }}>{rows.length}</p>
            </div>
          </div>
        </div>
      )}
      <div className="drawer-body">
        {rows.length === 0 ? <EmptyState>No se encontraron legalizaciones con este motivo</EmptyState> : rows.map(r => (
          <div key={r.hs_object_id} className="item-card" onClick={() => onSelectRow(r)} style={{ borderLeft: `3px solid ${STAGE_COLOR[r.etapa_codigo] || T}` }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
              <div style={{ flex: 1 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 3 }}><StageBadge code={r.etapa_codigo} /><SemaforoDot s={r.motivo_semaforo} motivo={r.motivo_de_observacion} /></div>
                <p style={{ fontWeight: 700, fontSize: 13, marginBottom: 2 }}>{r.nombrecomprador || r.nombre_legalizacion || `#${r.hs_object_id}`}</p>
                <p style={{ fontSize: 11, color: 'rgba(18,81,96,.55)' }}>{r.proyecto || '—'} · {r.director || '—'} · {r.ciudad || '—'}</p>
                {r.documento_comprador_1 && <p style={{ fontSize: 10, color: 'rgba(18,81,96,.4)' }}>Doc {r.documento_comprador_1}</p>}
              </div>
              <div style={{ textAlign: 'right', flexShrink: 0 }}>
                <p style={{ fontSize: 13, fontWeight: 900, marginBottom: 4 }}>{fM(r.valor_del_inmueble)}</p>
                <HubspotLink row={r} />
              </div>
            </div>
          </div>
        ))}
      </div>
      <div className="drawer-foot" style={{ textAlign: 'center' }}>Clic en una fila para ver el detalle · Excel exporta el listado completo (46 columnas)</div>
    </Drawer>
  )
}
