// Constantes de marca, formateadores y helpers compartidos por el dashboard.
import type { DetalleRow } from '@/types'

export const B  = '#F4F0E5'   // fondo
export const T  = '#125160'   // principal
export const A  = '#DBFF69'   // acento (CTA, badges activos)
export const AM = '#A1D81A'   // verde (solo gráficas / KPIs positivos)
export const OR = '#FF795A'   // naranja (alertas / rechazados)
export const PU = '#B382FF'   // morado (EXCLUSIVO aprobado_gerencia)
export const YE = '#F5C242'   // amarillo semáforo (novedades)
export const F  = `'Funnel Sans', Arial, sans-serif`
export const MUTED = 'rgba(18,81,96,.45)'

export const MES  = ['','Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic']
export const MESF = ['','Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre']

export const fN  = (v: unknown, d = 0) => v == null ? '—' : Number(v).toLocaleString('es-CO', { maximumFractionDigits: d })
export const fM  = (v: unknown) => !v || !Number(v) ? '—' : `$${(Number(v) / 1e6).toLocaleString('es-CO', { maximumFractionDigits: 1 })}M`
export const fD  = (v: unknown) => v == null ? '—' : `${Number(v).toFixed(1)} d`
export const pct = (a: number, b: number) => b > 0 ? Math.round(a / b * 100) : 0
export const dtF = (s: string | null | undefined) =>
  s ? new Date(s).toLocaleDateString('es-CO', { day: 'numeric', month: 'short', year: '2-digit' }) : '—'
export const shortName = (n: string) => { const p = (n || '').split(' ').filter(Boolean); return p.length > 1 ? `${p[0]} ${p[p.length - 1]}` : (n || '—') }

export const nowBogota = () => {
  const x = new Date(new Date().toLocaleString('en-US', { timeZone: 'America/Bogota' }))
  return { y: x.getFullYear(), mo: x.getMonth() + 1 }
}

export const STAGE_LABEL: Record<string, string> = {
  consignacion: 'Consignación', legal_espera: 'Espera Director',
  legal_aprobada_dir: 'Aprobada Dir.', revision_sinco: 'Revisión SINCO',
  aprobado_exitoso: 'Aprobado ✓', aprobado_novedades: 'Con Novedades',
  aprobado_gerencia: 'Aprob. Gerencia',
  negocio_rechazado: 'Rechazado', venta_caida: 'Venta Caída',
}
export const STAGE_COLOR: Record<string, string> = {
  consignacion: T, legal_espera: '#1a6b7a',
  legal_aprobada_dir: '#1a7d6e', revision_sinco: '#279752',
  aprobado_exitoso: '#166534', aprobado_novedades: '#92400E',
  aprobado_gerencia: PU,
  negocio_rechazado: OR, venta_caida: '#B5472F',
}
export const PIPELINE_STAGES = ['consignacion', 'legal_espera', 'legal_aprobada_dir', 'revision_sinco']

export const HUBSPOT_BASE = 'https://app.hubspot.com/contacts/47845317/record/2-58255488'
export const hubspotUrl = (r: { hs_object_id: number | string; hubspot_url?: string }) =>
  r.hubspot_url || `${HUBSPOT_BASE}/${r.hs_object_id}`

export const DIRECTORES = ['Alba Luz Consuegra', 'Carolina Cárdenas', 'Ingrid Marcela Matta', 'Leonardo Villegas', 'Natalia Giraldo', 'Patricia Herrera']

export type Row = DetalleRow
export type DetTab = 'todos' | 'pipeline' | 'resolucion' | 'caida'

// Color del lead time / aging (días)
export const ltColor = (d: number | null | undefined) =>
  d == null ? MUTED : d > 30 ? OR : d > 15 ? '#92400E' : '#166534'

// Clave de agrupación de un motivo (se trunca a 60 chars igual que en la agregación)
export const motivoKey = (m: string | null | undefined) => (m || '').trim().substring(0, 60)
