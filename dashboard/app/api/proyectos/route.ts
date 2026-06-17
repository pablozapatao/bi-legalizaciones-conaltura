// GET /api/proyectos?anio=2025&mes=6&director=...&ciudad=...
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import sql, { parseFiltros } from '@/lib/db'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  try {
    const f    = parseFiltros(req.nextUrl.searchParams)
    const nowCOL = new Date(new Date().toLocaleString('en-US', { timeZone: 'America/Bogota' }))
    const anio = f.anio ?? nowCOL.getFullYear()
    const mes  = f.mes  ?? (nowCOL.getMonth() + 1)

    const vals: unknown[] = [anio, mes]
    const extra: string[] = []
    if (f.director)         { vals.push(f.director);         extra.push(`director = $${vals.length}`) }
    if (f.ciudad)           { vals.push(f.ciudad);           extra.push(`ciudad = $${vals.length}`) }
    if (f.canal_atribucion) { vals.push(f.canal_atribucion); extra.push(`canal_atribucion = $${vals.length}`) }

    const rows = await sql(`
      SELECT
        proyecto_limpio                                                     AS proyecto,
        director,
        ciudad,
        COUNT(*) FILTER (WHERE etapa_codigo IN ('aprobado_exitoso','aprobado_novedades')) AS aprobadas,
        COUNT(*) FILTER (WHERE etapa_codigo = 'aprobado_exitoso')           AS exitosas,
        COUNT(*) FILTER (WHERE etapa_codigo = 'aprobado_novedades')         AS con_novedades,
        COUNT(*) FILTER (WHERE etapa_codigo = 'negocio_rechazado')          AS rechazadas,
        SUM(CASE WHEN anio_caida=$1 AND mes_caida=$2 THEN 1 ELSE 0 END)     AS ventas_caidas,
        COUNT(*) FILTER (WHERE grupo='pipeline' AND fecha_aprobacion_final IS NULL) AS pipeline_activo,
        COALESCE(SUM(valor_del_inmueble) FILTER (
          WHERE anio=$1 AND mes=$2 AND grupo='resolucion'
        ), 0)                                                                AS suma_valor_inmueble,
        ROUND(AVG(dias_consignacion_a_aprobacion) FILTER (
          WHERE anio=$1 AND mes=$2
        )::NUMERIC, 1)                                                       AS avg_lead_time,
        ROUND(PERCENTILE_CONT(0.5) WITHIN GROUP (
          ORDER BY dias_consignacion_a_aprobacion
        ) FILTER (WHERE anio=$1 AND mes=$2)::NUMERIC, 1)                     AS p50_lead_time
      FROM raw_legalizaciones
      WHERE (
        (anio = $1 AND mes = $2 AND grupo = 'resolucion')
        OR (fecha_aprobacion_final IS NULL AND grupo = 'pipeline')
        OR (anio_caida = $1 AND mes_caida = $2)
      )
      ${extra.length ? 'AND ' + extra.join(' AND ') : ''}
      GROUP BY proyecto_limpio, director, ciudad
      ORDER BY aprobadas DESC, proyecto_limpio
    `, vals)

    const totalAprobadas = rows.reduce((s, r) => s + Number(r.aprobadas), 0)

    return NextResponse.json({
      proyectos: rows.map(r => ({
        proyecto:            r.proyecto,
        director:            r.director,
        ciudad:              r.ciudad,
        aprobadas:           Number(r.aprobadas),
        exitosas:            Number(r.exitosas),
        con_novedades:       Number(r.con_novedades),
        rechazadas:          Number(r.rechazadas),
        ventas_caidas:       Number(r.ventas_caidas),
        pipeline_activo:     Number(r.pipeline_activo),
        pct_del_total:       totalAprobadas > 0
          ? parseFloat((Number(r.aprobadas) / totalAprobadas * 100).toFixed(1))
          : 0,
        suma_valor_inmueble: Number(r.suma_valor_inmueble),
        avg_lead_time:       r.avg_lead_time != null ? parseFloat(r.avg_lead_time) : null,
        p50_lead_time:       r.p50_lead_time != null ? parseFloat(r.p50_lead_time) : null,
      })),
      total_aprobadas: totalAprobadas,
    })
  } catch (err) {
    console.error('[/api/proyectos]', err)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}
