// ============================================================
// CONALTURA BI LEGALIZACIONES — Tipos centrales
// Toda la app importa desde aquí. Espeja el schema de Neon.
// ============================================================

// ── Filtros transversales (query params de todos los endpoints) ──────────
export interface Filtros {
  anio?:              number
  mes?:               number
  proyecto?:          string
  director?:          string
  ciudad?:            string
  canal_atribucion?:  string
  canal_gestion?:     string
}

// ── Constantes de dominio ─────────────────────────────────────────────────
export const STAGE_LABELS: Record<string, string> = {
  consignacion:      'Negocios con Consignación',
  legal_espera:      'En Espera por Director',
  legal_aprobada_dir:'Aprobada por Director',
  revision_sinco:    'Revisión SINCO',
  aprobado_exitoso:  'Aprobado Exitoso',
  aprobado_novedades:'Aprobado con Novedades',
  negocio_rechazado: 'Negocio Rechazado',
  venta_caida:       'Venta Caída',
}

export const STAGE_ORDEN = [
  'consignacion', 'legal_espera', 'legal_aprobada_dir', 'revision_sinco',
  'aprobado_exitoso', 'aprobado_novedades', 'negocio_rechazado', 'venta_caida',
] as const

export const CIUDADES = ['Medellín','Bogotá','Barranquilla','Cartagena','Cali'] as const
export const GRUPOS = ['pipeline','resolucion','caida'] as const

export type StageCode   = typeof STAGE_ORDEN[number]
export type CiudadCode  = typeof CIUDADES[number]
export type GrupoCode   = typeof GRUPOS[number]

// ─────────────────────────────────────────────────────────────────────────
// 1. KPIs  →  GET /api/kpis
// ─────────────────────────────────────────────────────────────────────────
export interface KpisResponse {
  // KPI 1-4: cohorte B (fecha_aprobacion_final en el período)
  total_resolucion:     number   // KPI 1 — total del mes
  aprobadas_exitoso:    number   // KPI 2
  aprobadas_novedades:  number   // KPI 3
  rechazadas:           number   // KPI 4
  // KPI 5: cohorte C (date_entered_venta_caida en el período)
  ventas_caidas:        number
  // KPI 6: % aprobadas en ventana de cierre
  en_ventana_cierre:    number   // conteo absoluto
  pct_ventana_cierre:   number   // porcentaje sobre aprobadas
  // KPI 7: % cumplimiento vs meta
  meta_negocios:        number   // de manual_metas (0 si no hay)
  pct_cumplimiento:     number   // (aprobadas / meta) * 100
  // Contexto
  anio:                 number
  mes:                  number
  ultima_actualizacion: string   // ISO timestamp del último updated_at en raw
}

// ─────────────────────────────────────────────────────────────────────────
// 2. Pipeline  →  GET /api/pipeline
// ─────────────────────────────────────────────────────────────────────────
export interface PipelineStage {
  etapa_codigo:  StageCode
  etapa_label:   string
  count:         number
  pct_del_total: number    // % sobre el total del pipeline activo
  aging_promedio: number | null   // días promedio en ese stage
}

export interface PipelineResponse {
  total_pipeline:  number
  stages:          PipelineStage[]
  // Caídas del mes (cohorte C) — separadas del pipeline
  caidas_del_mes:  number
  anio_caida:      number
  mes_caida:       number
}

// ─────────────────────────────────────────────────────────────────────────
// 3. Proyectos  →  GET /api/proyectos
// ─────────────────────────────────────────────────────────────────────────
export interface ProyectoResumen {
  proyecto:            string
  director:            string
  ciudad:              string
  aprobadas:           number   // exitoso + novedades
  exitosas:            number
  con_novedades:       number
  rechazadas:          number
  ventas_caidas:       number
  pipeline_activo:     number
  pct_del_total:       number   // aprobadas / total_aprobadas * 100
  suma_valor_inmueble: number
  avg_lead_time:       number | null
  p50_lead_time:       number | null
}

export interface ProyectosResponse {
  proyectos:       ProyectoResumen[]
  total_aprobadas: number
}

// ─────────────────────────────────────────────────────────────────────────
// 4. Tendencia mensual  →  GET /api/tendencia
// ─────────────────────────────────────────────────────────────────────────
export interface TendenciaMes {
  anio:               number
  mes:                number
  label:              string   // "Ene 2025"
  aprobadas:          number   // exitoso + novedades
  exitosas:           number
  con_novedades:      number
  rechazadas:         number
  ventas_caidas:      number
  pipeline_activo:    number
  meta:               number   // de manual_metas (0 si no hay)
  pct_cumplimiento:   number
}

export interface TendenciaResponse {
  meses:   TendenciaMes[]
  periodos: number   // cuántos meses devuelve
}

// ─────────────────────────────────────────────────────────────────────────
// 5. Tiempos  →  GET /api/tiempos
// ─────────────────────────────────────────────────────────────────────────
export interface TiempoStage {
  stage:      StageCode
  label:      string
  avg_dias:   number | null
  p50_dias:   number | null
  p90_dias:   number | null
  n:          number           // registros con dato
}

export interface TiempoProyecto {
  proyecto:      string
  director:      string
  n:             number
  avg_lead_time: number | null
  p50_lead_time: number | null
  p90_lead_time: number | null
  min_lead_time: number | null
  max_lead_time: number | null
  // Semáforo calculado en el servidor
  semaforo:      'verde' | 'amarillo' | 'rojo' | null
}

export interface TiemposResponse {
  por_stage:    TiempoStage[]
  por_proyecto: TiempoProyecto[]
  global: {
    avg_lead_time: number | null
    p50_lead_time: number | null
    p90_lead_time: number | null
  }
}

// ─────────────────────────────────────────────────────────────────────────
// 6. Timeline (drill-down por legalización)  →  GET /api/timeline?id=XXX
// ─────────────────────────────────────────────────────────────────────────
export interface TimelineHito {
  etapa_codigo:  StageCode
  etapa_label:   string
  fecha_entrada: string | null   // ISO date
  dias_en_stage: number | null
  es_actual:     boolean
}

export interface TimelineResponse {
  hs_object_id:              number
  nombre_legalizacion:       string
  proyecto:                  string
  director:                  string
  etapa_actual:              StageCode
  grupo:                     GrupoCode
  fecha_aprobacion_final:    string | null
  dias_consignacion_a_aprobacion: number | null
  aging_dias:                number | null
  hubspot_url:               string
  hitos:                     TimelineHito[]
  // Enriquecimiento deal
  canal_atribucion:          string
  canal_gestion_original:    string
  nombrecomprador:           string
  valor_del_inmueble:        number | null
}

// ─────────────────────────────────────────────────────────────────────────
// 7. Canales  →  GET /api/canales
// ─────────────────────────────────────────────────────────────────────────
export interface CanalResumen {
  canal:              string
  tipo:               'atribucion' | 'gestion_original' | 'gestion_secundario'
  aprobadas:          number
  exitosas:           number
  con_novedades:      number
  rechazadas:         number
  ventas_caidas:      number
  pipeline_activo:    number
  avg_lead_time:      number | null
  pct_del_total:      number
}

export interface CanalesResponse {
  por_atribucion:         CanalResumen[]
  por_gestion_original:   CanalResumen[]
  por_gestion_secundario: CanalResumen[]
}

// ─────────────────────────────────────────────────────────────────────────
// 8. Mapa  →  GET /api/mapa
// ─────────────────────────────────────────────────────────────────────────
export interface MapaCiudad {
  ciudad:           string
  // Coordenadas para el SVG (posición relativa sobre el mapa de Colombia)
  lat:              number
  lng:              number
  aprobadas:        number
  pipeline_activo:  number
  ventas_caidas:    number
  avg_lead_time:    number | null
  suma_valor:       number
}

export interface MapaResponse {
  ciudades: MapaCiudad[]
}

// ─────────────────────────────────────────────────────────────────────────
// 9. Detalle (tabla drill-down)  →  GET /api/detalle
// ─────────────────────────────────────────────────────────────────────────
export interface DetalleRow {
  hs_object_id:            number
  nombre_legalizacion:     string
  etapa_codigo:            StageCode
  etapa_label:             string
  grupo:                   GrupoCode
  proyecto:                string
  director:                string
  ciudad:                  string
  canal_atribucion:        string
  nombrecomprador:         string
  valor_del_inmueble:      number | null
  fecha_aprobacion_final:  string | null
  dias_lead_time:          number | null
  aging_dias:              number | null
  en_ventana_cierre:       boolean
  hubspot_url:             string
}

export interface DetalleResponse {
  rows:    DetalleRow[]
  total:   number
  pagina:  number
  por_pagina: number
}

// ─────────────────────────────────────────────────────────────────────────
// 10. Metas  →  GET/POST /api/metas
// ─────────────────────────────────────────────────────────────────────────
export interface MetaResponse {
  anio:          number
  mes:           number
  meta_negocios: number
  updated_at:    string | null
}

export interface MetaUpsertBody {
  anio:          number
  mes:           number
  meta_negocios: number
}

// ── Helpers de formato (compartidos con componentes) ─────────────────────
export const MES_NAMES = [
  '','Ene','Feb','Mar','Abr','May','Jun',
  'Jul','Ago','Sep','Oct','Nov','Dic',
]

export function labelMes(anio: number, mes: number): string {
  return `${MES_NAMES[mes]} ${anio}`
}

export function fmtNum(n: number | null | undefined, decimales = 0): string {
  if (n == null) return '—'
  return n.toLocaleString('es-CO', { maximumFractionDigits: decimales })
}

export function fmtPct(n: number | null | undefined): string {
  if (n == null) return '—'
  return `${n.toFixed(1)}%`
}

export function fmtDias(n: number | null | undefined): string {
  if (n == null) return '—'
  return `${n.toFixed(1)} d`
}
