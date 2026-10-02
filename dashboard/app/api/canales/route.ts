// GET /api/canales?anio=2025&mes=6&proyecto=...&director=...
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import sql, { parseFiltros, periodoActual, dimFilters, APROBADAS_SQL } from '@/lib/db'

export const dynamic = 'force-dynamic'

async function queryCanal(
  campo: string,
  tipo: string,
  anio: number,
  mes:  number,
  extra: string,
  vals: unknown[],
) {
  const rows = await sql(`
    SELECT
      ${campo}                                                          AS canal,
      COUNT(*) FILTER (
        WHERE etapa_codigo IN (${APROBADAS_SQL})
          AND anio=$1 AND mes=$2
      )                                                                 AS aprobadas,
      COUNT(*) FILTER (WHERE etapa_codigo='aprobado_exitoso'  AND anio=$1 AND mes=$2) AS exitosas,
      COUNT(*) FILTER (WHERE etapa_codigo='aprobado_novedades'AND anio=$1 AND mes=$2) AS con_novedades,
      COUNT(*) FILTER (WHERE etapa_codigo='negocio_rechazado' AND anio=$1 AND mes=$2) AS rechazadas,
      COUNT(*) FILTER (WHERE anio_caida=$1 AND mes_caida=$2)           AS ventas_caidas,
      COUNT(*) FILTER (WHERE grupo='pipeline' AND fecha_aprobacion_final IS NULL) AS pipeline_activo,
      ROUND(AVG(dias_consignacion_a_aprobacion) FILTER (
        WHERE anio=$1 AND mes=$2 AND grupo='resolucion'
      )::NUMERIC,1)                                                     AS avg_lead_time
    FROM raw_legalizaciones
    WHERE ${campo} IS NOT NULL AND ${campo} <> ''
      ${extra}
    GROUP BY ${campo}
    ORDER BY aprobadas DESC
  `, vals)

  const total = rows.reduce((s, r) => s + Number(r.aprobadas), 0)
  return rows.map(r => ({
    canal:           r.canal,
    tipo,
    aprobadas:       Number(r.aprobadas),
    exitosas:        Number(r.exitosas),
    con_novedades:   Number(r.con_novedades),
    rechazadas:      Number(r.rechazadas),
    ventas_caidas:   Number(r.ventas_caidas),
    pipeline_activo: Number(r.pipeline_activo),
    avg_lead_time:   r.avg_lead_time != null ? parseFloat(r.avg_lead_time) : null,
    pct_del_total:   total > 0 ? parseFloat((Number(r.aprobadas)/total*100).toFixed(1)) : 0,
  }))
}

export async function GET(req: NextRequest) {
  try {
    const f    = parseFiltros(req.nextUrl.searchParams)
    const { anio, mes } = periodoActual(f)

    // Los filtros de canal no se aplican aquí: este endpoint ya desglosa por canal
    const dim = dimFilters(f, 2, { canales: false })
    const baseVals: unknown[] = [anio, mes, ...dim.vals]
    const extra = dim.sql

    const [atr, orig, sec] = await Promise.all([
      queryCanal('canal_atribucion',        'atribucion',          anio, mes, extra, [...baseVals]),
      queryCanal('canal_gestion_original',  'gestion_original',    anio, mes, extra, [...baseVals]),
      queryCanal('canal_gestion_secundario','gestion_secundario',  anio, mes, extra, [...baseVals]),
    ])

    return NextResponse.json({
      por_atribucion:         atr,
      por_gestion_original:   orig,
      por_gestion_secundario: sec,
    })
  } catch (err) {
    console.error('[/api/canales]', err)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}
