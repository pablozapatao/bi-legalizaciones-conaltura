"""
🏢 CONALTURA — ETL LEGALIZACIONES v2.0
================================================================
OBJETO:    Legalizaciones de Venta (objectTypeId = 2-58255488)
BASE DE DATOS: Neon (Postgres serverless)
AUTOR:     Data Engineering Team
FECHA:     2026

CAMBIOS v2.0 vs v1.0:
  - Ventana de cierre (KPI 6): usa date_entered del stage de aprobación
    como ancla principal (Plan A). Fallback a fecha_aprobacion_final solo
    si el campo date_entered está vacío (Plan B).
  - Diagnóstico transform_all: distribución completa por stage individual
    + resumen de tiempos promedio/mediana de lead time por proyecto.
  - Nuevo modo --transform: extrae + transforma + diagnóstico, sin BD.
    Ideal para validar la transformación antes de cargar.

MODOS DE EJECUCIÓN:
  python etl_legalizaciones.py              → ETL completo (producción)
  python etl_legalizaciones.py --muestra    → 5 registros + verificación HubSpot
  python etl_legalizaciones.py --verify     → Solo verifica propiedades (sin BD)
  python etl_legalizaciones.py --transform  → Extrae todo + transforma + diagnóstico
"""

import os
import re
import sys
import json
import time
import requests
import pandas as pd
from sqlalchemy import create_engine, text
from datetime import datetime, date, timezone, timedelta
from typing import List, Dict, Optional
from zoneinfo import ZoneInfo

# ==========================================
# MODO DE EJECUCIÓN
# ==========================================
MODO_MUESTRA   = "--muestra"   in sys.argv
MODO_VERIFY    = "--verify"    in sys.argv
MODO_TRANSFORM = "--transform" in sys.argv   # NUEVO: solo transforma, sin carga
LIMITE_MUESTRA = 5

# ==========================================
# ZONA HORARIA COLOMBIA
# ==========================================
TZ_COLOMBIA = ZoneInfo("America/Bogota")  # UTC-5

# ==========================================
# CONFIGURACIÓN
# ==========================================
HUBSPOT_TOKEN = os.environ.get("HUBSPOT_API_KEY", "")
PORTAL_ID     = "47845317"  # fallback; se verifica con la API

DB_URI = None
if not MODO_VERIFY and not MODO_TRANSFORM:
    DB_USER     = os.environ.get("DB_USER", "")
    DB_PASSWORD = os.environ.get("DB_PASSWORD", "")
    DB_HOST     = os.environ.get("DB_HOST", "")
    if DB_USER and DB_PASSWORD and DB_HOST:
        DB_URI = f"postgresql://{DB_USER}:{DB_PASSWORD}@{DB_HOST}:5432/postgres?sslmode=require"

# ==========================================
# MAPEO DE STAGES — OFICIAL
# ==========================================
STAGE_MAP = {
    "1315416588": {"codigo": "consignacion",       "grupo": "pipeline",   "label": "Negocios con Consignación"},
    "1315313434": {"codigo": "legal_espera",        "grupo": "pipeline",   "label": "Legalización en Espera por Director"},
    "1315313435": {"codigo": "legal_aprobada_dir",  "grupo": "pipeline",   "label": "Legalización Aprobada por Director"},
    "1315574198": {"codigo": "revision_sinco",      "grupo": "pipeline",   "label": "Negocio por Revisar en SINCO"},
    "1315574199": {"codigo": "aprobado_exitoso",    "grupo": "resolucion", "label": "Aprobado Exitoso"},
    "1345851003": {"codigo": "aprobado_novedades",  "grupo": "resolucion", "label": "Aprobado con Novedades"},
    "1315574200": {"codigo": "negocio_rechazado",   "grupo": "resolucion", "label": "Negocio Rechazado"},
    "1378706098": {"codigo": "venta_caida",         "grupo": "caida",      "label": "Negocios Fallidos - Venta Caída"},
}

# Orden lógico del pipeline para diagnóstico
STAGE_ORDEN = [
    "consignacion", "legal_espera", "legal_aprobada_dir", "revision_sinco",
    "aprobado_exitoso", "aprobado_novedades", "negocio_rechazado", "venta_caida",
]

DATE_ENTERED_FIELDS = {
    "1315416588": "hs_v2_date_entered_1315416588",
    "1315313434": "hs_v2_date_entered_1315313434",
    "1315313435": "hs_v2_date_entered_1315313435",
    "1315574198": "hs_v2_date_entered_1315574198",
    "1315574199": "hs_v2_date_entered_1315574199",
    "1345851003": "hs_v2_date_entered_1345851003",
    "1315574200": "hs_v2_date_entered_1315574200",
    "1378706098": "hs_v2_date_entered_1378706098",
}

# Propiedades a extraer del objeto Legalización
LEGAL_PROPS = [
    "hs_object_id", "nombre_de_legalizaci_n",
    "hs_pipeline_stage",
    "decision_final_legalizacion", "verificacion_documental_sinco",
    "motivo_de_observacion", "estado_sarlaft",
    "fecha_aprobacion_final", "fecha_envio_sarlaft", "fecha_respuesta_sarlaft",
    "lista_proyectos_negocios_sinco", "proyecto",
    "ciudad_del_negocio", "torre",
    "valor_del_inmueble", "tipo_de_cuenta_de_consignacion_de_separacion",
    "nombrecomprador", "documento_comprador_1", "documento_comprador_2",
    "propietario_del_negocio", "hubspot_owner_id",
    "id_negocio_comercial_origen",
    "hs_v2_time_in_current_stage", "hs_createdate", "hs_lastmodifieddate",
    # Fechas de entrada a cada stage
    "hs_v2_date_entered_1315416588",
    "hs_v2_date_entered_1315313434",
    "hs_v2_date_entered_1315313435",
    "hs_v2_date_entered_1315574198",
    "hs_v2_date_entered_1315574199",
    "hs_v2_date_entered_1345851003",
    "hs_v2_date_entered_1315574200",
    "hs_v2_date_entered_1378706098",
]

DEAL_PROPS = [
    "dealname", "dealstage",
    "canal_de_atribucion_conaltura_negocio",
    "canal_de_gestion_comercial_original_negocio",
    "canal_de_gestion_comercial_secundario_negocio",
    "numero_de_la_unidad_del_proyecto___negocio_conaltura",
    "invdescunidad",
    "lista_proyectos_negocios_sinco",
    "nombre_de_proyecto___negocio",
]


# ==========================================
# 🔍 VERIFICACIÓN DE PROPIEDADES
# ==========================================
def verificar_propiedades_objeto_legal() -> Dict:
    """Consulta la API de propiedades y reporta qué date_entered existen."""
    print("\n" + "=" * 70)
    print("🔍 VERIFICACIÓN DE PROPIEDADES EN HUBSPOT")
    print("=" * 70)
    headers = {"Authorization": f"Bearer {HUBSPOT_TOKEN}"}
    resultado = {
        "date_entered_encontrados": [],
        "date_entered_faltantes":   [],
        "time_in_stage_existe":     False,
        "invdescunidad_deal":       None,
        "portal_id_verificado":     None,
    }

    # Portal ID
    print("\n📋 1. Verificando Portal ID...")
    try:
        r = requests.get("https://api.hubspot.com/account-info/v3/details",
                         headers=headers, timeout=15)
        if r.status_code == 200:
            portal = r.json().get("portalId")
            resultado["portal_id_verificado"] = portal
            print(f"   ✅ Portal ID confirmado: {portal}")
    except Exception as e:
        print(f"   ⚠️  Error: {e}")

    # Propiedades del objeto Legalización
    print("\n📋 2. Propiedades del objeto 2-58255488...")
    try:
        r = requests.get("https://api.hubapi.com/crm/v3/properties/2-58255488",
                         headers=headers, timeout=30)
        if r.status_code == 200:
            nombres = [p["name"] for p in r.json().get("results", [])]
            print(f"   ✅ {len(nombres)} propiedades encontradas")
            print("\n   📅 hs_v2_date_entered_ por stage:")
            for sid, fname in DATE_ENTERED_FIELDS.items():
                label = STAGE_MAP[sid]["label"]
                if fname in nombres:
                    resultado["date_entered_encontrados"].append(fname)
                    print(f"   ✅ {fname}  ← {label}")
                else:
                    resultado["date_entered_faltantes"].append(fname)
                    print(f"   ❌ {fname}  ← {label} — NO EXISTE")
            resultado["time_in_stage_existe"] = "hs_v2_time_in_current_stage" in nombres
            print(f"\n   hs_v2_time_in_current_stage: {'✅' if resultado['time_in_stage_existe'] else '❌'}")
    except Exception as e:
        print(f"   ❌ {e}")

    # invdescunidad en Deals
    print("\n📋 3. invdescunidad en Deals...")
    try:
        r2 = requests.get("https://api.hubapi.com/crm/v3/properties/deals/invdescunidad",
                          headers=headers, timeout=15)
        if r2.status_code == 200:
            resultado["invdescunidad_deal"] = r2.json().get("name")
            print(f"   ✅ Encontrado: {resultado['invdescunidad_deal']}")
        else:
            print(f"   ⚠️  No encontrado con ese nombre ({r2.status_code})")
    except Exception as e:
        print(f"   ❌ {e}")

    print("\n" + "=" * 70)
    return resultado


# ==========================================
# 🔥 LIMPIEZA Y ASIGNACIÓN — igual que ETL de Deals
# ==========================================
def limpiar_nombre_proyecto(nombre: Optional[str]) -> str:
    if not nombre:
        return "SIN ASIGNAR"
    n = re.sub(r'^\s*\d+\s*[-–—]?\s*', '', nombre)
    n = re.sub(r'\b[Vv][Ee][Nn][Tt][Aa][Ss]?\b\s*[-–—]?\s*', '', n, flags=re.IGNORECASE)
    n = re.sub(r'^\s*[-–—]\s*', '', n)
    n = re.sub(r'\s+', ' ', n).strip().upper()
    return n if n else nombre.strip().upper() if nombre else "SIN ASIGNAR"


def normalizar_para_comparacion(nombre: str) -> str:
    if not nombre:
        return ""
    acentos = {'Á':'A','É':'E','Í':'I','Ó':'O','Ú':'U',
                'á':'a','é':'e','í':'i','ó':'o','ú':'u',
                'Ñ':'N','ñ':'n','Ü':'U','ü':'u'}
    r = nombre.upper()
    for a, s in acentos.items():
        r = r.replace(a, s)
    return r.strip()


def asignar_director(proyecto: Optional[str]) -> str:
    if not proyecto:
        return "SIN ASIGNAR"
    n = normalizar_para_comparacion(proyecto)
    if any(x in n for x in ["BAVARO","SENZA","CATARA","ANDES","KANTU","KANTÚ","NANTIA","NANTIAA"]):
        return "Alba Luz Consuegra"
    if any(x in n for x in ["CORALIA","NATIVA","DIPORTO"]):
        return "Carolina Cárdenas"
    if any(x in n for x in ["ALMENDRO","CORAL","ESMERALDA","CUSPIDE","CÚSPIDE","GO","MEETY",
                              "AMARA","CANARIAS","INDIGO","NAVARRA","INDIGÓ","INDIGOO"]):
        return "Ingrid Marcela Matta"
    if any(x in n for x in ["CATALANA","POLANCO","SOLEI","BORA","MISTRAL","TORRES DEL CAMPO"]):
        return "Leonardo Villegas"
    if any(x in n for x in ["PRATO","LIVORNO","TIRRENA","CAMPURA","FORESTA",
                              "AZZURI","AZZURRI","TOSCANA","CAOBA"]):
        return "Natalia Giraldo"
    if any(x in n for x in ["FAROVERDE","FARO VERDE","PALMA","CRISTA","MUNAY",
                              "KIVA","WE SENIOR","WE","SENIOR"]):
        return "Patricia Herrera"
    return "SIN ASIGNAR"


def get_ciudad_strict(proyecto: Optional[str]) -> str:
    if not proyecto:
        return "Otras"
    n = normalizar_para_comparacion(proyecto)
    if any(x in n for x in ["CORALIA","NATIVA","DIPORTO"]):
        return "Cartagena"
    if any(x in n for x in ["BAVARO","CATARA","SENZA","ANDES","KANTU","NANTIA"]):
        return "Barranquilla"
    if any(x in n for x in ["ALMENDRO","CANARIAS","CORAL","CUSPIDE","GO",
                              "MEETY","ESMERALDA","NAVARRA","INDIGO"]):
        return "Bogotá"
    if any(x in n for x in ["AMARA"]):
        return "Cali"
    return "Medellín"


# ==========================================
# 🔌 CLIENTE HUBSPOT
# ==========================================
def hubspot_get(url: str, params: Dict = None, timeout: int = 90) -> Dict:
    headers = {"Authorization": f"Bearer {HUBSPOT_TOKEN}"}
    for intento in range(3):
        try:
            r = requests.get(url, headers=headers, params=params or {}, timeout=timeout)
            if r.status_code == 429:
                wait = int(r.headers.get("Retry-After", "10"))
                print(f"   ⏳ Rate limit. Esperando {wait}s...")
                time.sleep(wait)
                continue
            r.raise_for_status()
            return r.json()
        except requests.exceptions.Timeout:
            print(f"   ⚠️  Timeout en intento {intento+1}/3")
            time.sleep(5)
        except requests.exceptions.RequestException as e:
            if intento == 2:
                raise
            print(f"   ⚠️  Error en intento {intento+1}/3: {e}")
            time.sleep(3)
    return {}


def get_portal_id_api() -> str:
    try:
        data = hubspot_get("https://api.hubspot.com/account-info/v3/details", timeout=15)
        return str(data.get("portalId", PORTAL_ID))
    except Exception:
        return PORTAL_ID


# ==========================================
# 📥 EXTRACCIÓN — LEGALIZACIONES
# ==========================================
def fetch_legalizaciones(limite: Optional[int] = None) -> List[Dict]:
    print("⏳ Extrayendo legalizaciones de HubSpot (2-58255488)...")
    url      = "https://api.hubapi.com/crm/v3/objects/2-58255488"
    props_str = ",".join(LEGAL_PROPS)
    all_records, after, page = [], None, 0

    while True:
        params = {"limit": 100, "properties": props_str, "archived": "false"}
        if after:
            params["after"] = after

        data    = hubspot_get(url, params)
        results = data.get("results", [])
        all_records.extend(results)
        page += 1
        print(f"  📄 Página {page}: {len(results)} registros (Total: {len(all_records)})")

        if limite and len(all_records) >= limite:
            all_records = all_records[:limite]
            print(f"  🔍 MODO MUESTRA: limitado a {limite} registros")
            break

        after = data.get("paging", {}).get("next", {}).get("after")
        if not after:
            break

    print(f"✅ Extracción completada: {len(all_records)} legalizaciones\n")
    return all_records


# ==========================================
# 📥 EXTRACCIÓN — ASOCIACIONES → DEALS
# ==========================================
def fetch_associations_to_deals(legal_ids: List[str]) -> Dict[str, str]:
    print("⏳ Resolviendo asociaciones Legalización → Deal...")
    url = "https://api.hubapi.com/crm/v4/associations/2-58255488/deals/batch/read"
    headers = {"Authorization": f"Bearer {HUBSPOT_TOKEN}", "Content-Type": "application/json"}
    legal_to_deal = {}
    BATCH = 100

    for i in range(0, len(legal_ids), BATCH):
        lote    = legal_ids[i:i + BATCH]
        payload = {"inputs": [{"id": lid} for lid in lote]}
        try:
            r = requests.post(url, headers=headers, json=payload, timeout=60)
            if r.status_code == 429:
                time.sleep(int(r.headers.get("Retry-After", "10")))
                r = requests.post(url, headers=headers, json=payload, timeout=60)
            r.raise_for_status()
            for item in r.json().get("results", []):
                fid    = str(item.get("from", {}).get("id", ""))
                to_lst = item.get("to", [])
                if to_lst:
                    did = str(to_lst[0].get("toObjectId", ""))
                    if did:
                        legal_to_deal[fid] = did
        except Exception as e:
            print(f"   ⚠️  Error en lote {i//BATCH + 1}: {e}")
            time.sleep(2)

        if (i // BATCH + 1) % 5 == 0:
            print(f"  📦 {min(i+BATCH, len(legal_ids))}/{len(legal_ids)} ids procesados...")

    print(f"✅ Asociaciones: {len(legal_to_deal)}/{len(legal_ids)} legalizaciones tienen Deal\n")
    return legal_to_deal


# ==========================================
# 📥 EXTRACCIÓN — DEALS ENRIQUECIMIENTO
# ==========================================
def fetch_deals_by_ids(deal_ids: List[str]) -> Dict[str, Dict]:
    if not deal_ids:
        return {}
    print(f"⏳ Enriqueciendo desde {len(deal_ids)} deals asociados...")
    url     = "https://api.hubapi.com/crm/v3/objects/deals/batch/read"
    headers = {"Authorization": f"Bearer {HUBSPOT_TOKEN}", "Content-Type": "application/json"}
    deals_map = {}
    BATCH = 100

    for i in range(0, len(deal_ids), BATCH):
        lote    = deal_ids[i:i + BATCH]
        payload = {"properties": DEAL_PROPS, "inputs": [{"id": did} for did in lote]}
        try:
            r = requests.post(url, headers=headers, json=payload, timeout=60)
            if r.status_code == 429:
                time.sleep(int(r.headers.get("Retry-After", "10")))
                r = requests.post(url, headers=headers, json=payload, timeout=60)
            r.raise_for_status()
            for item in r.json().get("results", []):
                deals_map[str(item["id"])] = item.get("properties", {})
        except Exception as e:
            print(f"   ⚠️  Error en lote deals {i//BATCH + 1}: {e}")
            time.sleep(2)

    print(f"✅ {len(deals_map)} deals enriquecidos\n")
    return deals_map


# ==========================================
# ⚙️ HELPERS DE FECHA/TIEMPO
# ==========================================
def parse_fecha(valor) -> Optional[date]:
    """HubSpot date → date Colombia (UTC-5)."""
    if not valor:
        return None
    try:
        v = str(valor)
        if v.isdigit() and len(v) > 10:
            return datetime.fromtimestamp(int(v)/1000, tz=timezone.utc).astimezone(TZ_COLOMBIA).date()
        return datetime.fromisoformat(v.replace("Z","+00:00")).astimezone(TZ_COLOMBIA).date()
    except Exception:
        return None


def parse_datetime(valor) -> Optional[datetime]:
    """HubSpot datetime → datetime Colombia."""
    if not valor:
        return None
    try:
        v = str(valor)
        if v.isdigit() and len(v) > 10:
            return datetime.fromtimestamp(int(v)/1000, tz=timezone.utc).astimezone(TZ_COLOMBIA)
        return datetime.fromisoformat(v.replace("Z","+00:00")).astimezone(TZ_COLOMBIA)
    except Exception:
        return None


def dias_entre(dt1: Optional[datetime], dt2: Optional[datetime]) -> Optional[float]:
    if not dt1 or not dt2:
        return None
    return round((dt2 - dt1).total_seconds() / 86400, 2)


def dias_entre_dates(d1: Optional[date], d2: Optional[date]) -> Optional[float]:
    if not d1 or not d2:
        return None
    return float((d2 - d1).days)


def dt_from_date(d: Optional[date]) -> Optional[datetime]:
    """Convierte date → datetime medianoche Colombia, para cálculos de lead time."""
    if not d:
        return None
    return datetime.combine(d, datetime.min.time()).replace(tzinfo=TZ_COLOMBIA)


# ==========================================
# ⚙️ VENTANA DE CIERRE — KPI 6
# ==========================================
def calcular_ventana_cierre(
    etapa_codigo:             str,
    date_entered_exitoso:     Optional[datetime],
    date_entered_novedades:   Optional[datetime],
    fecha_aprobacion_final:   Optional[date],
) -> bool:
    """
    KPI 6: ¿La aprobación cayó en la ventana de cierre?
    Ventana = últimos 3 días calendario del mes + primeros 4 del mes siguiente.

    PLAN A (principal):
      - aprobado_exitoso   → ancla = date_entered_aprobado_exitoso
      - aprobado_novedades → ancla = date_entered_aprobado_novedades
    PLAN B (fallback si el date_entered está vacío):
      → ancla = fecha_aprobacion_final

    Para registros que NO son resolución (pipeline, caída), retorna False.
    """
    # Solo aplica a resoluciones aprobadas
    if etapa_codigo not in ("aprobado_exitoso", "aprobado_novedades"):
        return False

    # Elegir ancla: Plan A primero
    if etapa_codigo == "aprobado_exitoso" and date_entered_exitoso:
        ancla: date = date_entered_exitoso.date()
    elif etapa_codigo == "aprobado_novedades" and date_entered_novedades:
        ancla = date_entered_novedades.date()
    elif fecha_aprobacion_final:
        ancla = fecha_aprobacion_final   # Plan B
    else:
        return False

    # Determinar el mes de referencia desde la propia ancla
    anio, mes = ancla.year, ancla.month
    try:
        primer_dia_sig = date(anio + 1, 1, 1) if mes == 12 else date(anio, mes + 1, 1)
        ultimo_dia     = primer_dia_sig - timedelta(days=1)
        inicio_ventana = ultimo_dia    - timedelta(days=2)   # 3 días antes del último
        fin_ventana    = primer_dia_sig + timedelta(days=3)  # 4 días del mes siguiente
        return inicio_ventana <= ancla <= fin_ventana
    except Exception:
        return False


# ==========================================
# ⚙️ TRANSFORMACIÓN POR REGISTRO
# ==========================================
def transform_legalizacion(
    record:       Dict,
    legal_to_deal: Dict,
    deals_map:    Dict,
    portal_id:    str,
) -> Dict:
    props  = record.get("properties", {})
    obj_id = str(record.get("id", props.get("hs_object_id", "")))

    # ── Stage, código y grupo ─────────────────────────────────────────────
    stage_raw  = str(props.get("hs_pipeline_stage", "") or "")
    stage_info = STAGE_MAP.get(stage_raw, {"codigo": "desconocido", "grupo": "desconocido", "label": stage_raw})
    etapa_codigo = stage_info["codigo"]
    grupo        = stage_info["grupo"]

    # ── Fechas de entrada a cada stage ───────────────────────────────────
    col_map = {
        "consignacion":      "date_entered_consignacion",
        "legal_espera":      "date_entered_legal_espera",
        "legal_aprobada_dir":"date_entered_legal_aprobada_dir",
        "revision_sinco":    "date_entered_revision_sinco",
        "aprobado_exitoso":  "date_entered_aprobado_exitoso",
        "aprobado_novedades":"date_entered_aprobado_novedades",
        "negocio_rechazado": "date_entered_negocio_rechazado",
        "venta_caida":       "date_entered_venta_caida",
    }
    date_entered: Dict[str, Optional[datetime]] = {}
    for stage_id, field_name in DATE_ENTERED_FIELDS.items():
        codigo   = STAGE_MAP.get(stage_id, {}).get("codigo", "")
        col_name = col_map.get(codigo, f"date_entered_{stage_id}")
        date_entered[col_name] = parse_datetime(props.get(field_name))

    # ── Fecha madre ───────────────────────────────────────────────────────
    fecha_aprobacion = parse_fecha(props.get("fecha_aprobacion_final"))
    anio = fecha_aprobacion.year  if fecha_aprobacion else None
    mes  = fecha_aprobacion.month if fecha_aprobacion else None

    # ── Fecha de creación (ancla pipeline) ────────────────────────────────
    createdate_dt = parse_datetime(props.get("hs_createdate"))
    anio_creacion = createdate_dt.year  if createdate_dt else None
    mes_creacion  = createdate_dt.month if createdate_dt else None

    # ── Cohorte ──────────────────────────────────────────────────────────
    # pipeline:   sin fecha_aprobacion_final, stage en {consignacion … revision_sinco}
    # resolucion: con fecha_aprobacion_final (exitoso / novedades / rechazado)
    # caida:      stage venta_caida (independiente de fecha madre)
    # (el grupo ya viene del STAGE_MAP; lo usamos directamente)

    # ── Proyecto / director / ciudad ──────────────────────────────────────
    raw_proyecto = props.get("lista_proyectos_negocios_sinco") or props.get("proyecto") or ""
    proyecto_limpio = limpiar_nombre_proyecto(raw_proyecto)

    # Respaldo desde el deal asociado si no se pudo resolver el proyecto
    deal_id    = legal_to_deal.get(obj_id)
    deal_props = deals_map.get(str(deal_id), {}) if deal_id else {}
    if proyecto_limpio == "SIN ASIGNAR":
        raw_deal = (deal_props.get("lista_proyectos_negocios_sinco") or
                    deal_props.get("nombre_de_proyecto___negocio") or "")
        if raw_deal:
            proyecto_limpio = limpiar_nombre_proyecto(raw_deal)

    director = asignar_director(proyecto_limpio)
    ciudad   = get_ciudad_strict(proyecto_limpio)

    # Ciudad del campo directo (para análisis geográfico del mapa)
    ciudad_del_negocio = props.get("ciudad_del_negocio", "") or ciudad

    # ── Tiempos entre stages (días) ───────────────────────────────────────
    dt_consig    = date_entered["date_entered_consignacion"]
    dt_l_espera  = date_entered["date_entered_legal_espera"]
    dt_l_apr_dir = date_entered["date_entered_legal_aprobada_dir"]
    dt_rev_sinco = date_entered["date_entered_revision_sinco"]
    dt_apr_exit  = date_entered["date_entered_aprobado_exitoso"]
    dt_apr_nov   = date_entered["date_entered_aprobado_novedades"]

    # Datetime de fecha_aprobacion_final (para lead time y tiempos finales)
    fecha_apr_dt = dt_from_date(fecha_aprobacion)

    # Fin de cada stage = inicio del siguiente, o la fecha de aprobación si no hay siguiente
    dias_en_consignacion      = dias_entre(dt_consig,    dt_l_espera  or dt_l_apr_dir or fecha_apr_dt)
    dias_en_legal_espera      = dias_entre(dt_l_espera,  dt_l_apr_dir or fecha_apr_dt)
    dias_en_legal_aprobada_dir= dias_entre(dt_l_apr_dir, dt_rev_sinco or fecha_apr_dt)
    dias_en_revision_sinco    = dias_entre(dt_rev_sinco, fecha_apr_dt)

    # Lead time total: consignación → aprobación
    dias_consignacion_a_aprobacion = dias_entre(dt_consig, fecha_apr_dt)

    # Aging en stage actual (hs_v2_time_in_current_stage viene en ms)
    aging_dias = None
    time_raw   = props.get("hs_v2_time_in_current_stage")
    if time_raw:
        try:
            v = str(time_raw)
            if v.isdigit() and len(v) > 10:
                aging_dias = round(int(v) / 86_400_000, 2)
        except Exception:
            pass

    # ── Ventana de cierre (KPI 6) ─────────────────────────────────────────
    en_ventana_cierre = calcular_ventana_cierre(
        etapa_codigo         = etapa_codigo,
        date_entered_exitoso = dt_apr_exit,
        date_entered_novedades = dt_apr_nov,
        fecha_aprobacion_final = fecha_aprobacion,
    )

    # ── Caída: anio/mes por date_entered_venta_caida ─────────────────────
    dt_caida = date_entered["date_entered_venta_caida"]
    anio_caida = dt_caida.year  if dt_caida else None
    mes_caida  = dt_caida.month if dt_caida else None

    # ── URL HubSpot (record URL de objeto custom) ─────────────────────────
    hubspot_url = f"https://app.hubspot.com/contacts/{portal_id}/record/2-58255488/{obj_id}"

    # ── Fila completa ─────────────────────────────────────────────────────
    return {
        # Identificadores
        "hs_object_id":             int(obj_id) if obj_id.isdigit() else None,
        "nombre_legalizacion":      props.get("nombre_de_legalizaci_n", ""),
        # Estado / pipeline
        "hs_pipeline_stage":        stage_raw,
        "etapa_codigo":             etapa_codigo,
        "grupo":                    grupo,
        "decision_final_legalizacion":     props.get("decision_final_legalizacion", ""),
        "verificacion_documental_sinco":   props.get("verificacion_documental_sinco", ""),
        "motivo_de_observacion":           props.get("motivo_de_observacion", ""),
        "estado_sarlaft":                  props.get("estado_sarlaft", ""),
        # Fechas de proceso
        "fecha_aprobacion_final":          fecha_aprobacion,
        "fecha_envio_sarlaft":             parse_fecha(props.get("fecha_envio_sarlaft")),
        "fecha_respuesta_sarlaft":         parse_fecha(props.get("fecha_respuesta_sarlaft")),
        # Proyecto y geografía
        "lista_proyectos_negocios_sinco":  props.get("lista_proyectos_negocios_sinco", ""),
        "proyecto":                        raw_proyecto,
        "proyecto_limpio":                 proyecto_limpio,
        "ciudad_del_negocio":              ciudad_del_negocio,
        "ciudad":                          ciudad,
        "director":                        director,
        "torre":                           props.get("torre", ""),
        # Valor
        "valor_del_inmueble":              float(props.get("valor_del_inmueble") or 0) or None,
        "tipo_de_cuenta_de_consignacion_de_separacion": props.get("tipo_de_cuenta_de_consignacion_de_separacion", ""),
        # Comprador
        "nombrecomprador":                 props.get("nombrecomprador", ""),
        "documento_comprador_1":           props.get("documento_comprador_1", ""),
        "documento_comprador_2":           props.get("documento_comprador_2", ""),
        # Responsable
        "propietario_del_negocio":         props.get("propietario_del_negocio", ""),
        "hubspot_owner_id":                props.get("hubspot_owner_id", ""),
        # Auxiliar
        "id_negocio_comercial_origen":     props.get("id_negocio_comercial_origen"),
        # Timing
        "hs_v2_time_in_current_stage":     time_raw,
        "hs_createdate":                   createdate_dt,
        "hs_lastmodifieddate":             parse_datetime(props.get("hs_lastmodifieddate")),
        # Dimensión temporal — fecha madre
        "anio":                            anio,
        "mes":                             mes,
        # Dimensión temporal — creación (ancla pipeline)
        "anio_creacion":                   anio_creacion,
        "mes_creacion":                    mes_creacion,
        # Dimensión temporal — caída
        "anio_caida":                      anio_caida,
        "mes_caida":                       mes_caida,
        # Fechas de entrada a stages
        **date_entered,
        # Deal enriquecido
        "deal_id":                         int(deal_id) if deal_id and str(deal_id).isdigit() else None,
        "dealstage":                       deal_props.get("dealstage", ""),
        "canal_atribucion":                deal_props.get("canal_de_atribucion_conaltura_negocio", ""),
        "canal_gestion_original":          deal_props.get("canal_de_gestion_comercial_original_negocio", ""),
        "canal_gestion_secundario":        deal_props.get("canal_de_gestion_comercial_secundario_negocio", ""),
        "numero_unidad":                   deal_props.get("numero_de_la_unidad_del_proyecto___negocio_conaltura", ""),
        "invdescunidad":                   deal_props.get("invdescunidad", ""),
        # Tiempos precalculados
        "dias_en_consignacion":            dias_en_consignacion,
        "dias_en_legal_espera":            dias_en_legal_espera,
        "dias_en_legal_aprobada_dir":      dias_en_legal_aprobada_dir,
        "dias_en_revision_sinco":          dias_en_revision_sinco,
        "dias_consignacion_a_aprobacion":  dias_consignacion_a_aprobacion,
        "en_ventana_cierre":               en_ventana_cierre,
        "aging_dias":                      aging_dias,
        # URL HubSpot
        "hubspot_url":                     hubspot_url,
        "updated_at":                      datetime.now(TZ_COLOMBIA),
    }


# ==========================================
# ⚙️ TRANSFORMACIÓN COMPLETA + DIAGNÓSTICO
# ==========================================
def transform_all(
    records:      List[Dict],
    legal_to_deal: Dict,
    deals_map:    Dict,
    portal_id:    str,
) -> pd.DataFrame:
    """
    Transforma todos los registros y construye el DataFrame.
    Imprime:
      1. Distribución por cohorte (pipeline / resolución / caída)
      2. Distribución por stage individual (los 8)
      3. Clasificación de resoluciones (exitoso / novedades / rechazado)
      4. Cobertura de deal enriquecido y de proyecto asignado
      5. Cobertura de date_entered por stage
      6. Resumen de tiempos: promedio y mediana de lead time por proyecto
         (solo registros con lead time calculado)
    """
    print(f"⏳ Transformando {len(records)} registros...")
    rows = []
    errores = 0

    for rec in records:
        try:
            rows.append(transform_legalizacion(rec, legal_to_deal, deals_map, portal_id))
        except Exception as e:
            errores += 1
            print(f"   ⚠️  Error en registro {rec.get('id','?')}: {e}")

    df = pd.DataFrame(rows)

    if df.empty:
        print("⚠️  DataFrame vacío — sin registros para transformar.")
        return df

    total = len(df)
    print(f"✅ {total} filas transformadas ({errores} errores)\n")

    # ── 1. Distribución por cohorte ───────────────────────────────────────
    print("=" * 70)
    print("📊 DIAGNÓSTICO DE TRANSFORMACIÓN v2.0")
    print("=" * 70)

    print("\n  1. DISTRIBUCIÓN POR COHORTE")
    print(f"  {'─'*45}")
    for grupo_key, label in [
        ("pipeline",   "Pipeline — en proceso (sin fecha madre)"),
        ("resolucion", "Resolución — aprobadas/rechazadas (con fecha madre)"),
        ("caida",      "Venta Caída — medida por entrada al stage"),
        ("desconocido","Stage no mapeado"),
    ]:
        n = (df["grupo"] == grupo_key).sum()
        pct = n / total * 100 if total else 0
        bar = "█" * int(pct / 2)
        print(f"  {label:<50}  {n:>5}  ({pct:5.1f}%)  {bar}")

    # ── 2. Distribución por stage individual ─────────────────────────────
    print("\n  2. DISTRIBUCIÓN POR STAGE INDIVIDUAL")
    print(f"  {'─'*45}")
    stage_counts = df["etapa_codigo"].value_counts()
    for codigo in STAGE_ORDEN:
        info  = next((v for v in STAGE_MAP.values() if v["codigo"] == codigo), {})
        label = info.get("label", codigo)
        grupo = info.get("grupo", "")
        n     = stage_counts.get(codigo, 0)
        pct   = n / total * 100 if total else 0
        bar   = "█" * int(pct / 2)
        grupo_tag = f"[{grupo}]" if grupo != "desconocido" else ""
        print(f"  {label:<50}  {n:>5}  ({pct:5.1f}%)  {bar}  {grupo_tag}")
    # Stages no mapeados
    n_desc = (df["etapa_codigo"] == "desconocido").sum()
    if n_desc:
        print(f"  {'Sin mapeo (stage desconocido)':<50}  {n_desc:>5}")

    # ── 3. Clasificación de resoluciones ─────────────────────────────────
    resolucion_df = df[df["grupo"] == "resolucion"]
    n_res = len(resolucion_df)
    if n_res:
        print(f"\n  3. CLASIFICACIÓN DE RESOLUCIONES ({n_res} registros con fecha madre)")
        print(f"  {'─'*45}")
        for codigo, desc in [
            ("aprobado_exitoso",   "Aprobadas sin novedades"),
            ("aprobado_novedades", "Aprobadas con novedades"),
            ("negocio_rechazado",  "Rechazadas"),
        ]:
            n   = (resolucion_df["etapa_codigo"] == codigo).sum()
            pct = n / n_res * 100 if n_res else 0
            print(f"  {desc:<45}  {n:>5}  ({pct:5.1f}%)")

        n_ventana = resolucion_df["en_ventana_cierre"].sum()
        n_aprobadas = ((resolucion_df["etapa_codigo"] == "aprobado_exitoso") |
                       (resolucion_df["etapa_codigo"] == "aprobado_novedades")).sum()
        pct_ventana = n_ventana / n_aprobadas * 100 if n_aprobadas else 0
        print(f"  {'KPI 6 — En ventana de cierre':<45}  {int(n_ventana):>5}  ({pct_ventana:5.1f}% de aprobadas)")

        # Método de ancla usado
        n_plan_a_exit = resolucion_df[
            (resolucion_df["etapa_codigo"] == "aprobado_exitoso") &
            (resolucion_df["date_entered_aprobado_exitoso"].notna())
        ].shape[0]
        n_plan_a_nov  = resolucion_df[
            (resolucion_df["etapa_codigo"] == "aprobado_novedades") &
            (resolucion_df["date_entered_aprobado_novedades"].notna())
        ].shape[0]
        n_plan_b = n_aprobadas - n_plan_a_exit - n_plan_a_nov
        print(f"\n     Ancla ventana cierre:")
        print(f"       Plan A (date_entered exitoso)   : {n_plan_a_exit}")
        print(f"       Plan A (date_entered novedades) : {n_plan_a_nov}")
        print(f"       Plan B (fecha_aprobacion_final) : {max(0, n_plan_b)}")

    # ── 4. Cobertura de datos ─────────────────────────────────────────────
    print(f"\n  4. COBERTURA DE DATOS")
    print(f"  {'─'*45}")
    n_con_deal     = df["deal_id"].notna().sum()
    n_sin_proyecto = (df["proyecto_limpio"] == "SIN ASIGNAR").sum()
    n_con_fecha    = df["fecha_aprobacion_final"].notna().sum()
    n_con_consig   = df["date_entered_consignacion"].notna().sum()
    print(f"  Con Deal asociado              : {n_con_deal:>5}  ({n_con_deal/total*100:.1f}%)")
    print(f"  Con proyecto asignado          : {total-n_sin_proyecto:>5}  ({(total-n_sin_proyecto)/total*100:.1f}%)")
    print(f"  Con fecha_aprobacion_final     : {n_con_fecha:>5}  ({n_con_fecha/total*100:.1f}%)")
    print(f"  Con date_entered_consignacion  : {n_con_consig:>5}  ({n_con_consig/total*100:.1f}%)")

    print(f"\n  Cobertura date_entered por stage:")
    for codigo in STAGE_ORDEN:
        col = "date_entered_" + codigo
        if col in df.columns:
            n_ok = df[col].notna().sum()
            pct  = n_ok / total * 100
            print(f"    {col:<42}: {n_ok:>5}  ({pct:5.1f}%)")

    # ── 5. Resumen de tiempos por proyecto ────────────────────────────────
    df_lt = df[df["dias_consignacion_a_aprobacion"].notna()].copy()
    if not df_lt.empty:
        print(f"\n  5. TIEMPOS DE LEAD TIME POR PROYECTO")
        print(f"     (solo registros con lead time calculado: {len(df_lt)} de {total})")
        print(f"  {'─'*68}")
        print(f"  {'Proyecto':<30}  {'N':>4}  {'Promedio':>10}  {'Mediana':>9}  {'Mín':>6}  {'Máx':>6}")
        print(f"  {'─'*68}")

        resumen = (
            df_lt.groupby("proyecto_limpio")["dias_consignacion_a_aprobacion"]
            .agg(n="count", promedio="mean", mediana="median", minimo="min", maximo="max")
            .sort_values("promedio", ascending=False)
            .reset_index()
        )
        for _, fila in resumen.iterrows():
            nombre = str(fila["proyecto_limpio"])[:29]
            print(
                f"  {nombre:<30}  {int(fila['n']):>4}  "
                f"{fila['promedio']:>8.1f}d  "
                f"{fila['mediana']:>7.1f}d  "
                f"{fila['minimo']:>4.0f}d  "
                f"{fila['maximo']:>4.0f}d"
            )

        # Resumen global
        print(f"  {'─'*68}")
        print(f"  {'GLOBAL':<30}  {len(df_lt):>4}  "
              f"{df_lt['dias_consignacion_a_aprobacion'].mean():>8.1f}d  "
              f"{df_lt['dias_consignacion_a_aprobacion'].median():>7.1f}d  "
              f"{df_lt['dias_consignacion_a_aprobacion'].min():>4.0f}d  "
              f"{df_lt['dias_consignacion_a_aprobacion'].max():>4.0f}d")
    else:
        print(f"\n  5. TIEMPOS: sin registros con lead time calculado aún.")

    # ── 6. Resumen de tiempos por stage ───────────────────────────────────
    print(f"\n  6. TIEMPOS PROMEDIO POR STAGE (días, sobre registros con dato)")
    print(f"  {'─'*55}")
    for col, label in [
        ("dias_en_consignacion",       "Negocios con Consignación"),
        ("dias_en_legal_espera",       "Legalización en Espera"),
        ("dias_en_legal_aprobada_dir", "Legalización Aprobada por Director"),
        ("dias_en_revision_sinco",     "Revisión SINCO"),
    ]:
        if col in df.columns:
            sub = df[df[col].notna()][col]
            if not sub.empty:
                print(f"  {label:<40}: prom={sub.mean():6.1f}d  med={sub.median():6.1f}d  n={len(sub)}")

    print("\n" + "=" * 70)
    print(f"✅ TRANSFORMACIÓN COMPLETADA — {total} registros listos")
    print("=" * 70 + "\n")

    return df


# ==========================================
# 🔥 MODO MUESTRA — imprime JSON crudo
# ==========================================
def imprimir_muestra(records: List[Dict], legal_to_deal: Dict, deals_map: Dict):
    print("\n" + "=" * 70)
    print(f"🔍 MODO MUESTRA — {min(len(records), LIMITE_MUESTRA)} registros")
    print("=" * 70)

    for i, rec in enumerate(records[:LIMITE_MUESTRA]):
        props  = rec.get("properties", {})
        obj_id = str(rec.get("id", ""))
        deal_id    = legal_to_deal.get(obj_id, "SIN DEAL")
        deal_props = deals_map.get(str(deal_id), {})

        stage_raw  = props.get("hs_pipeline_stage", "")
        stage_info = STAGE_MAP.get(str(stage_raw), {"label": "DESCONOCIDO", "codigo": "?"})

        print(f"\n{'─'*70}")
        print(f"📋 REGISTRO {i+1} | ID: {obj_id}")
        print(f"{'─'*70}")
        print(f"  Stage actual   : {stage_raw} → {stage_info['label']} ({stage_info['codigo']})")
        print(f"  Proyecto raw   : {props.get('lista_proyectos_negocios_sinco','') or props.get('proyecto','')}")
        print(f"  Fecha aprob.   : {props.get('fecha_aprobacion_final','(vacía)')}")
        print(f"  Nombre legal.  : {props.get('nombre_de_legalizaci_n','')}")
        print(f"  Valor inmueble : {props.get('valor_del_inmueble','')}")

        print(f"\n  📅 Fechas de entrada a stages:")
        for sid, fname in DATE_ENTERED_FIELDS.items():
            val   = props.get(fname, "")
            label = STAGE_MAP.get(sid, {}).get("label", sid)
            if val:
                parsed = parse_datetime(val)
                print(f"     ✅ {label:<45} → {parsed}")
            else:
                print(f"     ─  {label:<45} → (vacío)")

        print(f"\n  🔗 Deal asociado: {deal_id}")
        if deal_props:
            print(f"     dealname      : {deal_props.get('dealname','')}")
            print(f"     dealstage     : {deal_props.get('dealstage','')}")
            print(f"     canal_atrib.  : {deal_props.get('canal_de_atribucion_conaltura_negocio','')}")
            print(f"     canal_orig.   : {deal_props.get('canal_de_gestion_comercial_original_negocio','')}")
            print(f"     invdescunidad : {deal_props.get('invdescunidad','(vacío)')}")
        else:
            print("     (Sin deal asociado)")

        print(f"\n  📦 JSON crudo (propiedades no vacías):")
        print(json.dumps({k: v for k, v in props.items() if v},
                         indent=4, ensure_ascii=False, default=str))
        print(f"\n  🔗 HubSpot: https://app.hubspot.com/contacts/{PORTAL_ID}/record/2-58255488/{obj_id}")

    print("\n" + "=" * 70)
    print("✅ FIN DE LA MUESTRA")
    print("=" * 70)


# ==========================================
# 💾 SINCRONIZACIÓN PROYECTOS_MASTER
# ==========================================
def sync_proyectos_master(df: pd.DataFrame, engine) -> None:
    print("🔄 Sincronizando proyectos_master...")
    proyectos = df[["proyecto_limpio", "director", "ciudad"]].drop_duplicates()
    inserted = updated = 0

    with engine.begin() as conn:
        conn.execute(text("""
            CREATE TABLE IF NOT EXISTS proyectos_master (
                id SERIAL,
                codigo_proyecto VARCHAR(255) NOT NULL,
                nombre_proyecto VARCHAR(255) NOT NULL,
                director VARCHAR(255) DEFAULT 'SIN ASIGNAR',
                ciudad VARCHAR(100) DEFAULT 'Medellín',
                activo BOOLEAN DEFAULT true,
                fecha_creacion TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                fecha_actualizacion TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                CONSTRAINT proyectos_master_codigo_unique UNIQUE (codigo_proyecto)
            )
        """))
        for _, row in proyectos.iterrows():
            nombre = row["proyecto_limpio"]
            if not nombre or nombre == "SIN ASIGNAR":
                continue
            exists = conn.execute(text(
                "SELECT id, director, ciudad FROM proyectos_master WHERE codigo_proyecto=:c"
            ), {"c": nombre}).fetchone()
            if not exists:
                conn.execute(text("""
                    INSERT INTO proyectos_master (codigo_proyecto, nombre_proyecto, director, ciudad, activo)
                    VALUES (:c,:n,:d,:ci,true)
                    ON CONFLICT (codigo_proyecto) DO NOTHING
                """), {"c": nombre, "n": nombre, "d": row["director"], "ci": row["ciudad"]})
                inserted += 1
            elif exists[1] != row["director"] or exists[2] != row["ciudad"]:
                conn.execute(text("""
                    UPDATE proyectos_master
                    SET director=:d, ciudad=:ci, fecha_actualizacion=CURRENT_TIMESTAMP
                    WHERE codigo_proyecto=:c
                """), {"c": nombre, "d": row["director"], "ci": row["ciudad"]})
                updated += 1

    print(f"  ✅ insertados: {inserted} | actualizados: {updated}\n")


# ==========================================
# 💾 CARGA A NEON
# ==========================================
def crear_tablas_si_no_existen(engine) -> None:
    print("🔧 Verificando / creando tablas en Neon...")
    with engine.begin() as conn:
        conn.execute(text("""
            CREATE TABLE IF NOT EXISTS manual_metas (
                id SERIAL PRIMARY KEY,
                anio INT NOT NULL,
                mes INT NOT NULL,
                meta_negocios INT NOT NULL DEFAULT 0,
                updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
                CONSTRAINT manual_metas_anio_mes_unique UNIQUE (anio, mes)
            )
        """))
    print("  ✅ Tablas verificadas\n")


def load_to_neon(df: pd.DataFrame, engine) -> None:
    print("⏳ Cargando datos a Neon...")

    # raw_legalizaciones — TRUNCATE + INSERT (full reload idempotente)
    print("  💾 Escribiendo raw_legalizaciones...")
    with engine.begin() as conn:
        conn.execute(text("""
            CREATE TABLE IF NOT EXISTS raw_legalizaciones (
                hs_object_id BIGINT PRIMARY KEY,
                nombre_legalizacion TEXT,
                hs_pipeline_stage TEXT,
                etapa_codigo TEXT,
                grupo TEXT,
                decision_final_legalizacion TEXT,
                verificacion_documental_sinco TEXT,
                motivo_de_observacion TEXT,
                estado_sarlaft TEXT,
                fecha_aprobacion_final DATE,
                fecha_envio_sarlaft DATE,
                fecha_respuesta_sarlaft DATE,
                lista_proyectos_negocios_sinco TEXT,
                proyecto TEXT,
                proyecto_limpio TEXT,
                ciudad_del_negocio TEXT,
                ciudad TEXT,
                director TEXT,
                torre TEXT,
                valor_del_inmueble NUMERIC,
                tipo_de_cuenta_de_consignacion_de_separacion TEXT,
                nombrecomprador TEXT,
                documento_comprador_1 TEXT,
                documento_comprador_2 TEXT,
                propietario_del_negocio TEXT,
                hubspot_owner_id TEXT,
                id_negocio_comercial_origen BIGINT,
                hs_v2_time_in_current_stage TEXT,
                hs_createdate TIMESTAMPTZ,
                hs_lastmodifieddate TIMESTAMPTZ,
                anio INT, mes INT,
                anio_creacion INT, mes_creacion INT,
                anio_caida INT, mes_caida INT,
                date_entered_consignacion TIMESTAMPTZ,
                date_entered_legal_espera TIMESTAMPTZ,
                date_entered_legal_aprobada_dir TIMESTAMPTZ,
                date_entered_revision_sinco TIMESTAMPTZ,
                date_entered_aprobado_exitoso TIMESTAMPTZ,
                date_entered_aprobado_novedades TIMESTAMPTZ,
                date_entered_negocio_rechazado TIMESTAMPTZ,
                date_entered_venta_caida TIMESTAMPTZ,
                deal_id BIGINT,
                dealstage TEXT,
                canal_atribucion TEXT,
                canal_gestion_original TEXT,
                canal_gestion_secundario TEXT,
                numero_unidad TEXT,
                invdescunidad TEXT,
                dias_en_consignacion NUMERIC,
                dias_en_legal_espera NUMERIC,
                dias_en_legal_aprobada_dir NUMERIC,
                dias_en_revision_sinco NUMERIC,
                dias_consignacion_a_aprobacion NUMERIC,
                en_ventana_cierre BOOLEAN,
                aging_dias NUMERIC,
                hubspot_url TEXT,
                updated_at TIMESTAMPTZ
            )
        """))
        conn.execute(text("TRUNCATE TABLE raw_legalizaciones"))

    df.to_sql("raw_legalizaciones", engine, if_exists="append", index=False, method="multi")
    print(f"  ✅ raw_legalizaciones: {len(df)} filas")

    # bi_legalizaciones_final — reconstruida desde cero en cada corrida
    print("  💾 Reconstruyendo bi_legalizaciones_final...")
    with engine.begin() as conn:
        conn.execute(text("DROP TABLE IF EXISTS bi_legalizaciones_final"))
        conn.execute(text("""
            CREATE TABLE bi_legalizaciones_final AS
            WITH
            resolucion AS (
                SELECT
                    proyecto_limpio AS proyecto, director, ciudad,
                    canal_atribucion, canal_gestion_original,
                    anio, mes,
                    COUNT(*) FILTER (WHERE etapa_codigo='aprobado_exitoso')   AS cnt_aprobado_exitoso,
                    COUNT(*) FILTER (WHERE etapa_codigo='aprobado_novedades') AS cnt_aprobado_novedades,
                    COUNT(*) FILTER (WHERE etapa_codigo='negocio_rechazado')  AS cnt_negocio_rechazado,
                    COUNT(*)                                                   AS cnt_total_resolucion,
                    COUNT(*) FILTER (WHERE en_ventana_cierre=TRUE)            AS cnt_en_ventana_cierre,
                    SUM(valor_del_inmueble)                                    AS suma_valor_inmueble,
                    ROUND(AVG(dias_consignacion_a_aprobacion)::NUMERIC,2)     AS avg_lead_time_dias,
                    ROUND(PERCENTILE_CONT(0.5) WITHIN GROUP
                          (ORDER BY dias_consignacion_a_aprobacion)::NUMERIC,2) AS p50_lead_time_dias,
                    ROUND(PERCENTILE_CONT(0.9) WITHIN GROUP
                          (ORDER BY dias_consignacion_a_aprobacion)::NUMERIC,2) AS p90_lead_time_dias,
                    ROUND(AVG(dias_en_consignacion)::NUMERIC,2)    AS avg_dias_consignacion,
                    ROUND(AVG(dias_en_legal_espera)::NUMERIC,2)    AS avg_dias_legal_espera,
                    ROUND(AVG(dias_en_revision_sinco)::NUMERIC,2)  AS avg_dias_revision_sinco
                FROM raw_legalizaciones
                WHERE anio IS NOT NULL AND mes IS NOT NULL
                GROUP BY proyecto_limpio,director,ciudad,canal_atribucion,canal_gestion_original,anio,mes
            ),
            caidas AS (
                SELECT
                    proyecto_limpio AS proyecto,
                    anio_caida AS anio, mes_caida AS mes,
                    COUNT(*) AS cnt_venta_caida
                FROM raw_legalizaciones
                WHERE anio_caida IS NOT NULL AND mes_caida IS NOT NULL
                GROUP BY proyecto_limpio, anio_caida, mes_caida
            ),
            pipeline AS (
                SELECT
                    proyecto_limpio AS proyecto,
                    COUNT(*) FILTER (WHERE etapa_codigo='consignacion')       AS cnt_pipeline_consignacion,
                    COUNT(*) FILTER (WHERE etapa_codigo='legal_espera')       AS cnt_pipeline_legal_espera,
                    COUNT(*) FILTER (WHERE etapa_codigo='legal_aprobada_dir') AS cnt_pipeline_legal_aprobada_dir,
                    COUNT(*) FILTER (WHERE etapa_codigo='revision_sinco')     AS cnt_pipeline_revision_sinco,
                    COUNT(*)                                                    AS cnt_pipeline_total
                FROM raw_legalizaciones
                WHERE fecha_aprobacion_final IS NULL AND grupo='pipeline'
                GROUP BY proyecto_limpio
            )
            SELECT
                r.proyecto, r.director, r.ciudad,
                r.canal_atribucion, r.canal_gestion_original,
                r.anio, r.mes,
                COALESCE(r.cnt_aprobado_exitoso,  0) AS cnt_aprobado_exitoso,
                COALESCE(r.cnt_aprobado_novedades,0) AS cnt_aprobado_novedades,
                COALESCE(r.cnt_negocio_rechazado, 0) AS cnt_negocio_rechazado,
                COALESCE(r.cnt_total_resolucion,  0) AS cnt_total_resolucion,
                COALESCE(c.cnt_venta_caida,       0) AS cnt_venta_caida,
                COALESCE(r.cnt_en_ventana_cierre, 0) AS cnt_en_ventana_cierre,
                COALESCE(p.cnt_pipeline_consignacion,      0) AS cnt_pipeline_consignacion,
                COALESCE(p.cnt_pipeline_legal_espera,      0) AS cnt_pipeline_legal_espera,
                COALESCE(p.cnt_pipeline_legal_aprobada_dir,0) AS cnt_pipeline_legal_aprobada_dir,
                COALESCE(p.cnt_pipeline_revision_sinco,    0) AS cnt_pipeline_revision_sinco,
                COALESCE(p.cnt_pipeline_total,             0) AS cnt_pipeline_total,
                COALESCE(r.suma_valor_inmueble,   0) AS suma_valor_inmueble,
                r.avg_lead_time_dias,
                r.p50_lead_time_dias,
                r.p90_lead_time_dias,
                r.avg_dias_consignacion,
                r.avg_dias_legal_espera,
                r.avg_dias_revision_sinco
            FROM resolucion r
            LEFT JOIN caidas   c ON c.proyecto=r.proyecto AND c.anio=r.anio AND c.mes=r.mes
            LEFT JOIN pipeline p ON p.proyecto=r.proyecto
            ORDER BY r.proyecto, r.anio, r.mes
        """))
    print("  ✅ bi_legalizaciones_final reconstruida")
    print("✅ CARGA A NEON COMPLETADA\n")


# ==========================================
# 📊 DIAGNÓSTICO POST-CARGA
# ==========================================
def diagnostico_db(engine) -> None:
    print("\n" + "=" * 70)
    print("📊 DIAGNÓSTICO POST-CARGA EN NEON")
    print("=" * 70)
    with engine.connect() as conn:
        r = conn.execute(text("""
            SELECT
                COUNT(*)                                              AS total,
                COUNT(*) FILTER (WHERE grupo='pipeline')             AS pipeline,
                COUNT(*) FILTER (WHERE grupo='resolucion')           AS resolucion,
                COUNT(*) FILTER (WHERE grupo='caida')                AS caida,
                COUNT(*) FILTER (WHERE deal_id IS NOT NULL)          AS con_deal,
                COUNT(*) FILTER (WHERE proyecto_limpio='SIN ASIGNAR') AS sin_proyecto
            FROM raw_legalizaciones
        """)).fetchone()
        print(f"\n  raw_legalizaciones:")
        print(f"    Total        : {r[0]} | Pipeline: {r[1]} | Resolución: {r[2]} | Caída: {r[3]}")
        print(f"    Con Deal     : {r[4]} | Sin proyecto: {r[5]}")

        r2 = conn.execute(text("""
            SELECT COUNT(*), SUM(cnt_total_resolucion),
                   SUM(cnt_aprobado_exitoso), SUM(cnt_aprobado_novedades),
                   SUM(cnt_negocio_rechazado), SUM(cnt_venta_caida)
            FROM bi_legalizaciones_final
        """)).fetchone()
        print(f"\n  bi_legalizaciones_final:")
        print(f"    Filas mart   : {r2[0]} | Total resolución: {r2[1]}")
        print(f"    Exitosos: {r2[2]} | Con novedades: {r2[3]} | Rechazados: {r2[4]} | Caídas: {r2[5]}")

        r3 = conn.execute(text("SELECT COUNT(*) FROM proyectos_master")).scalar()
        print(f"\n  proyectos_master: {r3} proyectos")
    print("=" * 70 + "\n")


# ==========================================
# 🚀 EJECUCIÓN PRINCIPAL
# ==========================================
if __name__ == "__main__":
    print("=" * 70)
    print("🏢 CONALTURA — ETL LEGALIZACIONES v2.0")
    modo_str = ("MUESTRA" if MODO_MUESTRA else
                "VERIFY"  if MODO_VERIFY  else
                "TRANSFORM (sin carga)" if MODO_TRANSFORM else
                "COMPLETO (producción)")
    print(f"   Modo: {modo_str}")
    print("=" * 70)
    print(f"📅 {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}\n")

    if not HUBSPOT_TOKEN:
        print("❌ HUBSPOT_API_KEY no definido. Verifica los secrets de GitHub.")
        sys.exit(1)

    start = time.time()

    try:
        # Verificar propiedades (solo en muestra y verify)
        if MODO_MUESTRA or MODO_VERIFY:
            verificar_propiedades_objeto_legal()
        if MODO_VERIFY:
            print("\n✅ Verificación completada (sin carga).")
            sys.exit(0)

        # Portal ID
        portal_id = get_portal_id_api()
        print(f"🔑 Portal ID: {portal_id}\n")

        # Extraer legalizaciones
        limite  = LIMITE_MUESTRA if MODO_MUESTRA else None
        records = fetch_legalizaciones(limite=limite)
        if not records:
            print("⚠️  Sin registros.")
            sys.exit(1)

        # Asociaciones y enriquecimiento
        legal_ids    = [str(r.get("id","")) for r in records]
        legal_to_deal = fetch_associations_to_deals(legal_ids)
        deal_ids     = list(set(legal_to_deal.values()))
        deals_map    = fetch_deals_by_ids(deal_ids)

        # Modo muestra: imprime raw + sale
        if MODO_MUESTRA:
            imprimir_muestra(records, legal_to_deal, deals_map)
            print(f"\n⏱️  {time.time()-start:.1f}s")
            print("✅ MUESTRA COMPLETADA — sin escritura en BD.")
            sys.exit(0)

        # Transformar (siempre, para muestra/transform/completo)
        df = transform_all(records, legal_to_deal, deals_map, portal_id)

        # Modo --transform: diagnóstico impreso, sin carga
        if MODO_TRANSFORM:
            print(f"\n⏱️  {time.time()-start:.1f}s")
            print("✅ TRANSFORMACIÓN COMPLETADA — sin escritura en BD.")
            print("   Confirma el diagnóstico y luego ejecuta el modo completo.")
            sys.exit(0)

        # Conectar a Neon
        if not DB_URI:
            print("❌ Variables DB no configuradas.")
            sys.exit(1)
        engine = create_engine(DB_URI, pool_pre_ping=True)

        # Crear tablas, sincronizar proyectos, cargar
        crear_tablas_si_no_existen(engine)
        sync_proyectos_master(df, engine)
        load_to_neon(df, engine)
        diagnostico_db(engine)

        elapsed = time.time() - start
        print("=" * 70)
        print(f"🎉 ETL LEGALIZACIONES v2.0 COMPLETADO")
        print(f"⏱️  Tiempo total: {elapsed:.1f}s")
        print("=" * 70)

    except Exception as e:
        print(f"\n{'='*70}\n💥 ERROR CRÍTICO: {e}\n{'='*70}")
        import traceback; traceback.print_exc()
        sys.exit(1)
