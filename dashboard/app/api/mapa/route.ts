// GET /api/mapa?anio=2025&mes=6
// Datos agregados por ciudad_del_negocio para el mapa SVG.
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import sql, { parseFiltros } from '@/lib/db'

export const dynamic = 'force-dynamic'

// Coordenadas relativas (x/y) sobre el SVG del mapa de Colombia (400x600)
// Calibradas para ubicar cada ciudad visualmente en el mapa.
const CIUDAD_COORDS: Record<string, { lat: number; lng: number; svgX: number; svgY: number }> = {
  'Barranquilla': { lat: 10.96, lng: -74.80, svgX: 178, svgY: 62  },
  'Cartagena':    { lat: 10.39, lng: -75.51, svgX: 148, svgY: 80  },
  'Bogotá':       { lat:  4.71, lng: -74.07, svgX: 192, svgY: 285 },
  'Medellín':     { lat:  6.25, lng: -75.56, svgX: 160, svgY: 215 },
  'Cali':         { lat:  3.45, lng: -76.53, svgX: 148, svgY: 320 },
}

export async function GET(req: NextRequest) {
  try {
    const f    = parseFiltros(req.nextUrl.searchParams)
    const nowCOL = new Date(new Date().toLocaleString('en-US', { timeZone: 'America/Bogota' }))
    const anio = f.anio ?? nowCOL.getFullYear()
    const mes  = f.mes  ?? (nowCOL.getMonth() + 1)

    const rows = await sql(`
      SELECT
        ciudad,
        COUNT(*) FILTER (
          WHERE etapa_codigo IN ('aprobado_exitoso','aprobado_novedades')
            AND anio=$1 AND mes=$2
        )                                                        AS aprobadas,
        COUNT(*) FILTER (
          WHERE fecha_aprobacion_final IS NULL AND grupo='pipeline'
        )                                                        AS pipeline_activo,
        COUNT(*) FILTER (
          WHERE anio_caida=$1 AND mes_caida=$2
        )                                                        AS ventas_caidas,
        ROUND(AVG(dias_consignacion_a_aprobacion) FILTER (
          WHERE anio=$1 AND mes=$2 AND grupo='resolucion'
        )::NUMERIC,1)                                            AS avg_lead_time,
        COALESCE(SUM(valor_del_inmueble) FILTER (
          WHERE anio=$1 AND mes=$2 AND grupo='resolucion'
        ), 0)                                                    AS suma_valor
      FROM raw_legalizaciones
      WHERE ciudad IS NOT NULL AND ciudad <> ''
      GROUP BY ciudad
      ORDER BY aprobadas DESC
    `, [anio, mes])

    const ciudades = rows.map(r => {
      const coords = CIUDAD_COORDS[r.ciudad] ?? { lat: 4, lng: -74, svgX: 190, svgY: 290 }
      return {
        ciudad:          r.ciudad,
        lat:             coords.lat,
        lng:             coords.lng,
        svgX:            coords.svgX,
        svgY:            coords.svgY,
        aprobadas:       Number(r.aprobadas),
        pipeline_activo: Number(r.pipeline_activo),
        ventas_caidas:   Number(r.ventas_caidas),
        avg_lead_time:   r.avg_lead_time != null ? parseFloat(r.avg_lead_time) : null,
        suma_valor:      Number(r.suma_valor),
      }
    })

    return NextResponse.json({ ciudades })
  } catch (err) {
    console.error('[/api/mapa]', err)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}
