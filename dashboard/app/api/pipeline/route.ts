// GET /api/pipeline?anio=2025&mes=6&proyecto=...
// Cohorte A (pipeline activo) + cohorte C (caídas del mes).
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import sql, { parseFiltros } from '@/lib/db'
import { STAGE_LABELS } from '@/types'

export const dynamic = 'force-dynamic'

const PIPELINE_STAGES = ['consignacion','legal_espera','legal_aprobada_dir','revision_sinco']

export async function GET(req: NextRequest) {
  try {
    const params = req.nextUrl.searchParams
    const f      = parseFiltros(params)
    const nowCOL = new Date(new Date().toLocaleString('en-US', { timeZone: 'America/Bogota' }))
    const anio   = f.anio ?? nowCOL.getFullYear()
    const mes    = f.mes  ?? (nowCOL.getMonth() + 1)

    // ── Pipeline activo (snapshot: sin fecha_aprobacion_final) ───────────
    const extraWhere = [
      "fecha_aprobacion_final IS NULL",
      "grupo = 'pipeline'",
    ]
    const vals: unknown[] = []
    if (f.proyecto) { vals.push(f.proyecto); extraWhere.push(`proyecto_limpio = $${vals.length}`) }
    if (f.director) { vals.push(f.director); extraWhere.push(`director = $${vals.length}`) }
    if (f.ciudad)   { vals.push(f.ciudad);   extraWhere.push(`ciudad = $${vals.length}`) }

    const pipeRows = await sql(`
      SELECT
        etapa_codigo,
        COUNT(*)                           AS count,
        ROUND(AVG(aging_dias)::NUMERIC, 1) AS aging_promedio
      FROM raw_legalizaciones
      WHERE ${extraWhere.join(' AND ')}
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
    const caidaVals: unknown[] = [anio, mes]
    const caidaExtra: string[] = []
    if (f.proyecto) { caidaVals.push(f.proyecto); caidaExtra.push(`proyecto_limpio = $${caidaVals.length}`) }
    if (f.director) { caidaVals.push(f.director); caidaExtra.push(`director = $${caidaVals.length}`) }

    const caidaRows = await sql(`
      SELECT COUNT(*) AS n
      FROM raw_legalizaciones
      WHERE anio_caida = $1 AND mes_caida = $2
        ${caidaExtra.length ? 'AND ' + caidaExtra.join(' AND ') : ''}
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
