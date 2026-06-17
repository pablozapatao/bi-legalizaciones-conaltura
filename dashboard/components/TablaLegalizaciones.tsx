'use client'
import { useState } from 'react'
import type { DetalleResponse, DetalleRow, TimelineResponse } from '@/types'
import { STAGE_LABELS, MES_NAMES, fmtNum, fmtDias } from '@/types'

// ── Badge de stage ──────────────────────────────────────────────────────
function StageBadge({ codigo }: { codigo: string }) {
  const style =
    codigo === 'aprobado_exitoso'   ? 'badge badge-exitoso' :
    codigo === 'aprobado_novedades' ? 'badge badge-novedades' :
    codigo === 'negocio_rechazado'  ? 'badge badge-rechazado' :
    codigo === 'venta_caida'        ? 'badge badge-caida' :
    'badge badge-pipeline'

  return <span className={style}>{STAGE_LABELS[codigo] ?? codigo}</span>
}

// ── Modal de timeline ────────────────────────────────────────────────────
function TimelineModal({
  data,
  onClose,
}: {
  data: TimelineResponse
  onClose: () => void
}) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(18,81,96,0.35)', backdropFilter: 'blur(4px)' }}
      onClick={e => e.target === e.currentTarget && onClose()}
    >
      <div className="card w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <div className="p-6">
          {/* Header */}
          <div className="flex items-start justify-between mb-5">
            <div>
              <p className="text-xs opacity-40 mb-0.5">Trazabilidad de legalización</p>
              <h3 className="font-display text-lg font-bold" style={{ color: 'var(--primary)' }}>
                {data.nombre_legalizacion || `ID ${data.hs_object_id}`}
              </h3>
              <p className="text-xs opacity-60 mt-0.5">
                {data.proyecto} · {data.director}
              </p>
            </div>
            <button
              onClick={onClose}
              className="w-8 h-8 flex items-center justify-center rounded-full opacity-40 hover:opacity-70 transition-opacity"
              style={{ background: 'var(--beige-dk)' }}
            >
              ✕
            </button>
          </div>

          {/* Stats rápidos */}
          <div className="grid grid-cols-3 gap-3 mb-6">
            <div className="card-beige px-4 py-3">
              <p className="text-xs opacity-40 mb-0.5">Lead time total</p>
              <p className="font-display text-xl font-bold">
                {fmtDias(data.dias_consignacion_a_aprobacion)}
              </p>
            </div>
            <div className="card-beige px-4 py-3">
              <p className="text-xs opacity-40 mb-0.5">Etapa actual</p>
              <p className="text-xs font-semibold mt-1">
                <StageBadge codigo={data.etapa_actual} />
              </p>
            </div>
            <div className="card-beige px-4 py-3">
              <p className="text-xs opacity-40 mb-0.5">Valor inmueble</p>
              <p className="font-display text-sm font-bold">
                {data.valor_del_inmueble != null
                  ? `$${fmtNum(data.valor_del_inmueble)}`
                  : '—'}
              </p>
            </div>
          </div>

          {/* Timeline horizontal */}
          <div className="mb-6">
            <p className="text-xs font-semibold uppercase tracking-wide opacity-40 mb-4">
              Recorrido por etapas
            </p>
            <div className="relative">
              {/* Línea conectora */}
              <div className="absolute top-4 left-4 right-4 h-0.5"
                   style={{ background: 'var(--beige-dk)' }} />

              <div className="flex gap-0 overflow-x-auto pb-2">
                {data.hitos.map((hito, i) => {
                  const isActual = hito.es_actual
                  const tieneData = hito.fecha_entrada != null
                  return (
                    <div key={hito.etapa_codigo}
                         className="flex flex-col items-center flex-1 min-w-[80px] relative">
                      {/* Nodo */}
                      <div
                        className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold z-10 mb-2"
                        style={{
                          background: isActual ? 'var(--primary)' : tieneData ? 'var(--accent)' : 'var(--beige-dk)',
                          color: isActual ? 'white' : tieneData ? 'var(--primary)' : 'rgba(18,81,96,0.3)',
                          border: isActual ? '3px solid var(--accent)' : 'none',
                        }}
                      >
                        {i + 1}
                      </div>
                      {/* Etiqueta */}
                      <p className="text-center text-xs font-semibold leading-tight px-1"
                         style={{ color: tieneData ? 'var(--primary)' : 'rgba(18,81,96,0.3)' }}>
                        {hito.etapa_label}
                      </p>
                      {/* Fecha */}
                      {hito.fecha_entrada && (
                        <p className="text-center text-xs opacity-40 mt-0.5">
                          {new Date(hito.fecha_entrada).toLocaleDateString('es-CO', {
                            day: 'numeric', month: 'short',
                          })}
                        </p>
                      )}
                      {/* Duración */}
                      {hito.dias_en_stage != null && (
                        <p className="text-center text-xs font-semibold mt-1"
                           style={{ color: hito.dias_en_stage > 30 ? 'var(--coral)' : 'var(--success)' }}>
                          {fmtDias(hito.dias_en_stage)}
                        </p>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>
          </div>

          {/* Info adicional */}
          {data.canal_atribucion && (
            <div className="grid grid-cols-2 gap-3 mb-5 text-xs">
              <div>
                <span className="opacity-40">Canal de atribución: </span>
                <span className="font-semibold">{data.canal_atribucion}</span>
              </div>
              <div>
                <span className="opacity-40">Comprador: </span>
                <span className="font-semibold">{data.nombrecomprador || '—'}</span>
              </div>
            </div>
          )}

          {/* Botón HubSpot */}
          <a
            href={data.hubspot_url}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-center gap-2 w-full py-2.5 rounded-lg font-semibold text-sm transition-opacity hover:opacity-90"
            style={{ background: 'var(--primary)', color: '#F4F0E5' }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
              <path d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6M15 3h6v6M10 14L21 3"
                    stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
            Ver en HubSpot
          </a>
        </div>
      </div>
    </div>
  )
}

// ── Tabla principal ──────────────────────────────────────────────────────
export default function TablaLegalizaciones({
  data,
  onPageChange,
  loading = false,
}: {
  data: DetalleResponse
  onPageChange: (p: number) => void
  loading?: boolean
}) {
  const [timeline, setTimeline] = useState<TimelineResponse | null>(null)
  const [loadingId, setLoadingId] = useState<number | null>(null)

  async function abrirTimeline(row: DetalleRow) {
    setLoadingId(row.hs_object_id)
    try {
      const res = await fetch(`/api/timeline?id=${row.hs_object_id}`)
      const data: TimelineResponse = await res.json()
      setTimeline(data)
    } catch {
      // silent
    } finally {
      setLoadingId(null)
    }
  }

  const totalPaginas = Math.ceil(data.total / data.por_pagina)

  return (
    <>
      {timeline && (
        <TimelineModal data={timeline} onClose={() => setTimeline(null)} />
      )}

      <section>
        <div className="flex items-center justify-between mb-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-widest opacity-40">Detalle</p>
            <h2 className="font-display text-xl font-bold" style={{ color: 'var(--primary)' }}>
              {fmtNum(data.total)} legalizaciones
            </h2>
          </div>
          <p className="text-xs opacity-40">
            Página {data.pagina} de {totalPaginas}
          </p>
        </div>

        <div className="card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="tabla-base">
              <thead>
                <tr>
                  <th>Proyecto</th>
                  <th>Comprador</th>
                  <th>Stage</th>
                  <th className="text-right">Lead time</th>
                  <th className="text-right">Valor</th>
                  <th>Fecha aprobación</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {loading
                  ? Array(8).fill(0).map((_, i) => (
                      <tr key={i}>
                        {Array(7).fill(0).map((_, j) => (
                          <td key={j}><div className="shimmer h-4 rounded" /></td>
                        ))}
                      </tr>
                    ))
                  : data.rows.map(row => (
                      <tr key={row.hs_object_id}>
                        <td>
                          <p className="font-semibold text-xs">{row.proyecto}</p>
                          <p className="text-xs opacity-40">{row.director}</p>
                        </td>
                        <td className="text-xs">{row.nombrecomprador || '—'}</td>
                        <td>
                          <StageBadge codigo={row.etapa_codigo} />
                          {row.en_ventana_cierre && (
                            <span className="ml-1 badge text-xs"
                                  style={{ background: 'rgba(161,216,26,0.2)', color: '#4d7c0f' }}>
                              ventana
                            </span>
                          )}
                        </td>
                        <td className="text-right text-xs font-semibold">
                          {row.dias_lead_time != null ? (
                            <span style={{
                              color: row.dias_lead_time > 30 ? 'var(--coral)'
                                   : row.dias_lead_time > 15 ? 'var(--warning)'
                                   : 'var(--success)',
                            }}>
                              {fmtDias(row.dias_lead_time)}
                            </span>
                          ) : (
                            <span className="opacity-30">—</span>
                          )}
                        </td>
                        <td className="text-right text-xs">
                          {row.valor_del_inmueble
                            ? `$${fmtNum(row.valor_del_inmueble)}`
                            : <span className="opacity-30">—</span>}
                        </td>
                        <td className="text-xs opacity-60">
                          {row.fecha_aprobacion_final
                            ? new Date(row.fecha_aprobacion_final).toLocaleDateString('es-CO', {
                                day: 'numeric', month: 'short', year: '2-digit',
                              })
                            : <span className="opacity-30">En proceso</span>}
                        </td>
                        <td>
                          <div className="flex items-center gap-1">
                            {/* Botón timeline */}
                            <button
                              onClick={() => abrirTimeline(row)}
                              disabled={loadingId === row.hs_object_id}
                              className="w-7 h-7 rounded-lg flex items-center justify-center transition-colors hover:opacity-80"
                              style={{ background: 'var(--beige-dk)' }}
                              title="Ver timeline"
                            >
                              {loadingId === row.hs_object_id
                                ? <span className="text-xs animate-spin">⟳</span>
                                : <span className="text-xs">⟲</span>}
                            </button>
                            {/* Botón HubSpot */}
                            <a
                              href={row.hubspot_url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="w-7 h-7 rounded-lg flex items-center justify-center transition-opacity hover:opacity-70"
                              style={{ background: 'var(--primary)' }}
                              title="Abrir en HubSpot"
                            >
                              <svg width="12" height="12" viewBox="0 0 24 24" fill="none">
                                <path d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6M15 3h6v6M10 14L21 3"
                                      stroke="#A1D81A" strokeWidth="2.5" strokeLinecap="round"/>
                              </svg>
                            </a>
                          </div>
                        </td>
                      </tr>
                    ))}
              </tbody>
            </table>
          </div>

          {/* Paginación */}
          {totalPaginas > 1 && (
            <div className="flex items-center justify-between px-4 py-3 border-t"
                 style={{ borderColor: 'rgba(18,81,96,0.06)' }}>
              <button
                onClick={() => onPageChange(data.pagina - 1)}
                disabled={data.pagina <= 1}
                className="text-xs font-semibold px-3 py-1.5 rounded-lg transition-opacity disabled:opacity-30"
                style={{ background: 'var(--beige-dk)' }}
              >
                ← Anterior
              </button>
              <span className="text-xs opacity-50">
                {data.pagina} / {totalPaginas}
              </span>
              <button
                onClick={() => onPageChange(data.pagina + 1)}
                disabled={data.pagina >= totalPaginas}
                className="text-xs font-semibold px-3 py-1.5 rounded-lg transition-opacity disabled:opacity-30"
                style={{ background: 'var(--beige-dk)' }}
              >
                Siguiente →
              </button>
            </div>
          )}
        </div>
      </section>
    </>
  )
}
