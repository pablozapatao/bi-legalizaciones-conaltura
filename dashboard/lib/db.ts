// ============================================================
// lib/db.ts — cliente Neon server-side ÚNICO
// NUNCA importar en componentes 'use client'.
// Toda conexión a la BD pasa por aquí.
// ============================================================
import { neon } from '@neondatabase/serverless'

// DATABASE_URL vive solo en el servidor (Vercel server env var, sin prefijo NEXT_PUBLIC_)
// Conexión perezosa: no se crea al importar (el build no necesita DATABASE_URL).
let _client: ReturnType<typeof neon> | null = null
function client() {
  if (!_client) {
    if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL no configurada')
    _client = neon(process.env.DATABASE_URL)
  }
  return _client
}

// Uso: await sql('SELECT ... WHERE x = $1', [valor])  → filas (objetos)
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const sql = async (query: string, params: unknown[] = []): Promise<any[]> =>
  (await client()(query, params)) as any[]

export default sql

// ── Helper: extraer filtros de los searchParams ───────────────────────────
function numOrNull(v: string | null): number | null {
  if (!v) return null
  const n = Number(v)
  return Number.isFinite(n) ? n : null
}

export function parseFiltros(params: URLSearchParams) {
  return {
    anio:             numOrNull(params.get('anio')),
    mes:              numOrNull(params.get('mes')),
    proyecto:         params.get('proyecto')  || null,
    director:         params.get('director')  || null,
    ciudad:           params.get('ciudad')    || null,
    canal_atribucion: params.get('canal_atribucion') || null,
    canal_gestion:    params.get('canal_gestion')    || null,
  }
}

// Etapas que cuentan como "aprobadas" (decisión favorable)
export const APROBADAS_SQL = `'aprobado_exitoso','aprobado_novedades','aprobado_gerencia'`

// Año/mes efectivo (por defecto el mes actual en hora Colombia)
export function periodoActual(f: ReturnType<typeof parseFiltros>): { anio: number; mes: number } {
  const nowCOL = new Date(new Date().toLocaleString('en-US', { timeZone: 'America/Bogota' }))
  return { anio: f.anio ?? nowCOL.getFullYear(), mes: f.mes ?? (nowCOL.getMonth() + 1) }
}

// Filtros de dimensión (sin anio/mes) como cláusulas "AND ..." con placeholders
// numerados a partir de `startAt + 1`. Mapea proyecto -> proyecto_limpio.
export function dimFilters(
  f: ReturnType<typeof parseFiltros>,
  startAt: number,
  opts: { canales?: boolean } = { canales: true },
): { sql: string; vals: unknown[] } {
  const vals: unknown[] = []
  const parts: string[] = []
  const add = (col: string, v: unknown) => { vals.push(v); parts.push(`AND ${col} = $${startAt + vals.length}`) }
  if (f.proyecto)  add('proyecto_limpio', f.proyecto)
  if (f.director)  add('director', f.director)
  if (f.ciudad)    add('ciudad', f.ciudad)
  if (opts.canales !== false) {
    if (f.canal_atribucion) add('canal_atribucion', f.canal_atribucion)
    if (f.canal_gestion)    add('canal_gestion_original', f.canal_gestion)
  }
  return { sql: parts.join(' '), vals }
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
