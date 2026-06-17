// POST /api/metas/upsert
// Body: { anio: number, mes: number, meta_negocios: number }
// Guarda o actualiza la meta mensual desde el dashboard.
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import sql from '@/lib/db'

export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { anio, mes, meta_negocios } = body

    // Validaciones básicas
    if (!anio || !mes || meta_negocios == null) {
      return NextResponse.json(
        { error: 'Faltan campos: anio, mes, meta_negocios' },
        { status: 400 }
      )
    }
    if (mes < 1 || mes > 12) {
      return NextResponse.json({ error: 'mes debe estar entre 1 y 12' }, { status: 400 })
    }
    if (meta_negocios < 0) {
      return NextResponse.json({ error: 'meta_negocios no puede ser negativa' }, { status: 400 })
    }

    // UPSERT — inserta o actualiza si ya existe
    await sql(`
      INSERT INTO manual_metas (anio, mes, meta_negocios, updated_at)
      VALUES ($1, $2, $3, NOW())
      ON CONFLICT (anio, mes)
      DO UPDATE SET
        meta_negocios = EXCLUDED.meta_negocios,
        updated_at    = NOW()
    `, [Number(anio), Number(mes), Number(meta_negocios)])

    return NextResponse.json({
      ok:            true,
      anio:          Number(anio),
      mes:           Number(mes),
      meta_negocios: Number(meta_negocios),
    })
  } catch (err) {
    console.error('[POST /api/metas/upsert]', err)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}
