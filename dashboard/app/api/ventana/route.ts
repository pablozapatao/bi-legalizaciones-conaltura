// GET /api/ventana?anio=2025&mes=6&director=...&ciudad=...&proyecto=...
// Devuelve el desglose de aprobaciones en ventana de cierre (día >= 25)
// agrupadas por proyecto, con los clientes individuales.
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import sql, { parseFiltros } from '@/lib/db'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  try {
    const params = req.nextUrl.searchParams
    const f      = parseFiltros(params)
    const nowCOL = new Date(new Date().toLocaleString('en-US', { timeZone: 'America/Bogota' }))
    const anio   = f.anio ?? nowCOL.getFullYear()
    const mes    = f.mes  ?? (nowCOL.getMonth() + 1)

    const eVals: unknown[]  = []
    const eWhere: string[]  = []
    if (f.proyecto) { eVals.push(f.proyecto); eWhere.push(`AND proyecto_limpio = $${eVals.length + 2}`) }
    if (f.director) { eVals.push(f.director); eWhere.push(`AND director        = $${eVals.length + 2}`) }
    if (f.ciudad)   { eVals.push(f.ciudad);   eWhere.push(`AND ciudad          = $${eVals.length + 2}`) }
    const extras = eWhere.join(' ')

    // ── Resumen por proyecto ───────────────────────────────────────────────
    const resumen = await sql(`
      SELECT
        proyecto_limpio                                                  AS proyecto,
        director,
        ciudad,
        COUNT(*)                                                         AS total_ventana,
        COUNT(*) FILTER (WHERE etapa_codigo = 'aprobado_exitoso')        AS exitosas,
        COUNT(*) FILTER (WHERE etapa_codigo = 'aprobado_novedades')      AS con_novedades,
        COUNT(*) FILTER (WHERE etapa_codigo = 'aprobado_gerencia')       AS gerencia,
        ROUND(AVG(EXTRACT(DAY FROM fecha_aprobacion_final)))             AS dia_promedio,
        SUM(valor_del_inmueble)                                          AS valor_total
      FROM raw_legalizaciones
      WHERE anio  = $1
        AND mes   = $2
        AND grupo = 'resolucion'
        AND etapa_codigo IN ('aprobado_exitoso','aprobado_novedades','aprobado_gerencia')
        AND EXTRACT(DAY FROM fecha_aprobacion_final) >= 25
        ${extras}
      GROUP BY proyecto_limpio, director, ciudad
      ORDER BY total_ventana DESC, proyecto_limpio
    `, [anio, mes, ...eVals])

    // ── Clientes individuales ──────────────────────────────────────────────
    const clientes = await sql(`
      SELECT
        hs_object_id,
        nombre_legalizacion,
        nombrecomprador,
        documento_comprador_1,
        proyecto_limpio                          AS proyecto,
        director,
        ciudad,
        torre,
        numero_unidad,
        etapa_codigo,
        canal_atribucion,
        valor_del_inmueble,
        fecha_aprobacion_final,
        EXTRACT(DAY FROM fecha_aprobacion_final) AS dia_aprobacion,
        motivo_de_observacion,
        hubspot_url
      FROM raw_legalizaciones
      WHERE anio  = $1
        AND mes   = $2
        AND grupo = 'resolucion'
        AND etapa_codigo IN ('aprobado_exitoso','aprobado_novedades','aprobado_gerencia')
        AND EXTRACT(DAY FROM fecha_aprobacion_final) >= 25
        ${extras}
      ORDER BY fecha_aprobacion_final DESC, proyecto_limpio
    `, [anio, mes, ...eVals])

    const STAGE_L: Record<string,string> = {
      aprobado_exitoso:'Aprobado ✓',
      aprobado_novedades:'Con Novedades',
      aprobado_gerencia:'Gerencia Comercial',
    }

    return NextResponse.json({
      total: clientes.length,
      por_proyecto: resumen.map(r => ({
        proyecto:    r.proyecto || 'Sin asignar',
        director:    r.director || '',
        ciudad:      r.ciudad   || '',
        total:       Number(r.total_ventana),
        exitosas:    Number(r.exitosas),
        con_novedades: Number(r.con_novedades),
        gerencia:    Number(r.gerencia),
        dia_promedio:Number(r.dia_promedio),
        valor_total: r.valor_total != null ? parseFloat(r.valor_total) : null,
      })),
      clientes: clientes.map(r => ({
        hs_object_id:          Number(r.hs_object_id),
        nombre_legalizacion:   r.nombre_legalizacion || '',
        nombrecomprador:       r.nombrecomprador     || '',
        documento_comprador_1: r.documento_comprador_1 || '',
        proyecto:              r.proyecto            || '',
        director:              r.director            || '',
        ciudad:                r.ciudad              || '',
        torre:                 r.torre               || '',
        numero_unidad:         r.numero_unidad       || '',
        etapa_codigo:          r.etapa_codigo,
        etapa_label:           STAGE_L[r.etapa_codigo] || r.etapa_codigo,
        canal_atribucion:      r.canal_atribucion    || '',
        valor_del_inmueble:    r.valor_del_inmueble != null ? parseFloat(r.valor_del_inmueble) : null,
        fecha_aprobacion_final:r.fecha_aprobacion_final
          ? new Date(r.fecha_aprobacion_final).toISOString().slice(0,10) : null,
        dia_aprobacion:        Number(r.dia_aprobacion),
        motivo_de_observacion: r.motivo_de_observacion || '',
        hubspot_url:           r.hubspot_url          || '',
      })),
    })
  } catch (err) {
    console.error('[/api/ventana]', err)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}
