'use client'
import { useState, useMemo } from 'react'
import toast from 'react-hot-toast'
import type { ProyectosResponse, ProyectoResumen } from '@/types'
import { T, OR, PU, fN, fM, fD } from './brand'
import { SecHeader, Skeleton, DownloadIcon } from './ui'
import { exportXLSX, exportClientesXLSX, fetchAllRows } from './exports'

type SortKey = keyof ProyectoResumen

export default function ProyectosTable({ data, qs, onRechazados }: { data: ProyectosResponse | null; qs: string; onRechazados: () => void }) {
  const [search, setSearch] = useState('')
  const [sortK, setSortK] = useState<SortKey>('proyecto')
  const [sortD, setSortD] = useState<'asc' | 'desc'>('asc')

  const rows = useMemo(() => {
    if (!data) return []
    const q = search.toLowerCase()
    const r = data.proyectos.filter(x => !q || x.proyecto?.toLowerCase().includes(q) || x.director?.toLowerCase().includes(q))
    return r.sort((a, b) => {
      const av = a[sortK], bv = b[sortK]
      const c = typeof av === 'string' ? av.localeCompare(String(bv)) : (Number(av) || 0) - (Number(bv) || 0)
      return sortD === 'asc' ? c : -c
    })
  }, [data, search, sortK, sortD])

  const srt = (k: SortKey) => { if (sortK === k) setSortD(x => x === 'asc' ? 'desc' : 'asc'); else { setSortK(k); setSortD('desc') } }
  const arr = (k: SortKey) => sortK === k ? (sortD === 'asc' ? ' ↑' : ' ↓') : ''
  const th = (k: SortKey, label: string, right = true) => (
    <th className={sortK === k ? 'sorted' : ''} onClick={() => srt(k)} style={{ textAlign: right ? 'right' : 'left' }}>{label}{arr(k)}</th>
  )

  async function descargarClientes() {
    const tid = toast.loading('Preparando descarga…')
    try {
      const todos = await fetchAllRows(qs, 'resolucion')
      toast.dismiss(tid)
      await exportClientesXLSX(todos)
    } catch { toast.dismiss(tid); toast.error('Error al descargar') }
  }

  const pill = (v: number | undefined, bg: string, col: string) => (v || 0) > 0
    ? <span className="badge" style={{ background: bg, color: col, borderRadius: 5 }}>{fN(v)}</span>
    : <span style={{ color: 'rgba(18,81,96,.2)', fontSize: 11 }}>—</span>

  return (
    <section>
      <SecHeader title="Flujo de proyectos" sub="Unidades · valor · lead time · sorteable por columna" right={<>
        <input className="inp-light" value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar proyecto o director…" style={{ width: 190 }} />
        <button className="btn btn-alert" onClick={onRechazados}>Rechazados</button>
        <button className="btn btn-cta" disabled={!rows.length} onClick={() => exportXLSX(rows)} title="Resumen por proyecto (.xlsx)"><DownloadIcon /> Proyectos</button>
        <button className="btn btn-cta" onClick={descargarClientes} title="Todos los clientes con información completa (.xlsx)"><DownloadIcon /> Clientes</button>
      </>} />
      <div className="table-wrap">
        <div style={{ overflowX: 'auto', maxHeight: 380, overflowY: 'auto' }}>
          {!data ? <div style={{ padding: 14 }}><Skeleton h={200} /></div> : (
            <table className="bi-table" style={{ minWidth: 1060 }}>
              <thead>
                <tr>
                  <th colSpan={3} style={{ textAlign: 'left' }}>Identificación</th>
                  <th colSpan={5} style={{ textAlign: 'center', color: 'rgba(219,255,105,.7)' }}>Aprobadas</th>
                  <th colSpan={2} style={{ textAlign: 'center' }}>Proceso</th>
                  <th colSpan={2} style={{ textAlign: 'center', color: 'rgba(255,121,90,.9)' }}>Alertas</th>
                  <th colSpan={2} style={{ textAlign: 'center' }}>Valor · Tiempo</th>
                </tr>
                <tr>
                  {th('proyecto', 'Proyecto', false)}
                  {th('director', 'Director', false)}
                  <th>Ciudad</th>
                  {th('aprobadas', 'Total')}
                  <th style={{ textAlign: 'right' }}>Sin novedad</th>
                  <th style={{ textAlign: 'right' }}>Con novedad</th>
                  <th style={{ textAlign: 'right', color: PU }}>Gerencia</th>
                  <th style={{ textAlign: 'right' }}>% total</th>
                  {th('pipeline_activo', 'Pipeline')}
                  <th />
                  {th('rechazadas', 'Rechaz.')}
                  {th('ventas_caidas', 'Caídas')}
                  {th('suma_valor_inmueble', 'Valor')}
                  {th('avg_lead_time', 'Lead')}
                </tr>
              </thead>
              <tbody>
                {rows.map((r, i) => {
                  const p = data.total_aprobadas > 0 ? (r.aprobadas / data.total_aprobadas * 100) : 0
                  return (
                    <tr key={r.proyecto || i}>
                      <td className="ellipsis" style={{ fontWeight: 700, maxWidth: 170 }}>{r.proyecto || '—'}</td>
                      <td style={{ fontSize: 11, color: 'rgba(18,81,96,.6)' }}>{r.director || '—'}</td>
                      <td style={{ fontSize: 11, color: 'rgba(18,81,96,.6)' }}>{r.ciudad || '—'}</td>
                      <td style={{ textAlign: 'right' }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 6 }}>
                          <div className="progress-track" style={{ width: 28 }}><div className="progress-fill" style={{ width: `${Math.min(p, 100)}%`, background: T }} /></div>
                          <span style={{ fontWeight: 700, fontSize: 13 }}>{fN(r.aprobadas)}</span>
                        </div>
                      </td>
                      <td style={{ textAlign: 'right' }}>{pill(r.exitosas, 'rgba(161,216,26,.18)', '#166534')}</td>
                      <td style={{ textAlign: 'right' }}>{pill(r.con_novedades, 'rgba(245,194,66,.2)', '#92400E')}</td>
                      <td style={{ textAlign: 'right' }}>{pill(r.aprobado_gerencia, 'rgba(179,130,255,.15)', '#7c3aed')}</td>
                      <td style={{ textAlign: 'right', fontSize: 11, color: 'rgba(18,81,96,.5)' }}>{p.toFixed(1)}%</td>
                      <td style={{ textAlign: 'right', fontSize: 12 }}>{fN(r.pipeline_activo)}</td>
                      <td />
                      <td style={{ textAlign: 'right' }}>{pill(r.rechazadas, 'rgba(255,121,90,.12)', OR)}</td>
                      <td style={{ textAlign: 'right' }}>{pill(r.ventas_caidas, 'rgba(255,121,90,.12)', '#B5472F')}</td>
                      <td style={{ textAlign: 'right', fontWeight: 700, fontSize: 12 }}>{fM(r.suma_valor_inmueble)}</td>
                      <td style={{ textAlign: 'right', fontSize: 11, color: 'rgba(18,81,96,.55)' }}>{fD(r.avg_lead_time)}</td>
                    </tr>
                  )
                })}
              </tbody>
              <tfoot>
                <tr>
                  <td colSpan={3} style={{ fontWeight: 900, letterSpacing: '.04em' }}>TOTAL — {rows.length} proyectos</td>
                  <td style={{ textAlign: 'right', color: 'rgba(219,255,105,.9)', fontSize: 14, fontWeight: 900 }}>{fN(data.total_aprobadas)}</td>
                  <td colSpan={10} />
                </tr>
              </tfoot>
            </table>
          )}
        </div>
      </div>
    </section>
  )
}
