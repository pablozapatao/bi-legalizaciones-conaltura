'use client'
import type { DetalleResponse, DetalleRow } from '@/types'
import { T, OR, B, fN, fM, fD, STAGE_COLOR, STAGE_LABEL, ltColor, hubspotUrl, type DetTab } from './brand'
import { SecHeader, Skeleton, SemaforoDot, StageBadge, ExternalIcon, DownloadIcon } from './ui'

const TABS: [DetTab, string][] = [['todos', 'Todos'], ['pipeline', 'Pipeline'], ['resolucion', 'Aprobadas'], ['caida', 'Caídas']]
const PER_PAGE = 50

export default function TrazabilidadTable({ det, loading, tab, onTab, stage, onClearStage, page, onPage, onSelect, onExport }: {
  det: DetalleResponse | null; loading: boolean; tab: DetTab; onTab: (t: DetTab) => void
  stage: string | null; onClearStage: () => void; page: number; onPage: (p: number) => void
  onSelect: (r: DetalleRow) => void; onExport: () => void
}) {
  const rows = det?.rows || []
  const pages = Math.max(1, Math.ceil((det?.total || 0) / PER_PAGE))
  return (
    <section>
      <SecHeader title="Trazabilidad individual"
        sub={stage ? `Filtrando por: ${STAGE_LABEL[stage] || stage}` : 'Enlazada al pipeline · clic en una etapa del Kanban o del embudo para filtrar'}
        right={<>
          <div className="tabs">
            {TABS.map(([g, l]) => <button key={g} className={`tab${tab === g ? ' active' : ''}`} onClick={() => onTab(g)}>{l}</button>)}
          </div>
          <button className="btn btn-cta" onClick={onExport} disabled={!det?.total}><DownloadIcon /> Exportar vista ({fN(det?.total || 0)})</button>
        </>} />

      {stage && (
        <div style={{ padding: '8px 14px', marginBottom: 10, borderRadius: 9, background: `${STAGE_COLOR[stage] || T}12`, border: `1px solid ${STAGE_COLOR[stage] || T}30`, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span style={{ fontSize: 12, fontWeight: 700 }}>Vista filtrada: {STAGE_LABEL[stage] || stage} · {fN(det?.total || 0)} registros</span>
          <button className="btn btn-alert" onClick={onClearStage}>✕ Ver todos</button>
        </div>
      )}

      <div className="table-wrap">
        <div style={{ overflowX: 'auto', maxHeight: 360, overflowY: 'auto' }}>
          {!det ? <div style={{ padding: 14 }}><Skeleton h={200} /></div> : (
            <table className="bi-table" style={{ minWidth: 1000 }}>
              <thead>
                <tr>
                  <th style={{ width: 24 }} />
                  <th style={{ textAlign: 'left' }}>Nombre / ID</th>
                  <th style={{ textAlign: 'left' }}>Proyecto</th>
                  <th style={{ textAlign: 'left' }}>Comprador</th>
                  <th style={{ textAlign: 'left' }}>Motivo</th>
                  <th style={{ textAlign: 'left' }}>Stage</th>
                  <th style={{ textAlign: 'left' }}>Canal Sec.</th>
                  <th style={{ textAlign: 'right' }}>Valor</th>
                  <th style={{ textAlign: 'right' }}>Lead time</th>
                  <th style={{ textAlign: 'center' }}>HubSpot</th>
                </tr>
              </thead>
              <tbody>
                {loading ? Array(5).fill(0).map((_, i) => (
                  <tr key={i}>{Array(10).fill(0).map((__, j) => <td key={j}><div className="shimmer" style={{ height: 10, borderRadius: 4 }} /></td>)}</tr>
                )) : rows.length === 0 ? (
                  <tr><td colSpan={10} style={{ textAlign: 'center', padding: 28, color: 'rgba(18,81,96,.35)' }}>Sin registros para esta vista</td></tr>
                ) : rows.map(r => (
                  <tr key={r.hs_object_id} className="row-click" onClick={() => onSelect(r)}>
                    <td style={{ textAlign: 'center', paddingRight: 4 }}><span style={{ display: 'block', width: 8, height: 8, borderRadius: '50%', background: STAGE_COLOR[r.etapa_codigo] || T, margin: '0 auto' }} /></td>
                    <td>
                      <p className="ellipsis" style={{ fontWeight: 700, fontSize: 12, maxWidth: 190 }}>{r.nombre_legalizacion || `#${r.hs_object_id}`}</p>
                      <p style={{ fontSize: 9, color: 'rgba(18,81,96,.4)' }}>ID {r.hs_object_id}</p>
                    </td>
                    <td className="ellipsis" style={{ fontSize: 11, color: 'rgba(18,81,96,.6)', maxWidth: 130 }}>{r.proyecto || '—'}</td>
                    <td style={{ fontSize: 11, color: 'rgba(18,81,96,.6)' }}>{r.nombrecomprador || '—'}</td>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, maxWidth: 190 }}>
                        <SemaforoDot s={r.motivo_semaforo} motivo={r.motivo_de_observacion} />
                        <span className="ellipsis" style={{ fontSize: 10, color: 'rgba(18,81,96,.6)' }}>{r.motivo_de_observacion || ''}</span>
                      </div>
                    </td>
                    <td><StageBadge code={r.etapa_codigo} /></td>
                    <td style={{ fontSize: 11, color: 'rgba(18,81,96,.55)' }}>{r.canal_gestion_secundario || '—'}</td>
                    <td style={{ textAlign: 'right', fontSize: 11, fontWeight: 700 }}>{fM(r.valor_del_inmueble)}</td>
                    <td style={{ textAlign: 'right', fontSize: 12, fontWeight: 700, color: ltColor(r.dias_lead_time) }}>{fD(r.dias_lead_time)}</td>
                    <td style={{ textAlign: 'center' }}>
                      <a href={hubspotUrl(r)} target="_blank" rel="noopener noreferrer" onClick={e => e.stopPropagation()} title="Abrir en HubSpot"
                        className="badge badge-active" style={{ textDecoration: 'none', gap: 3 }}>↗<ExternalIcon size={9} /></a>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
        {(det?.total || 0) > PER_PAGE && (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 14px', borderTop: '1px solid rgba(18,81,96,.07)', background: 'white' }}>
            <button className="btn btn-ghost" onClick={() => onPage(page - 1)} disabled={page <= 1}>← Anterior</button>
            <span style={{ fontSize: 11, color: 'rgba(18,81,96,.45)' }}>Pág. {page} de {pages} · {fN(det?.total)} registros</span>
            <button className="btn btn-ghost" onClick={() => onPage(page + 1)} disabled={page >= pages} style={{ background: B }}>Siguiente →</button>
          </div>
        )}
      </div>
      <p style={{ fontSize: 10, color: 'rgba(18,81,96,.35)', marginTop: 6, textAlign: 'center' }}>Clic en una fila para ver el detalle completo · el punto de color indica el stage</p>
    </section>
  )
}
