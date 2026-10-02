// GET /api/tiempos?anio=2025&mes=6&proyecto=...&director=...&ciudad=...
// Devuelve tiempos por stage, por proyecto, y global.
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import sql, { parseFiltros, periodoActual, dimFilters } from '@/lib/db'
import { STAGE_LABELS } from '@/types'

export const dynamic = 'force-dynamic'

// Semáforo de lead time basado en percentiles globales
function semaforo(avg: number | null, p50Global: number): 'verde' | 'amarillo' | 'rojo' | null {
  if (avg == null) return null
  if (avg <= p50Global * 1.2) return 'verde'
  if (avg <= p50Global * 1.8) return 'amarillo'
  return 'rojo'
}

export async function GET(req: NextRequest) {
  try {
    const f    = parseFiltros(req.nextUrl.searchParams)
    const { anio, mes } = periodoActual(f)

    const dim = dimFilters(f, 2)
    const baseVals: unknown[] = [anio, mes, ...dim.vals]
    const extraClause = dim.sql

    // ── Tiempos por stage ─────────────────────────────────────────────────
    const stageRows = await sql(`
      SELECT
        'consignacion'       AS stage,
        ROUND(AVG(dias_en_consignacion)::NUMERIC,1)      AS avg_dias,
        ROUND(PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY dias_en_consignacion)::NUMERIC,1) AS p50,
        ROUND(PERCENTILE_CONT(0.9) WITHIN GROUP (ORDER BY dias_en_consignacion)::NUMERIC,1) AS p90,
        COUNT(dias_en_consignacion) AS n
      FROM raw_legalizaciones
      WHERE anio=$1 AND mes=$2 ${extraClause}
      UNION ALL
      SELECT
        'legal_espera',
        ROUND(AVG(dias_en_legal_espera)::NUMERIC,1),
        ROUND(PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY dias_en_legal_espera)::NUMERIC,1),
        ROUND(PERCENTILE_CONT(0.9) WITHIN GROUP (ORDER BY dias_en_legal_espera)::NUMERIC,1),
        COUNT(dias_en_legal_espera)
      FROM raw_legalizaciones
      WHERE anio=$1 AND mes=$2 ${extraClause}
      UNION ALL
      SELECT
        'legal_aprobada_dir',
        ROUND(AVG(dias_en_legal_aprobada_dir)::NUMERIC,1),
        ROUND(PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY dias_en_legal_aprobada_dir)::NUMERIC,1),
        ROUND(PERCENTILE_CONT(0.9) WITHIN GROUP (ORDER BY dias_en_legal_aprobada_dir)::NUMERIC,1),
        COUNT(dias_en_legal_aprobada_dir)
      FROM raw_legalizaciones
      WHERE anio=$1 AND mes=$2 ${extraClause}
      UNION ALL
      SELECT
        'revision_sinco',
        ROUND(AVG(dias_en_revision_sinco)::NUMERIC,1),
        ROUND(PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY dias_en_revision_sinco)::NUMERIC,1),
        ROUND(PERCENTILE_CONT(0.9) WITHIN GROUP (ORDER BY dias_en_revision_sinco)::NUMERIC,1),
        COUNT(dias_en_revision_sinco)
      FROM raw_legalizaciones
      WHERE anio=$1 AND mes=$2 ${extraClause}
    `, baseVals)

    // ── Global ────────────────────────────────────────────────────────────
    const globalRows = await sql(`
      SELECT
        ROUND(AVG(dias_consignacion_a_aprobacion)::NUMERIC,1)      AS avg_lead,
        ROUND(PERCENTILE_CONT(0.5) WITHIN GROUP
          (ORDER BY dias_consignacion_a_aprobacion)::NUMERIC,1)     AS p50_lead,
        ROUND(PERCENTILE_CONT(0.9) WITHIN GROUP
          (ORDER BY dias_consignacion_a_aprobacion)::NUMERIC,1)     AS p90_lead
      FROM raw_legalizaciones
      WHERE anio=$1 AND mes=$2 AND grupo='resolucion'
        ${extraClause}
    `, baseVals)

    const p50Global = parseFloat(globalRows[0]?.p50_lead ?? '15')

    // ── Por proyecto ──────────────────────────────────────────────────────
    const proyRows = await sql(`
      SELECT
        proyecto_limpio  AS proyecto,
        director,
        COUNT(*) FILTER (WHERE dias_consignacion_a_aprobacion IS NOT NULL) AS n,
        ROUND(AVG(dias_consignacion_a_aprobacion)::NUMERIC,1)      AS avg_lead,
        ROUND(PERCENTILE_CONT(0.5) WITHIN GROUP
          (ORDER BY dias_consignacion_a_aprobacion)::NUMERIC,1)     AS p50_lead,
        ROUND(PERCENTILE_CONT(0.9) WITHIN GROUP
          (ORDER BY dias_consignacion_a_aprobacion)::NUMERIC,1)     AS p90_lead,
        ROUND(MIN(dias_consignacion_a_aprobacion)::NUMERIC,1)       AS min_lead,
        ROUND(MAX(dias_consignacion_a_aprobacion)::NUMERIC,1)       AS max_lead
      FROM raw_legalizaciones
      WHERE anio=$1 AND mes=$2 AND grupo='resolucion'
        ${extraClause}
      GROUP BY proyecto_limpio, director
      HAVING COUNT(*) FILTER (WHERE dias_consignacion_a_aprobacion IS NOT NULL) > 0
      ORDER BY avg_lead DESC NULLS LAST
    `, baseVals)

    return NextResponse.json({
      por_stage: stageRows.map(r => ({
        stage:    r.stage,
        label:    STAGE_LABELS[r.stage] ?? r.stage,
        avg_dias: r.avg_dias != null ? parseFloat(r.avg_dias) : null,
        p50_dias: r.p50     != null ? parseFloat(r.p50)     : null,
        p90_dias: r.p90     != null ? parseFloat(r.p90)     : null,
        n:        Number(r.n),
      })),
      por_proyecto: proyRows.map(r => {
        const avg = r.avg_lead != null ? parseFloat(r.avg_lead) : null
        return {
          proyecto:      r.proyecto,
          director:      r.director,
          n:             Number(r.n),
          avg_lead_time: avg,
          p50_lead_time: r.p50_lead != null ? parseFloat(r.p50_lead) : null,
          p90_lead_time: r.p90_lead != null ? parseFloat(r.p90_lead) : null,
          min_lead_time: r.min_lead != null ? parseFloat(r.min_lead) : null,
          max_lead_time: r.max_lead != null ? parseFloat(r.max_lead) : null,
          semaforo:      semaforo(avg, p50Global),
        }
      }),
      global: {
        avg_lead_time: globalRows[0]?.avg_lead != null ? parseFloat(globalRows[0].avg_lead) : null,
        p50_lead_time: globalRows[0]?.p50_lead != null ? parseFloat(globalRows[0].p50_lead) : null,
        p90_lead_time: globalRows[0]?.p90_lead != null ? parseFloat(globalRows[0].p90_lead) : null,
      },
    })
  } catch (err) {
    console.error('[/api/tiempos]', err)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}
