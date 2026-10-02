// GET /api/tendencia?proyecto=...&director=...&ciudad=...&meses=14
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import sql, { parseFiltros, dimFilters } from '@/lib/db'
import { MES_NAMES } from '@/types'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  try {
    const params  = req.nextUrl.searchParams
    const f       = parseFiltros(params)
    const periodos = Math.min(60, Math.max(1, Number(params.get('meses') ?? 14) || 14))

    const dim  = dimFilters(f, 0)
    const vals = dim.vals
    const dimR = dim.sql.replace(/AND (\w+) =/g, 'AND r.$1 =')

    // Serie de resolución mensual (cohorte B)
    const resRows = await sql(`
      SELECT
        r.anio, r.mes,
        COUNT(*) FILTER (WHERE r.etapa_codigo = 'aprobado_exitoso')   AS exitosas,
        COUNT(*) FILTER (WHERE r.etapa_codigo = 'aprobado_novedades') AS con_novedades,
        COUNT(*) FILTER (WHERE r.etapa_codigo = 'aprobado_gerencia')  AS aprobado_gerencia,
        COUNT(*) FILTER (WHERE r.etapa_codigo = 'negocio_rechazado')  AS rechazadas
      FROM raw_legalizaciones r
      WHERE r.grupo = 'resolucion'
        AND r.anio IS NOT NULL
        ${dimR}
      GROUP BY r.anio, r.mes
      ORDER BY r.anio DESC, r.mes DESC
      LIMIT $${vals.length + 1}
    `, [...vals, periodos])

    // Caídas mensuales (cohorte C)
    const caidaRows = await sql(`
      SELECT
        anio_caida AS anio, mes_caida AS mes,
        COUNT(*) AS ventas_caidas
      FROM raw_legalizaciones
      WHERE anio_caida IS NOT NULL
        ${dim.sql}
      GROUP BY anio_caida, mes_caida
    `, vals)

    // Pipeline snapshot (sin fecha madre) — solo 1 número global
    const pipeRows = await sql(`
      SELECT COUNT(*) AS pipeline_activo
      FROM raw_legalizaciones
      WHERE fecha_aprobacion_final IS NULL AND grupo = 'pipeline'
        ${dim.sql}
    `, vals)

    const pipeActivo = Number(pipeRows[0].pipeline_activo)

    // Metas mensuales
    const metaRows = await sql(`SELECT anio, mes, meta_negocios FROM manual_metas ORDER BY anio, mes`)
    const metaMap  = new Map(metaRows.map(r => [`${r.anio}-${r.mes}`, Number(r.meta_negocios)]))
    const caidaMap = new Map(caidaRows.map(r => [`${r.anio}-${r.mes}`, Number(r.ventas_caidas)]))

    const meses = resRows.reverse().map(r => {
      const key        = `${r.anio}-${r.mes}`
      const exitosas   = Number(r.exitosas)
      const novedades  = Number(r.con_novedades)
      const rechazadas = Number(r.rechazadas)
      const gerencia   = Number(r.aprobado_gerencia)
      const aprobadas  = exitosas + novedades + gerencia
      const meta       = metaMap.get(key) ?? 0
      return {
        anio:             Number(r.anio),
        mes:              Number(r.mes),
        label:            `${MES_NAMES[Number(r.mes)]} ${r.anio}`,
        aprobadas,
        exitosas,
        con_novedades:    novedades,
        aprobado_gerencia: gerencia,
        rechazadas,
        ventas_caidas:    caidaMap.get(key) ?? 0,
        pipeline_activo:  pipeActivo,   // snapshot actual (igual para todos)
        meta,
        pct_cumplimiento: meta > 0 ? parseFloat((aprobadas / meta * 100).toFixed(1)) : 0,
      }
    })

    return NextResponse.json({ meses, periodos: meses.length })
  } catch (err) {
    console.error('[/api/tendencia]', err)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}
