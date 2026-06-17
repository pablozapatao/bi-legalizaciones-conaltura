// GET /api/kpis?anio=2025&mes=6&proyecto=...&director=...&ciudad=...
// Devuelve los 7 KPIs de la sección 6 del brief.
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import sql, { parseFiltros } from '@/lib/db'
import type { KpisResponse } from '@/types'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  try {
    const params = req.nextUrl.searchParams
    const f      = parseFiltros(params)

    // Período por defecto: mes actual en Colombia
    const nowCOL = new Date(new Date().toLocaleString('en-US', { timeZone: 'America/Bogota' }))
    const anio   = f.anio ?? nowCOL.getFullYear()
    const mes    = f.mes  ?? (nowCOL.getMonth() + 1)

    // ── KPIs 1-4 y 6: cohorte B (fecha_aprobacion_final en el período) ──
    const kpiRows = await sql(`
      SELECT
        COUNT(*)                                                        AS total_resolucion,
        COUNT(*) FILTER (WHERE etapa_codigo = 'aprobado_exitoso')       AS aprobadas_exitoso,
        COUNT(*) FILTER (WHERE etapa_codigo = 'aprobado_novedades')     AS aprobadas_novedades,
        COUNT(*) FILTER (WHERE etapa_codigo = 'negocio_rechazado')      AS rechazadas,
        COUNT(*) FILTER (WHERE en_ventana_cierre = TRUE)                AS en_ventana_cierre
      FROM raw_legalizaciones
      WHERE anio = $1
        AND mes  = $2
        AND grupo = 'resolucion'
        ${f.proyecto  ? "AND proyecto_limpio    = $3" : ""}
        ${f.director  ? `AND director           = $${f.proyecto ? 4 : 3}` : ""}
        ${f.ciudad    ? `AND ciudad             = $${[f.proyecto, f.director].filter(Boolean).length + 3}` : ""}
        ${f.canal_atribucion ? `AND canal_atribucion = $${[f.proyecto, f.director, f.ciudad].filter(Boolean).length + 3}` : ""}
    `, [anio, mes, ...[f.proyecto, f.director, f.ciudad, f.canal_atribucion].filter(Boolean)])

    // ── KPI 5: cohorte C (date_entered_venta_caida en el período) ───────
    const caidaRows = await sql(`
      SELECT COUNT(*) AS ventas_caidas
      FROM raw_legalizaciones
      WHERE anio_caida = $1
        AND mes_caida  = $2
        ${f.proyecto ? "AND proyecto_limpio = $3" : ""}
        ${f.director ? `AND director = $${f.proyecto ? 4 : 3}` : ""}
        ${f.ciudad   ? `AND ciudad   = $${[f.proyecto, f.director].filter(Boolean).length + 3}` : ""}
    `, [anio, mes, ...[f.proyecto, f.director, f.ciudad].filter(Boolean)])

    // ── Meta del mes (KPI 7) ─────────────────────────────────────────────
    const metaRows = await sql(`
      SELECT meta_negocios FROM manual_metas
      WHERE anio = $1 AND mes = $2
      LIMIT 1
    `, [anio, mes])

    // ── Última actualización ─────────────────────────────────────────────
    const updRows = await sql(`SELECT MAX(updated_at) AS ts FROM raw_legalizaciones`)

    const kpi        = kpiRows[0]
    const aprobadas  = Number(kpi.aprobadas_exitoso) + Number(kpi.aprobadas_novedades)
    const en_ventana = Number(kpi.en_ventana_cierre)
    const meta       = Number(metaRows[0]?.meta_negocios ?? 0)

    const response: KpisResponse = {
      total_resolucion:    Number(kpi.total_resolucion),
      aprobadas_exitoso:   Number(kpi.aprobadas_exitoso),
      aprobadas_novedades: Number(kpi.aprobadas_novedades),
      rechazadas:          Number(kpi.rechazadas),
      ventas_caidas:       Number(caidaRows[0].ventas_caidas),
      en_ventana_cierre:   en_ventana,
      pct_ventana_cierre:  aprobadas > 0 ? parseFloat((en_ventana / aprobadas * 100).toFixed(1)) : 0,
      meta_negocios:       meta,
      pct_cumplimiento:    meta > 0 ? parseFloat((aprobadas / meta * 100).toFixed(1)) : 0,
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
