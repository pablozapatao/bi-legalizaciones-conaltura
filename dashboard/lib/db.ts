// ============================================================
// lib/db.ts — cliente Neon server-side ÚNICO
// NUNCA importar en componentes 'use client'.
// Toda conexión a la BD pasa por aquí.
// ============================================================
import { neon } from '@neondatabase/serverless'

// DATABASE_URL vive solo en el servidor (Vercel server env var, sin prefijo NEXT_PUBLIC_)
const sql = neon(process.env.DATABASE_URL!)

export default sql

// ── Helper: extraer filtros de los searchParams ───────────────────────────
export function parseFiltros(params: URLSearchParams) {
  return {
    anio:             params.get('anio')      ? Number(params.get('anio'))  : null,
    mes:              params.get('mes')       ? Number(params.get('mes'))   : null,
    proyecto:         params.get('proyecto')  || null,
    director:         params.get('director')  || null,
    ciudad:           params.get('ciudad')    || null,
    canal_atribucion: params.get('canal_atribucion') || null,
    canal_gestion:    params.get('canal_gestion')    || null,
  }
}

// ── Helper: construir cláusulas WHERE dinámicas ───────────────────────────
// Devuelve { clauses: string[], values: unknown[] } para interpolación segura.
// USO:
//   const { where, vals } = buildWhere(filtros, 'r')
//   sql(`SELECT ... FROM raw_legalizaciones r WHERE ${where}`, vals)
//
// IMPORTANTE: @neondatabase/serverless usa $1/$2/... como placeholders.
// Esta función los genera en orden.
export function buildWhere(
  f: ReturnType<typeof parseFiltros>,
  alias = '',
  extra: string[] = [],   // cláusulas fijas adicionales (sin params)
): { where: string; vals: unknown[] } {
  const col = (c: string) => alias ? `${alias}.${c}` : c
  const clauses: string[] = [...extra]
  const vals: unknown[]   = []

  if (f.anio)             { vals.push(f.anio);             clauses.push(`${col('anio')} = $${vals.length}`) }
  if (f.mes)              { vals.push(f.mes);              clauses.push(`${col('mes')} = $${vals.length}`) }
  if (f.proyecto)         { vals.push(f.proyecto);         clauses.push(`${col('proyecto_limpio')} = $${vals.length}`) }
  if (f.director)         { vals.push(f.director);         clauses.push(`${col('director')} = $${vals.length}`) }
  if (f.ciudad)           { vals.push(f.ciudad);           clauses.push(`${col('ciudad')} = $${vals.length}`) }
  if (f.canal_atribucion) { vals.push(f.canal_atribucion); clauses.push(`${col('canal_atribucion')} = $${vals.length}`) }
  if (f.canal_gestion)    { vals.push(f.canal_gestion);    clauses.push(`${col('canal_gestion_original')} = $${vals.length}`) }

  return {
    where: clauses.length ? clauses.join(' AND ') : 'TRUE',
    vals,
  }
}
