// GET /api/kpis?anio=2025&mes=6&proyecto=...&director=...&ciudad=...
// Incluye KPI de "aprobado_gerencia" (Gerencia Comercial — stage 1394950689)
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import sql, { parseFiltros, periodoActual, dimFilters } from '@/lib/db'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  try {
    const params = req.nextUrl.searchParams
    const f      = parseFiltros(params)
    const { anio, mes } = periodoActual(f)

    const dim    = dimFilters(f, 2)
    const extras = dim.sql
    const eVals  = dim.vals

    // ── KPIs resolución — todos los stages del grupo 'resolucion' ─────────
    const kpiRows = await sql(`
      SELECT
        COUNT(*)                                                           AS total_resolucion,
        COUNT(*) FILTER (WHERE etapa_codigo = 'aprobado_exitoso')          AS aprobadas_exitoso,
        COUNT(*) FILTER (WHERE etapa_codigo = 'aprobado_novedades')        AS aprobadas_novedades,
        COUNT(*) FILTER (WHERE etapa_codigo = 'aprobado_gerencia')         AS aprobadas_gerencia,
        COUNT(*) FILTER (WHERE etapa_codigo = 'negocio_rechazado')         AS rechazadas,
        -- Ventana de cierre: día >= 25 del mes (calculado en tiempo real)
        COUNT(*) FILTER (
          WHERE fecha_aprobacion_final IS NOT NULL
            AND EXTRACT(DAY FROM fecha_aprobacion_final) >= 25
            AND etapa_codigo IN ('aprobado_exitoso','aprobado_novedades','aprobado_gerencia')
        )                                                                  AS en_ventana_cierre
      FROM raw_legalizaciones
      WHERE anio  = $1
        AND mes   = $2
        AND grupo = 'resolucion'
        ${extras}
    `, [anio, mes, ...eVals])

    // ── Ventas caídas ──────────────────────────────────────────────────────
    const cDim = dimFilters(f, 2)

    const caidaRows = await sql(`
      SELECT COUNT(*) AS ventas_caidas
      FROM raw_legalizaciones
      WHERE anio_caida = $1 AND mes_caida = $2
        ${cDim.sql}
    `, [anio, mes, ...cDim.vals])

    // ── Meta ───────────────────────────────────────────────────────────────
    const metaRows = await sql(`
      SELECT meta_negocios FROM manual_metas
      WHERE anio = $1 AND mes = $2 LIMIT 1
    `, [anio, mes])

    const updRows = await sql(`SELECT MAX(updated_at) AS ts FROM raw_legalizaciones`)

    const kpi            = kpiRows[0]
    const exitoso        = Number(kpi.aprobadas_exitoso)
    const novedades      = Number(kpi.aprobadas_novedades)
    const gerencia       = Number(kpi.aprobadas_gerencia)
    // Total aprobadas = todas las resoluciones con decisión favorable
    const aprobadas      = exitoso + novedades + gerencia
    const ventana        = Number(kpi.en_ventana_cierre)
    const meta           = Number(metaRows[0]?.meta_negocios ?? 0)

    return NextResponse.json({
      total_resolucion:      Number(kpi.total_resolucion),
      aprobadas_exitoso:     exitoso,
      aprobadas_novedades:   novedades,
      aprobadas_gerencia:    gerencia,
      rechazadas:            Number(kpi.rechazadas),
      ventas_caidas:         Number(caidaRows[0].ventas_caidas),
      en_ventana_cierre:     ventana,
      pct_ventana_cierre:    aprobadas > 0
        ? parseFloat((ventana / aprobadas * 100).toFixed(1)) : 0,
      meta_negocios:         meta,
      // pct_cumplimiento: aprobadas totales / meta
      pct_cumplimiento:      meta > 0
        ? parseFloat((aprobadas / meta * 100).toFixed(1)) : 0,
      anio,
      mes,
      ultima_actualizacion:  updRows[0]?.ts ?? null,
    })
  } catch (err) {
    console.error('[/api/kpis]', err)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}
