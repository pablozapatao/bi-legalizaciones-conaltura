# Auditoría ETL Legalizaciones (HubSpot 2-58255488 -> Neon)

Alcance: auditoría ESTÁTICA de `etl_legalizaciones.py` y `.github/workflows/etl.yml`. No había `HUBSPOT_API_KEY`, por lo que no se ejecutó `--verify` ni `--transform`.

## No verificable sin token
- Conteos reales de registros, % de cobertura de canal_original / canal_secundario.
- Existencia real de propiedades (`--verify`), en particular `hs_v2_date_entered_1394950689` y `1378706098` (según el encargo no existen en el objeto; el código las pide igual y HubSpot las ignora, ver abajo).
- Rate limits reales de la cuenta HubSpot.
- Estado de runs: `gh run list` (autenticado) muestra los últimos 5 runs, todos `success` por `schedule`, el más reciente el 2026-09-19 20:16Z (1-2 min cada uno). No hay runs posteriores a esa fecha pese al cron cada 2 h: revisar si GitHub deshabilitó el schedule (inactividad del repo) o si el cron está pausado. Verificar en la pestaña Actions.

## Hallazgos y correcciones
1. **Fallo silencioso en `hubspot_get`**: tras 3 intentos con 429 o timeout devolvía `{}`, lo que truncaba la paginación sin error y luego se hacía TRUNCATE (pérdida de datos). Ahora lanza excepción en timeout/429 agotados y usa backoff creciente.
2. **Lotes de asociaciones/deals**: los errores se tragaban (solo `print`), dejando canales vacíos y luego cargándolos. Se añadió `hubspot_post` (reintentos para 429, 5xx, timeouts, 4 intentos) y se aborta si falla más del 10 % de lotes.
3. **Null en campos opcionales**: `item.get("properties",{})` devolvía `None` si HubSpot manda `properties: null`; `float(valor)` rompía con texto. Ahora `properties or {}`, `_to_float()` tolerante y `canal_* ... or ""`. `parse_datetime(None)` ya era seguro, así que un null en `hs_v2_date_entered_1394950689/1378706098` no rompe `transformar()`. La lógica de deals (batch associations + batch read) se mantiene.
4. **TRUNCATE e INSERT en transacciones separadas**: si `to_sql` fallaba, la tabla quedaba vacía. Ahora ambos van en una sola transacción (rollback conserva datos previos).
5. **Columna `date_entered_aprobado_gerencia` ausente en `schema.sql`** (y en el CREATE IF NOT EXISTS del ETL) pero presente en el DataFrame: `to_sql` fallaría en una BD creada solo con schema.sql. Sin tocar schema.sql, el ETL hace `ALTER TABLE ... ADD COLUMN IF NOT EXISTS` y omite con aviso cualquier columna no existente. **Recomendación**: añadirla a schema.sql (fuera de mi alcance).
6. **Cuadre 2 del diagnóstico** no sumaba `aprobado_gerencia`, generando falso "DIFERENCIA". Corregido.
7. **Logging final** (`resumen_final`): extraídos, insertados, % con canal_original, % con canal_secundario, con aprobado_gerencia, última actualización (hora Colombia), duración en minutos; falla si insertados != filas del DataFrame.
8. **Ventana de cierre**: consistente. ETL `ancla.day >= 25` sobre `fecha_aprobacion_final` (convertida a fecha Colombia) para exitoso/novedades/gerencia; `/api/kpis` y `/api/ventana` usan `EXTRACT(DAY FROM fecha_aprobacion_final) >= 25` con los mismos 3 stages. Sin cambios. Nota: el docstring de la función decía "solo exitoso y novedades"; el código incluye gerencia (alineado con API).
9. **etl.yml**: añadido step `if: failure()` que emite `::error::` con enlace al run, y `timeout-minutes: 30`. Cron `0 */2 * * *` y secrets (`HUBSPOT_API_KEY`, `DATABASE_URL` en el paso completo) correctos. Nota: crons de GitHub corren en UTC y pueden retrasarse.

## Pendientes / riesgos conocidos
- `bi_legalizaciones_final` no cuenta `aprobado_gerencia` (cnt_total_resolucion sí lo incluye): revisar si el dashboard usa esa tabla.
- `asignar_director` usa coincidencia por subcadena ("GO", "WE", "CORAL" también coincide con "CORALIA", resuelto por orden de reglas): riesgo de falsos positivos.
- Paginación: usa `paging.next.after` con limit 100 (correcto); sin límite duro de páginas. El límite del endpoint list es amplio; si el objeto superase ~10 000 no hay problema con list (no search).
- Ejecutar con token: `--verify`, `--transform`, y revisar % de canales.
