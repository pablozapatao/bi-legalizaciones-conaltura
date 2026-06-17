// GET /api/timeline?id=12345678
// Devuelve el recorrido completo de una legalización por los stages.
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import sql from '@/lib/db'
import { STAGE_LABELS, STAGE_ORDEN } from '@/types'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const id = req.nextUrl.searchParams.get('id')
  if (!id || isNaN(Number(id))) {
    return NextResponse.json({ error: 'id requerido (número)' }, { status: 400 })
  }

  try {
    const rows = await sql(`
      SELECT
        hs_object_id,
        nombre_legalizacion,
        proyecto_limpio             AS proyecto,
        director,
        etapa_codigo,
        grupo,
        fecha_aprobacion_final,
        dias_consignacion_a_aprobacion,
        aging_dias,
        hubspot_url,
        canal_atribucion,
        canal_gestion_original,
        nombrecomprador,
        valor_del_inmueble,
        -- Fechas de entrada a cada stage
        date_entered_consignacion,
        date_entered_legal_espera,
        date_entered_legal_aprobada_dir,
        date_entered_revision_sinco,
        date_entered_aprobado_exitoso,
        date_entered_aprobado_novedades,
        date_entered_negocio_rechazado,
        date_entered_venta_caida,
        -- Duraciones
        dias_en_consignacion,
        dias_en_legal_espera,
        dias_en_legal_aprobada_dir,
        dias_en_revision_sinco
      FROM raw_legalizaciones
      WHERE hs_object_id = $1
      LIMIT 1
    `, [Number(id)])

    if (rows.length === 0) {
      return NextResponse.json({ error: 'Legalización no encontrada' }, { status: 404 })
    }

    const r = rows[0]

    // Mapa stage → fecha de entrada
    const dateMap: Record<string, string | null> = {
      consignacion:      r.date_entered_consignacion       ? new Date(r.date_entered_consignacion).toISOString().slice(0,10) : null,
      legal_espera:      r.date_entered_legal_espera       ? new Date(r.date_entered_legal_espera).toISOString().slice(0,10) : null,
      legal_aprobada_dir:r.date_entered_legal_aprobada_dir ? new Date(r.date_entered_legal_aprobada_dir).toISOString().slice(0,10) : null,
      revision_sinco:    r.date_entered_revision_sinco     ? new Date(r.date_entered_revision_sinco).toISOString().slice(0,10) : null,
      aprobado_exitoso:  r.date_entered_aprobado_exitoso   ? new Date(r.date_entered_aprobado_exitoso).toISOString().slice(0,10) : null,
      aprobado_novedades:r.date_entered_aprobado_novedades ? new Date(r.date_entered_aprobado_novedades).toISOString().slice(0,10) : null,
      negocio_rechazado: r.date_entered_negocio_rechazado  ? new Date(r.date_entered_negocio_rechazado).toISOString().slice(0,10) : null,
      venta_caida:       r.date_entered_venta_caida        ? new Date(r.date_entered_venta_caida).toISOString().slice(0,10) : null,
    }

    const durMap: Record<string, number | null> = {
      consignacion:       r.dias_en_consignacion       != null ? parseFloat(r.dias_en_consignacion)       : null,
      legal_espera:       r.dias_en_legal_espera       != null ? parseFloat(r.dias_en_legal_espera)       : null,
      legal_aprobada_dir: r.dias_en_legal_aprobada_dir != null ? parseFloat(r.dias_en_legal_aprobada_dir) : null,
      revision_sinco:     r.dias_en_revision_sinco     != null ? parseFloat(r.dias_en_revision_sinco)     : null,
    }

    // Solo incluir stages por los que pasó (con fecha de entrada)
    const hitos = STAGE_ORDEN
      .filter(codigo => dateMap[codigo] != null)
      .map(codigo => ({
        etapa_codigo:  codigo,
        etapa_label:   STAGE_LABELS[codigo] ?? codigo,
        fecha_entrada: dateMap[codigo],
        dias_en_stage: durMap[codigo] ?? null,
        es_actual:     r.etapa_codigo === codigo,
      }))

    return NextResponse.json({
      hs_object_id:               Number(r.hs_object_id),
      nombre_legalizacion:        r.nombre_legalizacion,
      proyecto:                   r.proyecto,
      director:                   r.director,
      etapa_actual:               r.etapa_codigo,
      grupo:                      r.grupo,
      fecha_aprobacion_final:     r.fecha_aprobacion_final
        ? new Date(r.fecha_aprobacion_final).toISOString().slice(0,10) : null,
      dias_consignacion_a_aprobacion: r.dias_consignacion_a_aprobacion != null
        ? parseFloat(r.dias_consignacion_a_aprobacion) : null,
      aging_dias:      r.aging_dias != null ? parseFloat(r.aging_dias) : null,
      hubspot_url:     r.hubspot_url,
      hitos,
      canal_atribucion:       r.canal_atribucion ?? '',
      canal_gestion_original: r.canal_gestion_original ?? '',
      nombrecomprador:        r.nombrecomprador ?? '',
      valor_del_inmueble:     r.valor_del_inmueble != null ? parseFloat(r.valor_del_inmueble) : null,
    })
  } catch (err) {
    console.error('[/api/timeline]', err)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}
