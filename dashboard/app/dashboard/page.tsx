'use client'
import { useState, useEffect, useCallback } from 'react'
import dynamic from 'next/dynamic'
import { MES_NAMES } from '@/types'
import type {
  KpisResponse, PipelineResponse, TendenciaResponse,
  TiemposResponse, MapaResponse, DetalleResponse,
} from '@/types'

const KpiCards            = dynamic(() => import('@/components/KpiCards'),            { ssr: false })
const PipelineFunnel      = dynamic(() => import('@/components/PipelineFunnel'),      { ssr: false })
const TendenciaMensual    = dynamic(() => import('@/components/TendenciaMensual'),    { ssr: false })
const TiemposEtapa        = dynamic(() => import('@/components/TiemposEtapa'),        { ssr: false })
const MapaColombia        = dynamic(() => import('@/components/MapaColombia'),        { ssr: false })
const TablaLegalizaciones = dynamic(() => import('@/components/TablaLegalizaciones'), { ssr: false })
const MetaModal           = dynamic(() => import('@/components/MetaModal'),           { ssr: false })

function nowColombia() {
  const d = new Date(new Date().toLocaleString('en-US', { timeZone: 'America/Bogota' }))
  return { anio: d.getFullYear(), mes: d.getMonth() + 1 }
}

function Skeleton({ h = 'h-40' }: { h?: string }) {
  return <div className={`shimmer ${h} rounded-xl`} />
}

function SelectorPeriodo({ anio, mes, onChange }: {
  anio: number; mes: number; onChange: (a: number, m: number) => void
}) {
  const opciones: { anio: number; mes: number; label: string }[] = []
  let a = anio, m = mes
  for (let i = 0; i < 18; i++) {
    opciones.push({ anio: a, mes: m, label: `${MES_NAMES[m]} ${a}` })
    m--; if (m < 1) { m = 12; a-- }
  }
  return (
    <select value={`${anio}-${mes}`}
      onChange={e => { const [a,m] = e.target.value.split('-').map(Number); onChange(a,m) }}
      className="text-sm font-semibold px-3 py-2 rounded-lg border focus:outline-none"
      style={{ borderColor: 'rgba(18,81,96,0.15)', background: 'white', color: 'var(--primary)' }}>
      {opciones.map(o => (
        <option key={`${o.anio}-${o.mes}`} value={`${o.anio}-${o.mes}`}>{o.label}</option>
      ))}
    </select>
  )
}

function FilterChip({ label, onRemove }: { label: string; onRemove: () => void }) {
  return (
    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold"
          style={{ background: 'rgba(18,81,96,0.08)', color: 'var(--primary)' }}>
      {label}
      <button onClick={onRemove} className="opacity-50 hover:opacity-100 ml-0.5">✕</button>
    </span>
  )
}

export default function DashboardPage() {
  const hoy = nowColombia()
  const [anio,           setAnio]           = useState(hoy.anio)
  const [mes,            setMes]            = useState(hoy.mes)
  const [filtroProyecto, setFiltroProyecto] = useState('')
  const [filtroDirector, setFiltroDirector] = useState('')
  const [filtroCiudad,   setFiltroCiudad]   = useState('')
  const [filtroCanal,    setFiltroCanal]    = useState('')
  const [mostrarMeta,    setMostrarMeta]    = useState(false)
  const [sidebarOpen,    setSidebarOpen]    = useState(false)

  const [kpis,      setKpis]      = useState<KpisResponse | null>(null)
  const [pipeline,  setPipeline]  = useState<PipelineResponse | null>(null)
  const [tendencia, setTendencia] = useState<TendenciaResponse | null>(null)
  const [tiempos,   setTiempos]   = useState<TiemposResponse | null>(null)
  const [mapa,      setMapa]      = useState<MapaResponse | null>(null)
  const [detalle,   setDetalle]   = useState<DetalleResponse | null>(null)
  const [loadingDetalle, setLoadingDetalle] = useState(false)

  const buildParams = useCallback((extras: Record<string, string> = {}) => {
    const p = new URLSearchParams({ anio: String(anio), mes: String(mes) })
    if (filtroProyecto) p.set('proyecto',        filtroProyecto)
    if (filtroDirector) p.set('director',        filtroDirector)
    if (filtroCiudad)   p.set('ciudad',          filtroCiudad)
    if (filtroCanal)    p.set('canal_atribucion', filtroCanal)
    Object.entries(extras).forEach(([k,v]) => p.set(k,v))
    return p.toString()
  }, [anio, mes, filtroProyecto, filtroDirector, filtroCiudad, filtroCanal])

  const fetchAll = useCallback(async () => {
    const qs = buildParams()
    try {
      const [k, pi, te, ti, ma] = await Promise.all([
        fetch(`/api/kpis?${qs}`).then(r => r.json()),
        fetch(`/api/pipeline?${qs}`).then(r => r.json()),
        fetch(`/api/tendencia?${buildParams({ meses: '14' })}`).then(r => r.json()),
        fetch(`/api/tiempos?${qs}`).then(r => r.json()),
        fetch(`/api/mapa?${qs}`).then(r => r.json()),
      ])
      setKpis(k); setPipeline(pi); setTendencia(te); setTiempos(ti); setMapa(ma)
    } catch(e) { console.error(e) }
  }, [buildParams])

  const fetchDetalle = useCallback(async (pagina = 1) => {
    setLoadingDetalle(true)
    try {
      const qs = buildParams({ pagina: String(pagina), por_pagina: '50' })
      setDetalle(await fetch(`/api/detalle?${qs}`).then(r => r.json()))
    } finally { setLoadingDetalle(false) }
  }, [buildParams])

  useEffect(() => { fetchAll() }, [fetchAll])
  useEffect(() => { fetchDetalle(1) }, [fetchDetalle])

  const hayFiltros = filtroProyecto || filtroDirector || filtroCiudad || filtroCanal
  function resetFiltros() { setFiltroProyecto(''); setFiltroDirector(''); setFiltroCiudad(''); setFiltroCanal('') }

  return (
    <div className="min-h-screen flex" style={{ background: 'var(--beige)' }}>

      {/* SIDEBAR */}
      <aside className="fixed inset-y-0 left-0 z-30 flex flex-col transition-transform duration-300"
             style={{ width: 240, background: 'var(--primary)',
                      transform: sidebarOpen ? 'translateX(0)' : 'translateX(-100%)' }}>
        <div className="flex items-center gap-3 px-5 py-5 border-b"
             style={{ borderColor: 'rgba(255,255,255,0.08)' }}>
          <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
               style={{ background: 'rgba(161,216,26,0.15)' }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
              <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"
                    stroke="#A1D81A" strokeWidth="2.5" strokeLinecap="round"/>
            </svg>
          </div>
          <div>
            <p className="font-display text-sm font-bold text-white leading-tight">BI Legalizaciones</p>
            <p className="text-xs text-white" style={{ opacity: 0.4 }}>Conaltura</p>
          </div>
          <button onClick={() => setSidebarOpen(false)} className="ml-auto text-white" style={{ opacity: 0.4 }}>✕</button>
        </div>

        <div className="px-4 py-4 border-b" style={{ borderColor: 'rgba(255,255,255,0.06)' }}>
          <p className="text-xs font-semibold uppercase tracking-wide mb-2 text-white" style={{ opacity: 0.4 }}>Período</p>
          <SelectorPeriodo anio={anio} mes={mes} onChange={(a,m) => { setAnio(a); setMes(m) }} />
        </div>

        <div className="px-4 py-4 flex-1 overflow-y-auto">
          <p className="text-xs font-semibold uppercase tracking-wide mb-3 text-white" style={{ opacity: 0.4 }}>Filtros</p>
          <div className="space-y-3">
            {([
              { label: 'Ciudad', value: filtroCiudad, set: setFiltroCiudad,
                options: ['Medellín','Bogotá','Barranquilla','Cartagena','Cali'] },
            ] as const).map(({ label, value, set, options }: any) => (
              <div key={label}>
                <label className="text-xs mb-1 block text-white" style={{ opacity: 0.5 }}>{label}</label>
                <select value={value} onChange={(e: React.ChangeEvent<HTMLSelectElement>) => set(e.target.value)}
                        className="w-full text-xs px-2.5 py-2 rounded-lg focus:outline-none text-white"
                        style={{ background: 'rgba(255,255,255,0.08)', border: 'none' }}>
                  <option value="">Todos</option>
                  {options.map((o: string) => <option key={o} value={o}>{o}</option>)}
                </select>
              </div>
            ))}
          </div>
          {hayFiltros && (
            <button onClick={resetFiltros} className="mt-4 w-full text-xs py-2 rounded-lg font-semibold"
                    style={{ background: 'rgba(255,121,90,0.2)', color: '#FF795A' }}>
              Limpiar filtros
            </button>
          )}
        </div>

        <div className="px-4 py-3 border-t" style={{ borderColor: 'rgba(255,255,255,0.06)' }}>
          {kpis?.ultima_actualizacion && (
            <p className="text-xs text-white" style={{ opacity: 0.3 }}>
              ETL: {new Date(kpis.ultima_actualizacion).toLocaleString('es-CO', {
                month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
            </p>
          )}
        </div>
      </aside>

      {sidebarOpen && (
        <div className="fixed inset-0 z-20 lg:hidden" style={{ background: 'rgba(0,0,0,0.3)' }}
             onClick={() => setSidebarOpen(false)} />
      )}

      {/* MAIN */}
      <main className="flex-1 min-w-0">
        <header className="sticky top-0 z-10 flex items-center gap-3 px-5 py-3 border-b"
                style={{ background: 'rgba(244,240,229,0.92)', backdropFilter: 'blur(8px)',
                         borderColor: 'rgba(18,81,96,0.08)' }}>
          <button onClick={() => setSidebarOpen(true)}
                  className="w-8 h-8 rounded-lg flex items-center justify-center"
                  style={{ background: 'var(--primary)', color: 'var(--accent)' }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
              <path d="M3 12h18M3 6h18M3 18h18" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"/>
            </svg>
          </button>
          <span className="font-display font-bold text-sm" style={{ color: 'var(--primary)' }}>BI Legalizaciones</span>
          <span className="opacity-30">/</span>
          <span className="text-sm opacity-60">{MES_NAMES[mes]} {anio}</span>
          <div className="flex items-center gap-2 ml-2 flex-wrap">
            {filtroProyecto && <FilterChip label={filtroProyecto} onRemove={() => setFiltroProyecto('')} />}
            {filtroDirector && <FilterChip label={filtroDirector} onRemove={() => setFiltroDirector('')} />}
            {filtroCiudad   && <FilterChip label={filtroCiudad}   onRemove={() => setFiltroCiudad('')} />}
            {filtroCanal    && <FilterChip label={filtroCanal}    onRemove={() => setFiltroCanal('')} />}
          </div>
          <div className="ml-auto">
            <SelectorPeriodo anio={anio} mes={mes} onChange={(a,m) => { setAnio(a); setMes(m) }} />
          </div>
        </header>

        <div className="px-5 py-6 space-y-10 max-w-7xl mx-auto">
          {kpis      ? <KpiCards data={kpis} onEditMeta={() => setMostrarMeta(true)} /> : <Skeleton h="h-52" />}
          {pipeline  ? <PipelineFunnel data={pipeline} />   : <Skeleton h="h-44" />}
          {tendencia ? <TendenciaMensual data={tendencia} /> : <Skeleton h="h-64" />}
          {tiempos   ? <TiemposEtapa data={tiempos} />      : <Skeleton h="h-80" />}
          {mapa      ? <MapaColombia data={mapa} />          : <Skeleton h="h-96" />}
          {detalle   ? (
            <TablaLegalizaciones
              data={detalle}
              loading={loadingDetalle}
              onPageChange={p => fetchDetalle(p)}
            />
          ) : <Skeleton h="h-96" />}
        </div>
      </main>

      {mostrarMeta && kpis && (
        <MetaModal
          anio={anio} mes={mes} metaActual={kpis.meta_negocios}
          onClose={() => setMostrarMeta(false)}
          onSaved={m => setKpis(prev => prev
            ? { ...prev, meta_negocios: m,
                pct_cumplimiento: m > 0
                  ? parseFloat(((prev.aprobadas_exitoso + prev.aprobadas_novedades) / m * 100).toFixed(1)) : 0 }
            : prev)}
        />
      )}
    </div>
  )
}
