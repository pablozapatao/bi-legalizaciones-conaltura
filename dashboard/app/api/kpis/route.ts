// GET /api/kpis?anio=2025&mes=6&proyecto=...&director=...&ciudad=...
// KPI 6 — Ventana de cierre: aprobaciones con fecha_aprobacion_final >= día 25 del mes.
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import sql, { parseFiltros } from '@/lib/db'
import type { KpisResponse } from '@/types'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  try {
    const params = req.nextUrl.searchParams
    const f      = parseFiltros(params)

    const nowCOL = new Date(new Date().toLocaleString('en-US', { timeZone: 'America/Bogota' }))
    const anio   = f.anio ?? nowCOL.getFullYear()
    const mes    = f.mes  ?? (nowCOL.getMonth() + 1)

    // Filtros opcionales — se construyen de forma segura con $N
    const extraVals: unknown[] = []
    const extraWhere: string[] = []
    if (f.proyecto)         { extraVals.push(f.proyecto);         extraWhere.push(`AND proyecto_limpio = $${extraVals.length + 2}`) }
    if (f.director)         { extraVals.push(f.director);         extraWhere.push(`AND director        = $${extraVals.length + 2}`) }
    if (f.ciudad)           { extraVals.push(f.ciudad);           extraWhere.push(`AND ciudad          = $${extraVals.length + 2}`) }
    if (f.canal_atribucion) { extraVals.push(f.canal_atribucion); extraWhere.push(`AND canal_atribucion = $${extraVals.length + 2}`) }
    const extras = extraWhere.join(' ')

    // ── KPIs 1-4: cohorte B — grupo 'resolucion' en el período ──────────
    const kpiRows = await sql(`
      SELECT
        COUNT(*)                                                          AS total_resolucion,
        COUNT(*) FILTER (WHERE etapa_codigo = 'aprobado_exitoso')         AS aprobadas_exitoso,
        COUNT(*) FILTER (WHERE etapa_codigo = 'aprobado_novedades')       AS aprobadas_novedades,
        COUNT(*) FILTER (WHERE etapa_codigo = 'negocio_rechazado')        AS rechazadas,
        -- ── KPI 6 CORREGIDO ─────────────────────────────────────────────
        -- Ventana de cierre: aprobaciones con fecha_aprobacion_final >= día 25 del mes.
        -- Se calcula DIRECTAMENTE desde fecha_aprobacion_final, no desde el campo
        -- pre-calculado en_ventana_cierre (cuya lógica era distinta: ±3/4 días fin de mes).
        COUNT(*) FILTER (
          WHERE fecha_aprobacion_final IS NOT NULL
            AND EXTRACT(DAY FROM fecha_aprobacion_final) >= 25
        )                                                                 AS en_ventana_cierre
      FROM raw_legalizaciones
      WHERE anio  = $1
        AND mes   = $2
        AND grupo = 'resolucion'
        ${extras}
    `, [anio, mes, ...extraVals])

    // ── KPI 5: cohorte C — ventas caídas del período ────────────────────
    const caidaWhere: string[] = []
    const caidaVals: unknown[] = []
    if (f.proyecto) { caidaVals.push(f.proyecto); caidaWhere.push(`AND proyecto_limpio = $${caidaVals.length + 2}`) }
    if (f.director) { caidaVals.push(f.director); caidaWhere.push(`AND director        = $${caidaVals.length + 2}`) }
    if (f.ciudad)   { caidaVals.push(f.ciudad);   caidaWhere.push(`AND ciudad          = $${caidaVals.length + 2}`) }

    const caidaRows = await sql(`
      SELECT COUNT(*) AS ventas_caidas
      FROM raw_legalizaciones
      WHERE anio_caida = $1
        AND mes_caida  = $2
        ${caidaWhere.join(' ')}
    `, [anio, mes, ...caidaVals])

    // ── Meta del mes ─────────────────────────────────────────────────────
    const metaRows = await sql(`
      SELECT meta_negocios FROM manual_metas
      WHERE anio = $1 AND mes = $2
      LIMIT 1
    `, [anio, mes])

    // ── Última actualización del ETL ─────────────────────────────────────
    const updRows = await sql(`SELECT MAX(updated_at) AS ts FROM raw_legalizaciones`)

    const kpi       = kpiRows[0]
    const aprobadas = Number(kpi.aprobadas_exitoso) + Number(kpi.aprobadas_novedades)
    const ventana   = Number(kpi.en_ventana_cierre)
    const meta      = Number(metaRows[0]?.meta_negocios ?? 0)

    const response: KpisResponse = {
      total_resolucion:    Number(kpi.total_resolucion),
      aprobadas_exitoso:   Number(kpi.aprobadas_exitoso),
      aprobadas_novedades: Number(kpi.aprobadas_novedades),
      rechazadas:          Number(kpi.rechazadas),
      ventas_caidas:       Number(caidaRows[0].ventas_caidas),
      // KPI 6 corregido — día 25+ del mes
      en_ventana_cierre:   ventana,
      pct_ventana_cierre:  aprobadas > 0
        ? parseFloat((ventana / aprobadas * 100).toFixed(1))
        : 0,
      meta_negocios:       meta,
      pct_cumplimiento:    meta > 0
        ? parseFloat((aprobadas / meta * 100).toFixed(1))
        : 0,
      anio,
      mes,
      ultima_actualizacion: updRows[0]?.ts ?? null,
    }

    return NextResponse.json(response)
  } catch (err) {
    console.error('[/api/kpis]', err)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}
