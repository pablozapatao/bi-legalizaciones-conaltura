'use client'
import { useState, useEffect, useCallback, useRef, useMemo } from 'react'
import toast from 'react-hot-toast'
import type {
  KpisResponse, PipelineResponse, TendenciaResponse, TiemposResponse, ProyectosResponse,
  DetalleResponse, DetalleRow, VentanaResponse, VentanaCliente,
} from '@/types'
import { T, B, F, MESF, nowBogota, motivoKey, PIPELINE_STAGES, type DetTab } from '@/components/dashboard/brand'
import { SecHeader, Skeleton } from '@/components/dashboard/ui'
import { fetchAllRows, exportClientesXLSX, exportFileName } from '@/components/dashboard/exports'
import Sidebar, { type FiltersState } from '@/components/dashboard/Sidebar'
import KpiGrid from '@/components/dashboard/KpiGrid'
import SemaforoDistribucion from '@/components/dashboard/SemaforoDistribucion'
import ProyectosTable from '@/components/dashboard/ProyectosTable'
import PipelineSection from '@/components/dashboard/PipelineSection'
import TendenciaVelocidad from '@/components/dashboard/TendenciaVelocidad'
import MotivosSection, { type MotivoAgg, type DirAgg } from '@/components/dashboard/MotivosSection'
import TrazabilidadTable from '@/components/dashboard/TrazabilidadTable'
import DetailDrawer from '@/components/dashboard/DetailDrawer'
import RechazadosDrawer from '@/components/dashboard/RechazadosDrawer'
import MotivoDrawer from '@/components/dashboard/MotivoDrawer'
import VentanaDrawer from '@/components/dashboard/VentanaDrawer'
import MetaModalBI from '@/components/dashboard/MetaModalBI'

const getJson = <T,>(url: string): Promise<T> => fetch(url).then(r => r.json())

// Convierte un cliente de /api/ventana en un DetalleRow parcial para el DetailDrawer
function ventanaToRow(c: VentanaCliente): DetalleRow {
  return {
    hs_object_id: c.hs_object_id, nombre_legalizacion: c.nombre_legalizacion, etapa_codigo: c.etapa_codigo, etapa_label: c.etapa_label,
    grupo: 'resolucion', proyecto: c.proyecto, director: c.director, ciudad: c.ciudad, torre: c.torre, canal_atribucion: c.canal_atribucion,
    canal_gestion_original: '', canal_gestion_secundario: '', nombrecomprador: c.nombrecomprador, documento_comprador_1: c.documento_comprador_1,
    documento_comprador_2: '', valor_del_inmueble: c.valor_del_inmueble, tipo_cuenta_consignacion: '', fecha_aprobacion_final: c.fecha_aprobacion_final,
    dias_lead_time: null, aging_dias: null, en_ventana_cierre: true, motivo_de_observacion: c.motivo_de_observacion, motivo_semaforo: null,
    verificacion_documental: '', estado_sarlaft: '', decision_final: '', invdescunidad: '', numero_unidad: c.numero_unidad,
    propietario_del_negocio: '', id_negocio_origen: null, deal_id: null, hubspot_url: c.hubspot_url, fecha_envio_sarlaft: null,
    fecha_respuesta_sarlaft: null, dias_en_consignacion: null, dias_en_legal_espera: null, dias_en_legal_aprobada: null,
    dias_en_revision_sinco: null, fecha_creacion: null, fecha_modificacion: null, date_entered_consignacion: null,
    date_entered_legal_espera: null, date_entered_legal_aprobada_dir: null, date_entered_revision_sinco: null,
    date_entered_aprobado_exitoso: null, date_entered_aprobado_novedades: null, date_entered_negocio_rechazado: null,
    date_entered_venta_caida: null,
  }
}

export default function Dashboard() {
  const hoy = nowBogota()
  const [f, setF] = useState<FiltersState>({ anio: hoy.y, mes: hoy.mo, semana: null, ciudades: [], director: '', proyecto: '' })
  const setFilters = useCallback((p: Partial<FiltersState>) => setF(prev => ({ ...prev, ...p })), [])
  const clearFilters = () => setF(prev => ({ ...prev, semana: null, ciudades: [], director: '', proyecto: '' }))

  const [kpis, setK] = useState<KpisResponse | null>(null)
  const [pipe, setP] = useState<PipelineResponse | null>(null)
  const [tend, setT] = useState<TendenciaResponse | null>(null)
  const [times, setTi] = useState<TiemposResponse | null>(null)
  const [proy, setPr] = useState<ProyectosResponse | null>(null)
  const [allProy, setAllProy] = useState<string[]>([])
  const [periodRows, setPeriodRows] = useState<DetalleRow[]>([])
  const [rowsLoading, setRowsLoading] = useState(true)
  const [loading, setLoading] = useState(true)

  const [selected, setSelected] = useState<DetalleRow | null>(null)
  const [showMeta, setShowMeta] = useState(false)
  const [showRechazados, setShowRechazados] = useState(false)
  const [showVentana, setShowVentana] = useState(false)
  const [ventana, setVentana] = useState<VentanaResponse | null>(null)
  const [ventanaLoading, setVentanaLoading] = useState(false)
  const [motivoSel, setMotivoSel] = useState<string | null>(null)

  // Trazabilidad
  const [tab, setTab] = useState<DetTab>('todos')
  const [stage, setStage] = useState<string | null>(null)
  const [page, setPage] = useState(1)
  const [det, setDet] = useState<DetalleResponse | null>(null)
  const [detLoading, setDetLoading] = useState(false)
  const detSeq = useRef(0)

  const qs = useMemo(() => {
    const p = new URLSearchParams({ anio: String(f.anio), mes: String(f.mes) })
    if (f.semana) p.set('semana', String(f.semana))
    if (f.ciudades.length) p.set('ciudad', f.ciudades.join(','))
    if (f.director) p.set('director', f.director)
    if (f.proyecto) p.set('proyecto', f.proyecto)
    return p.toString()
  }, [f])

  // Opciones del dropdown de proyectos: dependen solo del período (no se achican al elegir uno)
  useEffect(() => {
    getJson<ProyectosResponse>(`/api/proyectos?anio=${f.anio}&mes=${f.mes}`)
      .then(r => setAllProy((r.proyectos || []).map(x => x.proyecto).filter(Boolean).sort()))
      .catch(() => setAllProy([]))
  }, [f.anio, f.mes])

  const fetchAll = useCallback(async () => {
    setLoading(true); setRowsLoading(true)
    setK(null); setP(null); setTi(null); setPr(null)
    const tq = new URLSearchParams(qs); tq.set('meses', '14')
    try {
      const [k, p, t, ti, pr] = await Promise.all([
        getJson<KpisResponse>(`/api/kpis?${qs}`),
        getJson<PipelineResponse>(`/api/pipeline?${qs}`),
        getJson<TendenciaResponse>(`/api/tendencia?${tq}`),
        getJson<TiemposResponse>(`/api/tiempos?${qs}`),
        getJson<ProyectosResponse>(`/api/proyectos?${qs}`),
      ])
      setK(k); setP(p); setT(t); setTi(ti); setPr(pr)
    } catch { toast.error('Error cargando el dashboard') }
    finally { setLoading(false) }
    // Registros del período completo: alimentan Kanban y Motivos
    try { setPeriodRows(await fetchAllRows(qs, 'todos')) } catch { setPeriodRows([]) }
    finally { setRowsLoading(false) }
  }, [qs])

  const fetchDet = useCallback(async (pg: number, grupo: DetTab, etapa: string | null) => {
    const seq = ++detSeq.current
    setDetLoading(true)
    const p = new URLSearchParams(qs)
    p.set('pagina', String(pg)); p.set('por_pagina', '50')
    if (grupo !== 'todos') p.set('grupo', grupo)
    if (etapa) p.set('etapa', etapa)
    try {
      const d = await getJson<DetalleResponse>(`/api/detalle?${p.toString()}`)
      if (seq === detSeq.current) { setDet(d); setPage(pg) }
    } catch { if (seq === detSeq.current) toast.error('Error cargando trazabilidad') }
    finally { if (seq === detSeq.current) setDetLoading(false) }
  }, [qs])

  useEffect(() => { fetchAll() }, [fetchAll])
  useEffect(() => { fetchDet(1, tab, stage) }, [fetchDet, tab, stage])

  function onStage(code: string) {
    const same = stage === code
    setStage(same ? null : code)
    if (!same && tab !== 'pipeline' && PIPELINE_STAGES.includes(code)) setTab('pipeline')
    if (same) setTab('todos')
  }

  const openVentana = async () => {
    setShowVentana(true); setVentanaLoading(true)
    try { setVentana(await getJson<VentanaResponse>(`/api/ventana?${qs}`)) }
    catch { toast.error('Error cargando ventana de cierre') }
    finally { setVentanaLoading(false) }
  }

  // Cliente de ventana -> detalle completo (busca en los registros del período)
  const selectVentanaClient = (c: VentanaCliente) => {
    const full = periodRows.find(r => r.hs_object_id === c.hs_object_id)
    setSelected(full ?? ventanaToRow(c))
  }

  // Motivos (top 8) + ranking por director (todos los motivos), sobre el período
  const { motivos, directores } = useMemo(() => {
    const map: Record<string, Record<string, number>> = {}
    const dirMap: Record<string, number> = {}
    for (const r of periodRows) {
      const mot = motivoKey(r.motivo_de_observacion)
      if (!mot) continue
      const dir = r.director || 'Sin director'
      ;(map[mot] ||= {})[dir] = (map[mot][dir] || 0) + 1
      dirMap[dir] = (dirMap[dir] || 0) + 1
    }
    const motivos: MotivoAgg[] = Object.entries(map)
      .map(([motivo, dirs]) => ({ motivo, dirs, total: Object.values(dirs).reduce((s, n) => s + n, 0) }))
      .sort((a, b) => b.total - a.total).slice(0, 8)
    const directores: DirAgg[] = Object.entries(dirMap).map(([director, total]) => ({ director, total })).sort((a, b) => b.total - a.total)
    return { motivos, directores }
  }, [periodRows])

  const motivoRows = useMemo(() => motivoSel ? periodRows.filter(r => motivoKey(r.motivo_de_observacion) === motivoSel) : [], [motivoSel, periodRows])
  const pipelineRows = useMemo(() => periodRows.filter(r => r.grupo === 'pipeline'), [periodRows])

  async function exportVista() {
    const p = new URLSearchParams(qs)
    if (stage) p.set('etapa', stage)
    const tid = toast.loading('Preparando descarga…')
    try {
      const todos = await fetchAllRows(p.toString(), tab)
      toast.dismiss(tid)
      await exportClientesXLSX(todos, `Conaltura_Trazabilidad_${tab}${stage ? '_' + stage : ''}.xlsx`)
    } catch { toast.dismiss(tid); toast.error('Error al descargar') }
  }

  const resumen = `${MESF[f.mes]} ${f.anio}${f.semana ? ` · S${f.semana}` : ''}${f.ciudades.length ? ` · ${f.ciudades.join(', ')}` : ''}${f.director ? ` · ${f.director.split(' ')[0]}` : ''}${f.proyecto ? ` · ${f.proyecto}` : ''}`

  return (
    <div style={{ display: 'flex', height: '100vh', overflow: 'hidden', fontFamily: F, color: T, background: B }}>
      {selected && <DetailDrawer row={selected} onClose={() => setSelected(null)} />}
      {showVentana && <VentanaDrawer data={ventana} loading={ventanaLoading} anio={f.anio} mes={f.mes} onClose={() => setShowVentana(false)} onSelectClient={selectVentanaClient} />}
      {showRechazados && <RechazadosDrawer qs={qs} onClose={() => setShowRechazados(false)} onSelectRow={r => { setSelected(r); setShowRechazados(false) }} />}
      {motivoSel && (
        <MotivoDrawer motivo={motivoSel} rows={motivoRows} onClose={() => setMotivoSel(null)}
          onSelectRow={r => { setSelected(r); setMotivoSel(null) }}
          onExport={() => exportClientesXLSX(motivoRows, exportFileName.motivo(motivoSel))} />
      )}
      {showMeta && kpis && (
        <MetaModalBI anio={f.anio} mes={f.mes} actual={kpis.meta_negocios} onClose={() => setShowMeta(false)}
          onSaved={x => setK(p => p ? { ...p, meta_negocios: x, pct_cumplimiento: x > 0 ? parseFloat(((p.aprobadas_exitoso + p.aprobadas_novedades + (p.aprobadas_gerencia || 0)) / x * 100).toFixed(1)) : 0 } : p)} />
      )}

      <Sidebar f={f} set={setFilters} proyectos={allProy} loading={loading} onClear={clearFilters}
        onRefresh={() => { fetchAll(); fetchDet(1, tab, stage) }}
        etl={kpis?.ultima_actualizacion ? new Date(kpis.ultima_actualizacion).toLocaleString('es-CO', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : undefined} />

      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', minWidth: 0 }}>
        <header style={{ flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 22px', height: 52, background: T, borderBottom: '1px solid rgba(255,255,255,.07)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <h1 style={{ fontSize: 15, fontWeight: 900, color: 'rgba(255,255,255,.95)' }}>BI Legalizaciones<span style={{ fontWeight: 300, fontSize: 14, marginLeft: 8, opacity: .55 }}>/ Principal</span></h1>
            <span className="badge" style={{ background: 'rgba(219,255,105,.12)', border: '1px solid rgba(219,255,105,.3)', color: '#DBFF69', gap: 5 }}><span className="live-dot" />LIVE</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ fontSize: 11, color: 'rgba(255,255,255,.55)' }}>{resumen}</span>
            {loading && <div className="spinner" />}
          </div>
        </header>

        <main style={{ flex: 1, overflowY: 'auto', padding: '20px 22px 60px', display: 'flex', flexDirection: 'column', gap: 24 }}>
          <section>
            <SecHeader title="Rendimiento del mes" sub={`${MESF[f.mes]} ${f.anio} · aprobaciones con fecha en este período`}
              right={kpis?.ultima_actualizacion && <span style={{ fontSize: 10, color: 'rgba(18,81,96,.4)' }}>Actualizado {new Date(kpis.ultima_actualizacion).toLocaleString('es-CO', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</span>} />
            {!kpis ? <Skeleton h={190} /> : <KpiGrid kpis={kpis} onEditMeta={() => setShowMeta(true)} onVentana={openVentana} />}
          </section>

          {kpis && (kpis.aprobadas_exitoso + kpis.aprobadas_novedades + (kpis.aprobadas_gerencia || 0)) > 0 && (
            <section>
              <SecHeader title="Semáforo de distribución" sub="Distribución de las aprobaciones del mes · vista para junta directiva" />
              <SemaforoDistribucion kpis={kpis} />
            </section>
          )}

          <ProyectosTable data={proy} qs={qs} onRechazados={() => setShowRechazados(true)} />
          <PipelineSection pipe={pipe} rows={pipelineRows} loadingRows={rowsLoading} stage={stage} onStage={onStage} onSelect={setSelected} />
          <TendenciaVelocidad tend={tend} times={times} />
          <MotivosSection motivos={motivos} directores={directores} loading={rowsLoading} selected={motivoSel} onSelect={setMotivoSel} />
          <TrazabilidadTable det={det} loading={detLoading} tab={tab} onTab={t => setTab(t)} stage={stage}
            onClearStage={() => { setStage(null); setTab('todos') }} page={page} onPage={pg => fetchDet(pg, tab, stage)}
            onSelect={setSelected} onExport={exportVista} />
        </main>
      </div>
    </div>
  )
}
