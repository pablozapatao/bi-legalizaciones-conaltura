// Exportaciones .xlsx (SheetJS) — TODAS usan fetchAllRows, nunca la página actual.
import toast from 'react-hot-toast'
import type { DetalleRow, DetalleResponse, ProyectoResumen, VentanaCliente } from '@/types'
import { hubspotUrl } from './brand'

const POR_PAG = 2000
const MAX_PAGINAS = 50

// Pagina /api/detalle (por_pagina 2000, tope 50 páginas) hasta traer todo.
export async function fetchAllRows(qs: string, grupo?: string): Promise<DetalleRow[]> {
  let pagina = 1
  const todos: DetalleRow[] = []
  for (;;) {
    const p = new URLSearchParams(qs)
    p.set('pagina', String(pagina))
    p.set('por_pagina', String(POR_PAG))
    if (grupo && grupo !== 'todos') p.set('grupo', grupo)
    const data: Partial<DetalleResponse> = await fetch(`/api/detalle?${p.toString()}`).then(r => r.json())
    const rows = data.rows ?? []
    todos.push(...rows)
    if (todos.length >= (data.total ?? 0) || rows.length < POR_PAG) break
    pagina++
    if (pagina > MAX_PAGINAS) break
  }
  return todos
}

type Cell = string | number | null
type SheetRow = Record<string, Cell>

async function writeSheet(data: SheetRow[], widths: number[], sheet: string, file: string) {
  const XLSX = await import('xlsx')
  const ws = XLSX.utils.json_to_sheet(data)
  ws['!cols'] = widths.map(w => ({ wch: w }))
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, sheet)
  XLSX.writeFile(wb, file)
}

const safe = (s: string) => s.slice(0, 20).replace(/\s+/g, '_')
const num = (v: number | null | undefined): Cell => v != null ? v : ''

/** Resumen agregado por proyecto (ya viene completo de /api/proyectos). */
export async function exportXLSX(rows: ProyectoResumen[]) {
  const data = rows.map(r => ({
    'Proyecto': r.proyecto || '',
    'Director': r.director || '',
    'Ciudad': r.ciudad || '',
    'Aprobadas': r.aprobadas ?? (r.exitosas + r.con_novedades + (r.aprobado_gerencia || 0)),
    'Sin Novedad': r.exitosas || 0,
    'Con Novedad': r.con_novedades || 0,
    'Gerencia': r.aprobado_gerencia || 0,
    'Rechazadas': r.rechazadas || 0,
    'Ventas Caídas': r.ventas_caidas || 0,
    'Pipeline Activo': r.pipeline_activo || 0,
    'Valor Total COP': r.suma_valor_inmueble || 0,
    'Lead Time Prom.': r.avg_lead_time ?? '',
  }))
  await writeSheet(data, [22, 22, 14, 12, 12, 12, 12, 12, 14, 14, 20, 16], 'Flujo de Proyectos', 'Conaltura_BI_Proyectos.xlsx')
  toast.success('Conaltura_BI_Proyectos.xlsx')
}

// 46 columnas en 11 grupos: 4+6+4+4+4+4+2+3+6+8+1
export async function exportClientesXLSX(rows: DetalleRow[], nombreArchivo = 'Conaltura_Clientes_Legalizados.xlsx') {
  if (!rows.length) { toast.error('Sin registros para descargar'); return }
  const data = rows.map(r => ({
    // Identificación (4)
    'ID HubSpot': r.hs_object_id || '',
    'Nombre Legalización': r.nombre_legalizacion || '',
    'ID Deal': r.deal_id ?? '',
    'ID Negocio Origen': r.id_negocio_origen ?? '',
    // Proyecto (6)
    'Proyecto': r.proyecto || '',
    'Director': r.director || '',
    'Ciudad': r.ciudad || '',
    'Torre': r.torre || '',
    'Número Unidad': r.numero_unidad || '',
    'Descripción Unidad': r.invdescunidad || '',
    // Comprador (4)
    'Comprador': r.nombrecomprador || '',
    'Documento 1': r.documento_comprador_1 || '',
    'Documento 2': r.documento_comprador_2 || '',
    'Propietario': r.propietario_del_negocio || '',
    // Canales (4)
    'Atribución': r.canal_atribucion || '',
    'Gestión PRIMARIO': r.canal_gestion_original || '',
    'Gestión SECUNDARIO': r.canal_gestion_secundario || '',
    'Tipo Cuenta': r.tipo_cuenta_consignacion || '',
    // Stage (4)
    'Stage': r.etapa_label || r.etapa_codigo || '',
    'Decisión Final': r.decision_final || '',
    'Motivo Observación': r.motivo_de_observacion || '',
    'Semáforo': r.motivo_semaforo || '',
    // SARLAFT (4)
    'Estado SARLAFT': r.estado_sarlaft || '',
    'Verificación Doc.': r.verificacion_documental || '',
    'Fecha Envío SARLAFT': r.fecha_envio_sarlaft || '',
    'Fecha Respuesta SARLAFT': r.fecha_respuesta_sarlaft || '',
    // Valor + Ventana (2)
    'Valor Inmueble COP': num(r.valor_del_inmueble),
    'En Ventana Cierre': r.en_ventana_cierre ? 'Sí' : 'No',
    // Fechas (3)
    'Fecha Creación': r.fecha_creacion || '',
    'Fecha Última Modificación': r.fecha_modificacion || '',
    'Fecha Aprobación': r.fecha_aprobacion_final || '',
    // Tiempos (6)
    'Lead Time Total (días)': num(r.dias_lead_time),
    'Antigüedad Stage (días)': num(r.aging_dias),
    'Días Consignación': num(r.dias_en_consignacion),
    'Días Espera Dir.': num(r.dias_en_legal_espera),
    'Días Aprobada Dir.': num(r.dias_en_legal_aprobada),
    'Días Revisión SINCO': num(r.dias_en_revision_sinco),
    // Fechas Stage (8)
    'Entrada Consignación': r.date_entered_consignacion || '',
    'Entrada Espera Director': r.date_entered_legal_espera || '',
    'Entrada Aprobada Director': r.date_entered_legal_aprobada_dir || '',
    'Entrada Revisión SINCO': r.date_entered_revision_sinco || '',
    'Entrada Aprobado Exitoso': r.date_entered_aprobado_exitoso || '',
    'Entrada Con Novedades': r.date_entered_aprobado_novedades || '',
    'Entrada Rechazado': r.date_entered_negocio_rechazado || '',
    'Entrada Venta Caída': r.date_entered_venta_caida || '',
    // Trazabilidad (1)
    'URL HubSpot': hubspotUrl(r),
  }))
  const widths = [
    14, 32, 14, 18,
    24, 20, 14, 8, 12, 22,
    28, 18, 18, 24,
    22, 26, 26, 22,
    18, 18, 40, 10,
    16, 24, 16, 16,
    18, 16,
    16, 16, 16,
    14, 14, 14, 14, 14, 14,
    18, 18, 18, 18, 18, 18, 18, 18,
    44,
  ]
  await writeSheet(data, widths, 'Clientes Legalizados', nombreArchivo)
  toast.success(`${nombreArchivo} — ${rows.length} registros · ${Object.keys(data[0]).length} columnas`)
}

/** Rechazados + caídas. */
export async function exportRechazadosXLSX(rows: DetalleRow[]) {
  const sel = rows.filter(r => r.etapa_codigo === 'negocio_rechazado' || r.etapa_codigo === 'venta_caida')
  if (!sel.length) { toast.error('No hay rechazados en el período'); return }
  const data = sel.map(r => ({
    'ID HubSpot': r.hs_object_id || '',
    'Nombre': r.nombre_legalizacion || '',
    'Tipo': r.etapa_codigo === 'negocio_rechazado' ? 'Rechazado' : 'Venta Caída',
    'Comprador': r.nombrecomprador || '',
    'Documento 1': r.documento_comprador_1 || '',
    'Documento 2': r.documento_comprador_2 || '',
    'Proyecto': r.proyecto || '',
    'Director': r.director || '',
    'Ciudad': r.ciudad || '',
    'Valor COP': num(r.valor_del_inmueble),
    'Motivo Observación': r.motivo_de_observacion || '',
    'Canal Atribución': r.canal_atribucion || '',
    'Canal Gestión Ppal': r.canal_gestion_original || '',
    'Canal Gestión Sec.': r.canal_gestion_secundario || '',
    'SARLAFT': r.estado_sarlaft || '',
    'Decisión Final': r.decision_final || '',
    'Fecha': (r.etapa_codigo === 'venta_caida' ? r.date_entered_venta_caida : r.date_entered_negocio_rechazado) || r.fecha_aprobacion_final || '',
    'URL HubSpot': hubspotUrl(r),
  }))
  await writeSheet(data, [14, 32, 14, 28, 18, 18, 22, 22, 14, 18, 40, 18, 22, 22, 16, 18, 14, 44], 'Rechazados y Caídas', 'Conaltura_Rechazados.xlsx')
  toast.success(`Conaltura_Rechazados.xlsx — ${sel.length} registros`)
}

/** Ventana de cierre (clientes ya cargados desde /api/ventana). */
export async function exportVentanaXLSX(clientes: VentanaCliente[], file: string) {
  if (!clientes.length) return
  const data = clientes.map(c => ({
    'Proyecto': c.proyecto,
    'Director': c.director,
    'Ciudad': c.ciudad,
    'Comprador': c.nombrecomprador,
    'Documento': c.documento_comprador_1,
    'Unidad': c.numero_unidad || c.torre || '',
    'Stage': c.etapa_label,
    'Día Aprobación': c.dia_aprobacion,
    'Fecha Aprobación': c.fecha_aprobacion_final ?? '',
    'Valor COP': num(c.valor_del_inmueble),
    'Canal': c.canal_atribucion,
    'Motivo Observación': c.motivo_de_observacion,
    'URL HubSpot': hubspotUrl(c),
  }))
  await writeSheet(data, [24, 22, 14, 28, 18, 12, 16, 14, 16, 18, 18, 40, 44], 'Ventana de Cierre', file)
  toast.success(`${file} — ${clientes.length} registros`)
}

export const exportFileName = { motivo: (m: string) => `Conaltura_Motivo_${safe(m)}.xlsx`, ventanaProyecto: (p: string) => `Conaltura_Ventana_${safe(p)}.xlsx` }
