// GET /api/pipeline?anio=2025&mes=6&proyecto=...
// Cohorte A (pipeline activo) + cohorte C (caídas del mes).
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import sql, { parseFiltros, periodoActual, dimFilters } from '@/lib/db'
import { STAGE_LABELS } from '@/types'

export const dynamic = 'force-dynamic'

const PIPELINE_STAGES = ['consignacion','legal_espera','legal_aprobada_dir','revision_sinco']

export async function GET(req: NextRequest) {
  try {
    const params = req.nextUrl.searchParams
    const f      = parseFiltros(params)
    const { anio, mes } = periodoActual(f)

    // ── Pipeline activo (snapshot: sin fecha_aprobacion_final) ───────────
    const dim = dimFilters(f, 0)
    const extraWhere = [
      "fecha_aprobacion_final IS NULL",
      "grupo = 'pipeline'",
    ]
    const vals: unknown[] = dim.vals

    const pipeRows = await sql(`
      SELECT
        etapa_codigo,
        COUNT(*)                           AS count,
        ROUND(AVG(aging_dias)::NUMERIC, 1) AS aging_promedio
      FROM raw_legalizaciones
      WHERE ${extraWhere.join(' AND ')}
        ${dim.sql}
      GROUP BY etapa_codigo
      ORDER BY
        CASE etapa_codigo
          WHEN 'consignacion'       THEN 1
          WHEN 'legal_espera'       THEN 2
          WHEN 'legal_aprobada_dir' THEN 3
          WHEN 'revision_sinco'     THEN 4
          ELSE 9
        END
    `, vals)

    const totalPipeline = pipeRows.reduce((s, r) => s + Number(r.count), 0)

    // ── Caídas del mes (cohorte C) ────────────────────────────────────────
    const cDim = dimFilters(f, 2)
    const caidaVals: unknown[] = [anio, mes, ...cDim.vals]

    const caidaRows = await sql(`
      SELECT COUNT(*) AS n
      FROM raw_legalizaciones
      WHERE anio_caida = $1 AND mes_caida = $2
        ${cDim.sql}
    `, caidaVals)

    return NextResponse.json({
      total_pipeline: totalPipeline,
      stages: PIPELINE_STAGES.map(codigo => {
        const row = pipeRows.find(r => r.etapa_codigo === codigo)
        const count = Number(row?.count ?? 0)
        return {
          etapa_codigo:   codigo,
          etapa_label:    STAGE_LABELS[codigo] ?? codigo,
          count,
          pct_del_total:  totalPipeline > 0
            ? parseFloat((count / totalPipeline * 100).toFixed(1))
            : 0,
          aging_promedio: row?.aging_promedio != null
            ? parseFloat(String(row.aging_promedio))
            : null,
        }
      }),
      caidas_del_mes: Number(caidaRows[0].n),
      anio_caida: anio,
      mes_caida:  mes,
    })
  } catch (err) {
    console.error('[/api/pipeline]', err)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}
