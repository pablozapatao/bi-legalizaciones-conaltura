// GET /api/detalle — tabla completa con todos los campos relevantes
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import sql, { parseFiltros } from '@/lib/db'
import { STAGE_LABELS } from '@/types'

export const dynamic = 'force-dynamic'

// Semáforo de motivo_de_observacion
function motivoSemaforo(motivo: string | null): 'verde' | 'amarillo' | 'rojo' | null {
  if (!motivo) return null
  const m = motivo.toLowerCase()
  if (m.includes('sin') || m.includes('ninguno') || m.includes('aprobado')) return 'verde'
  if (m.includes('subsanab') || m.includes('pendiente') || m.includes('revisar')) return 'amarillo'
  return 'rojo'
}

export async function GET(req: NextRequest) {
  try {
    const params     = req.nextUrl.searchParams
    const f          = parseFiltros(params)
    const grupo      = params.get('grupo') ?? null
    const pagina     = Math.max(1, Number(params.get('pagina')    ?? 1))
    const por_pagina = Math.min(200, Number(params.get('por_pagina') ?? 50))
    const offset     = (pagina - 1) * por_pagina

    const nowCOL = new Date(new Date().toLocaleString('en-US', { timeZone: 'America/Bogota' }))
    const anio   = f.anio ?? nowCOL.getFullYear()
    const mes    = f.mes  ?? (nowCOL.getMonth() + 1)

    const vals: unknown[] = []
    const clauses: string[] = []

    if (grupo === 'resolucion') {
      vals.push(anio, mes)
      clauses.push(`anio = $${vals.length-1}`, `mes = $${vals.length}`, `grupo = 'resolucion'`)
    } else if (grupo === 'caida') {
      vals.push(anio, mes)
      clauses.push(`anio_caida = $${vals.length-1}`, `mes_caida = $${vals.length}`)
    } else if (grupo === 'pipeline') {
      clauses.push(`fecha_aprobacion_final IS NULL`, `grupo = 'pipeline'`)
    } else {
      vals.push(anio, mes)
      clauses.push(`(
        (anio = $${vals.length-1} AND mes = $${vals.length} AND grupo = 'resolucion')
        OR (anio_caida = $${vals.length-1} AND mes_caida = $${vals.length})
        OR (fecha_aprobacion_final IS NULL AND grupo = 'pipeline')
      )`)
    }

    if (f.proyecto)         { vals.push(f.proyecto);         clauses.push(`proyecto_limpio = $${vals.length}`) }
    if (f.director)         { vals.push(f.director);         clauses.push(`director = $${vals.length}`) }
    if (f.ciudad)           { vals.push(f.ciudad);           clauses.push(`ciudad = $${vals.length}`) }
    if (f.canal_atribucion) { vals.push(f.canal_atribucion); clauses.push(`canal_atribucion = $${vals.length}`) }
    if (f.canal_gestion)    { vals.push(f.canal_gestion);    clauses.push(`canal_gestion_original = $${vals.length}`) }

    const where = clauses.length ? clauses.join(' AND ') : 'TRUE'

    const countRows = await sql(`SELECT COUNT(*) AS n FROM raw_legalizaciones WHERE ${where}`, vals)
    const total     = Number(countRows[0].n)

    vals.push(por_pagina, offset)
    const rows = await sql(`
      SELECT
        hs_object_id,
        nombre_legalizacion,
        etapa_codigo,
        grupo,
        proyecto_limpio                    AS proyecto,
        director,
        ciudad,
        torre,
        canal_atribucion,
        canal_gestion_original,
        nombrecomprador,
        documento_comprador_1,
        valor_del_inmueble,
        fecha_aprobacion_final,
        dias_consignacion_a_aprobacion     AS dias_lead_time,
        aging_dias,
        en_ventana_cierre,
        motivo_de_observacion,
        verificacion_documental_sinco,
        estado_sarlaft,
        decision_final_legalizacion,
        invdescunidad,
        numero_unidad,
        hubspot_url,
        hs_createdate,
        date_entered_consignacion,
        date_entered_aprobado_exitoso,
        date_entered_aprobado_novedades,
        date_entered_venta_caida
      FROM raw_legalizaciones
      WHERE ${where}
      ORDER BY
        CASE grupo
          WHEN 'resolucion' THEN fecha_aprobacion_final
          WHEN 'caida'      THEN date_entered_venta_caida::date
          ELSE hs_createdate::date
        END DESC NULLS LAST,
        hs_object_id DESC
      LIMIT $${vals.length-1} OFFSET $${vals.length}
    `, vals)

    return NextResponse.json({
      rows: rows.map(r => ({
        hs_object_id:              Number(r.hs_object_id),
        nombre_legalizacion:       r.nombre_legalizacion ?? '',
        etapa_codigo:              r.etapa_codigo,
        etapa_label:               STAGE_LABELS[r.etapa_codigo] ?? r.etapa_codigo,
        grupo:                     r.grupo,
        proyecto:                  r.proyecto ?? '',
        director:                  r.director ?? '',
        ciudad:                    r.ciudad ?? '',
        torre:                     r.torre ?? '',
        canal_atribucion:          r.canal_atribucion ?? '',
        canal_gestion_original:    r.canal_gestion_original ?? '',
        nombrecomprador:           r.nombrecomprador ?? '',
        documento_comprador_1:     r.documento_comprador_1 ?? '',
        valor_del_inmueble:        r.valor_del_inmueble != null ? parseFloat(r.valor_del_inmueble) : null,
        fecha_aprobacion_final:    r.fecha_aprobacion_final
          ? new Date(r.fecha_aprobacion_final).toISOString().slice(0,10) : null,
        dias_lead_time:            r.dias_lead_time != null ? parseFloat(r.dias_lead_time) : null,
        aging_dias:                r.aging_dias     != null ? parseFloat(r.aging_dias)     : null,
        en_ventana_cierre:         Boolean(r.en_ventana_cierre),
        motivo_de_observacion:     r.motivo_de_observacion ?? '',
        motivo_semaforo:           motivoSemaforo(r.motivo_de_observacion),
        verificacion_documental:   r.verificacion_documental_sinco ?? '',
        estado_sarlaft:            r.estado_sarlaft ?? '',
        decision_final:            r.decision_final_legalizacion ?? '',
        invdescunidad:             r.invdescunidad ?? '',
        numero_unidad:             r.numero_unidad ?? '',
        hubspot_url:               r.hubspot_url ?? '',
        fecha_creacion:            r.hs_createdate
          ? new Date(r.hs_createdate).toISOString().slice(0,10) : null,
      })),
      total,
      pagina,
      por_pagina,
    })
  } catch (err) {
    console.error('[/api/detalle]', err)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}
