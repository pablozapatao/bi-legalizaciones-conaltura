// GET /api/metas?anio=2025&mes=6
// Lee la meta mensual de manual_metas.
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import sql from '@/lib/db'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  try {
    const params = req.nextUrl.searchParams
    const nowCOL = new Date(new Date().toLocaleString('en-US', { timeZone: 'America/Bogota' }))
    const anio   = Number(params.get('anio') ?? nowCOL.getFullYear())
    const mes    = Number(params.get('mes')  ?? (nowCOL.getMonth() + 1))

    const rows = await sql(
      `SELECT anio, mes, meta_negocios, updated_at FROM manual_metas WHERE anio=$1 AND mes=$2 LIMIT 1`,
      [anio, mes]
    )

    if (rows.length === 0) {
      return NextResponse.json({ anio, mes, meta_negocios: 0, updated_at: null })
    }

    const r = rows[0]
    return NextResponse.json({
      anio:          Number(r.anio),
      mes:           Number(r.mes),
      meta_negocios: Number(r.meta_negocios),
      updated_at:    r.updated_at,
    })
  } catch (err) {
    console.error('[GET /api/metas]', err)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}
