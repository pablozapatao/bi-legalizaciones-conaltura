"""
🏢 CONALTURA — ETL LEGALIZACIONES v3.0
================================================================
OBJETO:    Legalizaciones de Venta (objectTypeId = 2-58255488)
BASE DE DATOS: Neon (Postgres serverless)
AUTOR:     Data Engineering Team
FECHA:     2026

CAMBIOS v3.0 vs v2.0:
  - Conexión DB unificada en DATABASE_URL (única variable de entorno).
    Elimina DB_USER / DB_PASSWORD / DB_HOST separados.
  - Diagnóstico post-carga expandido:
      · Cuadre matemático (total = pipeline + resolución + caída)
      · Resolución cuadrada (total = exitoso + novedades + rechazado)
      · Desglose por proyecto y por director
      · Chequeos de calidad: tiempos imposibles, sin proyecto,
        sin fecha madre en resolución, sin date_entered en consignación
  - schema.sql separado para crear las tablas en la consola de Neon.

MODOS DE EJECUCIÓN:
  python etl_legalizaciones.py              → ETL completo (producción)
  python etl_legalizaciones.py --muestra    → 5 registros + verificación HubSpot
  python etl_legalizaciones.py --verify     → Solo verifica propiedades (sin BD)
  python etl_legalizaciones.py --transform  → Extrae todo + transforma + diagnóstico (sin BD)
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
MODO_TRANSFORM = "--transform" in sys.argv
LIMITE_MUESTRA = 5

# ==========================================
# ZONA HORARIA COLOMBIA
# ==========================================
TZ_COLOMBIA = ZoneInfo("America/Bogota")  # UTC-5

# ==========================================
# CONFIGURACIÓN — DATABASE_URL único
# ==========================================
HUBSPOT_TOKEN = os.environ.get("HUBSPOT_API_KEY", "")
PORTAL_ID     = "47845317"

# Una sola variable para la BD — consistente en ETL (GitHub Secrets)
# y en dashboard (Vercel env var).
# Formato Neon: postgresql://user:pass@ep-xxx.region.aws.neon.tech/neondb?sslmode=require
DATABASE_URL = os.environ.get("DATABASE_URL", "")

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
    "1394950689": {"codigo": "aprobado_gerencia",   "grupo": "resolucion", "label": "Aprobado por Gerencia Comercial - Con Novedades"},
}

STAGE_ORDEN = [
    "consignacion", "legal_espera", "legal_aprobada_dir", "revision_sinco",
    "aprobado_exitoso", "aprobado_novedades", "aprobado_gerencia", "negocio_rechazado", "venta_caida",
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
    "1394950689": "hs_v2_date_entered_1394950689",
}

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
    "hs_v2_date_entered_1315416588",
    "hs_v2_date_entered_1315313434",
    "hs_v2_date_entered_1315313435",
    "hs_v2_date_entered_1315574198",
    "hs_v2_date_entered_1315574199",
    "hs_v2_date_entered_1345851003",
    "hs_v2_date_entered_1315574200",
    "hs_v2_date_entered_1378706098",
    "hs_v2_date_entered_1394950689",
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
    print("\n" + "=" * 70)
    print("🔍 VERIFICACIÓN DE PROPIEDADES EN HUBSPOT")
    print("=" * 70)
    headers = {"Authorization": f"Bearer {HUBSPOT_TOKEN}"}
    resultado = {"date_entered_encontrados": [], "date_entered_faltantes": [],
                 "time_in_stage_existe": False, "portal_id_verificado": None}

    print("\n📋 1. Portal ID...")
    try:
        r = requests.get("https://api.hubspot.com/account-info/v3/details",
                         headers=headers, timeout=15)
        if r.status_code == 200:
            resultado["portal_id_verificado"] = r.json().get("portalId")
            print(f"   ✅ {resultado['portal_id_verificado']}")
    except Exception as e:
        print(f"   ⚠️  {e}")

    print("\n📋 2. Propiedades objeto 2-58255488...")
    try:
        r = requests.get("https://api.hubapi.com/crm/v3/properties/2-58255488",
                         headers=headers, timeout=30)
        if r.status_code == 200:
            nombres = [p["name"] for p in r.json().get("results", [])]
            print(f"   ✅ {len(nombres)} propiedades")
            for sid, fname in DATE_ENTERED_FIELDS.items():
                label = STAGE_MAP[sid]["label"]
                if fname in nombres:
                    resultado["date_entered_encontrados"].append(fname)
                    print(f"   ✅ {fname}  ← {label}")
                else:
                    resultado["date_entered_faltantes"].append(fname)
                    print(f"   ❌ {fname}  ← {label} — NO EXISTE")
            resultado["time_in_stage_existe"] = "hs_v2_time_in_current_stage" in nombres
            print(f"   hs_v2_time_in_current_stage: {'✅' if resultado['time_in_stage_existe'] else '❌'}")
    except Exception as e:
        print(f"   ❌ {e}")
    print("=" * 70)
    return resultado


# ==========================================
# 🔥 LIMPIEZA Y ASIGNACIÓN (= ETL de Deals)
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
            print(f"   ⚠️  Timeout intento {intento+1}/3")
            time.sleep(5)
        except requests.exceptions.RequestException as e:
            if intento == 2:
                raise
            print(f"   ⚠️  Error intento {intento+1}/3: {e}")
            time.sleep(3)
    return {}

def get_portal_id_api() -> str:
    try:
        data = hubspot_get("https://api.hubspot.com/account-info/v3/details", timeout=15)
        return str(data.get("portalId", PORTAL_ID))
    except Exception:
        return PORTAL_ID


# ==========================================
# 📥 EXTRACCIÓN
# ==========================================
def fetch_legalizaciones(limite: Optional[int] = None) -> List[Dict]:
    print("⏳ Extrayendo legalizaciones (2-58255488)...")
    url = "https://api.hubapi.com/crm/v3/objects/2-58255488"
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
        print(f"  📄 Página {page}: {len(results)} (Total: {len(all_records)})")
        if limite and len(all_records) >= limite:
            all_records = all_records[:limite]
            break
        after = data.get("paging", {}).get("next", {}).get("after")
        if not after:
            break

    print(f"✅ {len(all_records)} legalizaciones extraídas\n")
    return all_records

def fetch_associations_to_deals(legal_ids: List[str]) -> Dict[str, str]:
    print("⏳ Resolviendo asociaciones → Deal...")
    url     = "https://api.hubapi.com/crm/v4/associations/2-58255488/deals/batch/read"
    headers = {"Authorization": f"Bearer {HUBSPOT_TOKEN}", "Content-Type": "application/json"}
    legal_to_deal = {}
    BATCH = 100

    for i in range(0, len(legal_ids), BATCH):
        lote    = legal_ids[i:i+BATCH]
        payload = {"inputs": [{"id": lid} for lid in lote]}
        try:
            r = requests.post(url, headers=headers, json=payload, timeout=60)
            if r.status_code == 429:
                time.sleep(int(r.headers.get("Retry-After","10")))
                r = requests.post(url, headers=headers, json=payload, timeout=60)
            r.raise_for_status()
            for item in r.json().get("results", []):
                fid    = str(item.get("from",{}).get("id",""))
                to_lst = item.get("to",[])
                if to_lst:
                    did = str(to_lst[0].get("toObjectId",""))
                    if did:
                        legal_to_deal[fid] = did
        except Exception as e:
            print(f"   ⚠️  Lote {i//BATCH+1}: {e}")
            time.sleep(2)
        if (i//BATCH+1) % 5 == 0:
            print(f"  📦 {min(i+BATCH,len(legal_ids))}/{len(legal_ids)} procesados")

    print(f"✅ {len(legal_to_deal)}/{len(legal_ids)} con Deal\n")
    return legal_to_deal

def fetch_deals_by_ids(deal_ids: List[str]) -> Dict[str, Dict]:
    if not deal_ids:
        return {}
    print(f"⏳ Enriqueciendo {len(deal_ids)} deals...")
    url     = "https://api.hubapi.com/crm/v3/objects/deals/batch/read"
    headers = {"Authorization": f"Bearer {HUBSPOT_TOKEN}", "Content-Type": "application/json"}
    deals_map = {}
    BATCH = 100

    for i in range(0, len(deal_ids), BATCH):
        lote    = deal_ids[i:i+BATCH]
        payload = {"properties": DEAL_PROPS, "inputs": [{"id": did} for did in lote]}
        try:
            r = requests.post(url, headers=headers, json=payload, timeout=60)
            if r.status_code == 429:
                time.sleep(int(r.headers.get("Retry-After","10")))
                r = requests.post(url, headers=headers, json=payload, timeout=60)
            r.raise_for_status()
            for item in r.json().get("results",[]):
                deals_map[str(item["id"])] = item.get("properties",{})
        except Exception as e:
            print(f"   ⚠️  Lote deals {i//BATCH+1}: {e}")
            time.sleep(2)

    print(f"✅ {len(deals_map)} deals enriquecidos\n")
    return deals_map


# ==========================================
# ⚙️ HELPERS DE FECHA
# ==========================================
def parse_fecha(valor) -> Optional[date]:
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
    return round((dt2-dt1).total_seconds()/86400, 2)

def dt_from_date(d: Optional[date]) -> Optional[datetime]:
    if not d:
        return None
    return datetime.combine(d, datetime.min.time()).replace(tzinfo=TZ_COLOMBIA)


# ==========================================
# ⚙️ VENTANA DE CIERRE — KPI 6
# ==========================================
def calcular_ventana_cierre(
    etapa_codigo:           str,
    date_entered_exitoso:   Optional[datetime],
    date_entered_novedades: Optional[datetime],
    fecha_aprobacion_final: Optional[date],
    date_entered_gerencia:  Optional[datetime] = None,
) -> bool:
    """
    Ventana de cierre — DEFINICIÓN CORREGIDA:
    Una aprobación está en ventana si fecha_aprobacion_final cae en el día 25
    o posterior del mes correspondiente.

    Ancla: fecha_aprobacion_final (fecha madre del registro).
    - Solo aplica a aprobado_exitoso y aprobado_novedades.
    - Criterio: ancla.day >= 25
    """
    if etapa_codigo not in ("aprobado_exitoso", "aprobado_novedades", "aprobado_gerencia"):
        return False

    # Siempre usamos fecha_aprobacion_final como ancla para consistencia
    # con la query de la API (/api/kpis) que hace EXTRACT(DAY ...) >= 25
    ancla: Optional[date] = fecha_aprobacion_final
    if ancla is None:
        return False

    try:
        return ancla.day >= 25
    except Exception:
        return False


# ==========================================
# ⚙️ TRANSFORMACIÓN POR REGISTRO
# ==========================================
def transform_legalizacion(record, legal_to_deal, deals_map, portal_id) -> Dict:
    props  = record.get("properties", {})
    obj_id = str(record.get("id", props.get("hs_object_id","")))

    # Stage
    stage_raw  = str(props.get("hs_pipeline_stage","") or "")
    stage_info = STAGE_MAP.get(stage_raw, {"codigo":"desconocido","grupo":"desconocido","label":stage_raw})
    etapa_codigo = stage_info["codigo"]
    grupo        = stage_info["grupo"]

    # Fechas de entrada a stages
    col_map = {
        "consignacion":"date_entered_consignacion",
        "legal_espera":"date_entered_legal_espera",
        "legal_aprobada_dir":"date_entered_legal_aprobada_dir",
        "revision_sinco":"date_entered_revision_sinco",
        "aprobado_exitoso":"date_entered_aprobado_exitoso",
        "aprobado_novedades":"date_entered_aprobado_novedades",
        "aprobado_gerencia":"date_entered_aprobado_gerencia",
        "negocio_rechazado":"date_entered_negocio_rechazado",
        "venta_caida":"date_entered_venta_caida",
    }
    date_entered: Dict[str, Optional[datetime]] = {}
    for sid, fname in DATE_ENTERED_FIELDS.items():
        codigo   = STAGE_MAP.get(sid,{}).get("codigo","")
        col_name = col_map.get(codigo, f"date_entered_{sid}")
        date_entered[col_name] = parse_datetime(props.get(fname))

    # Fecha madre
    fecha_aprobacion = parse_fecha(props.get("fecha_aprobacion_final"))
    anio = fecha_aprobacion.year  if fecha_aprobacion else None
    mes  = fecha_aprobacion.month if fecha_aprobacion else None

    # Creación
    createdate_dt = parse_datetime(props.get("hs_createdate"))
    anio_creacion = createdate_dt.year  if createdate_dt else None
    mes_creacion  = createdate_dt.month if createdate_dt else None

    # Proyecto
    raw_proyecto    = props.get("lista_proyectos_negocios_sinco") or props.get("proyecto") or ""
    proyecto_limpio = limpiar_nombre_proyecto(raw_proyecto)

    deal_id    = legal_to_deal.get(obj_id)
    deal_props = deals_map.get(str(deal_id),{}) if deal_id else {}

    if proyecto_limpio == "SIN ASIGNAR":
        raw_deal = (deal_props.get("lista_proyectos_negocios_sinco") or
                    deal_props.get("nombre_de_proyecto___negocio") or "")
        if raw_deal:
            proyecto_limpio = limpiar_nombre_proyecto(raw_deal)

    director = asignar_director(proyecto_limpio)
    ciudad   = get_ciudad_strict(proyecto_limpio)
    ciudad_del_negocio = props.get("ciudad_del_negocio","") or ciudad

    # Tiempos
    dt_consig    = date_entered["date_entered_consignacion"]
    dt_l_espera  = date_entered["date_entered_legal_espera"]
    dt_l_apr_dir = date_entered["date_entered_legal_aprobada_dir"]
    dt_rev_sinco = date_entered["date_entered_revision_sinco"]
    dt_apr_exit  = date_entered["date_entered_aprobado_exitoso"]
    dt_apr_ger   = date_entered.get("date_entered_aprobado_gerencia")
    dt_apr_nov   = date_entered["date_entered_aprobado_novedades"]
    fecha_apr_dt = dt_from_date(fecha_aprobacion)

    dias_en_consignacion       = dias_entre(dt_consig,    dt_l_espera  or dt_l_apr_dir or fecha_apr_dt)
    dias_en_legal_espera       = dias_entre(dt_l_espera,  dt_l_apr_dir or fecha_apr_dt)
    dias_en_legal_aprobada_dir = dias_entre(dt_l_apr_dir, dt_rev_sinco or fecha_apr_dt)
    dias_en_revision_sinco     = dias_entre(dt_rev_sinco, fecha_apr_dt)
    dias_consignacion_a_aprobacion = dias_entre(dt_consig, fecha_apr_dt)

    # Aging
    aging_dias = None
    time_raw   = props.get("hs_v2_time_in_current_stage")
    if time_raw:
        try:
            v = str(time_raw)
            if v.isdigit() and len(v) > 10:
                aging_dias = round(int(v)/86_400_000, 2)
        except Exception:
            pass

    # Ventana de cierre
    en_ventana_cierre = calcular_ventana_cierre(
        etapa_codigo, dt_apr_exit, dt_apr_nov, fecha_aprobacion, dt_apr_ger)

    # Caída
    dt_caida   = date_entered["date_entered_venta_caida"]
    anio_caida = dt_caida.year  if dt_caida else None
    mes_caida  = dt_caida.month if dt_caida else None

    # URL
    hubspot_url = f"https://app.hubspot.com/contacts/{portal_id}/record/2-58255488/{obj_id}"

    return {
        "hs_object_id":             int(obj_id) if obj_id.isdigit() else None,
        "nombre_legalizacion":      props.get("nombre_de_legalizaci_n",""),
        "hs_pipeline_stage":        stage_raw,
        "etapa_codigo":             etapa_codigo,
        "grupo":                    grupo,
        "decision_final_legalizacion":   props.get("decision_final_legalizacion",""),
        "verificacion_documental_sinco": props.get("verificacion_documental_sinco",""),
        "motivo_de_observacion":         props.get("motivo_de_observacion",""),
        "estado_sarlaft":                props.get("estado_sarlaft",""),
        "fecha_aprobacion_final":        fecha_aprobacion,
        "fecha_envio_sarlaft":           parse_fecha(props.get("fecha_envio_sarlaft")),
        "fecha_respuesta_sarlaft":       parse_fecha(props.get("fecha_respuesta_sarlaft")),
        "lista_proyectos_negocios_sinco": props.get("lista_proyectos_negocios_sinco",""),
        "proyecto":                 raw_proyecto,
        "proyecto_limpio":          proyecto_limpio,
        "ciudad_del_negocio":       ciudad_del_negocio,
        "ciudad":                   ciudad,
        "director":                 director,
        "torre":                    props.get("torre",""),
        "valor_del_inmueble":       float(props.get("valor_del_inmueble") or 0) or None,
        "tipo_de_cuenta_de_consignacion_de_separacion": props.get("tipo_de_cuenta_de_consignacion_de_separacion",""),
        "nombrecomprador":          props.get("nombrecomprador",""),
        "documento_comprador_1":    props.get("documento_comprador_1",""),
        "documento_comprador_2":    props.get("documento_comprador_2",""),
        "propietario_del_negocio":  props.get("propietario_del_negocio",""),
        "hubspot_owner_id":         props.get("hubspot_owner_id",""),
        "id_negocio_comercial_origen": props.get("id_negocio_comercial_origen"),
        "hs_v2_time_in_current_stage": time_raw,
        "hs_createdate":            createdate_dt,
        "hs_lastmodifieddate":      parse_datetime(props.get("hs_lastmodifieddate")),
        "anio":                     anio,
        "mes":                      mes,
        "anio_creacion":            anio_creacion,
        "mes_creacion":             mes_creacion,
        "anio_caida":               anio_caida,
        "mes_caida":                mes_caida,
        **date_entered,
        "deal_id":                  int(deal_id) if deal_id and str(deal_id).isdigit() else None,
        "dealstage":                deal_props.get("dealstage",""),
        "canal_atribucion":         deal_props.get("canal_de_atribucion_conaltura_negocio",""),
        "canal_gestion_original":   deal_props.get("canal_de_gestion_comercial_original_negocio",""),
        "canal_gestion_secundario": deal_props.get("canal_de_gestion_comercial_secundario_negocio",""),
        "numero_unidad":            deal_props.get("numero_de_la_unidad_del_proyecto___negocio_conaltura",""),
        "invdescunidad":            deal_props.get("invdescunidad",""),
        "dias_en_consignacion":         dias_en_consignacion,
        "dias_en_legal_espera":         dias_en_legal_espera,
        "dias_en_legal_aprobada_dir":   dias_en_legal_aprobada_dir,
        "dias_en_revision_sinco":       dias_en_revision_sinco,
        "dias_consignacion_a_aprobacion": dias_consignacion_a_aprobacion,
        "date_entered_aprobado_gerencia": date_entered.get("date_entered_aprobado_gerencia"),
        "en_ventana_cierre":            en_ventana_cierre,
        "aging_dias":                   aging_dias,
        "hubspot_url":                  hubspot_url,
        "updated_at":                   datetime.now(TZ_COLOMBIA),
    }


# ==========================================
# ⚙️ TRANSFORMACIÓN + DIAGNÓSTICO DE TRANSFORM
# ==========================================
def transform_all(records, legal_to_deal, deals_map, portal_id) -> pd.DataFrame:
    print(f"⏳ Transformando {len(records)} registros...")
    rows, errores = [], 0
    for rec in records:
        try:
            rows.append(transform_legalizacion(rec, legal_to_deal, deals_map, portal_id))
        except Exception as e:
            errores += 1
            print(f"   ⚠️  Error registro {rec.get('id','?')}: {e}")

    df = pd.DataFrame(rows)
    if df.empty:
        print("⚠️  DataFrame vacío.")
        return df

    total = len(df)
    print(f"✅ {total} filas transformadas ({errores} errores)\n")

    print("=" * 70)
    print("📊 DIAGNÓSTICO DE TRANSFORMACIÓN v3.0")
    print("=" * 70)

    # 1. Cohortes
    print("\n  1. DISTRIBUCIÓN POR COHORTE")
    print(f"  {'─'*55}")
    for g, lbl in [("pipeline","Pipeline — en proceso"),
                   ("resolucion","Resolución — con fecha madre"),
                   ("caida","Venta Caída"),
                   ("desconocido","Stage no mapeado")]:
        n = (df["grupo"] == g).sum()
        print(f"  {lbl:<45}  {n:>5}  ({n/total*100:5.1f}%)")

    # 2. Stages individuales
    print("\n  2. DISTRIBUCIÓN POR STAGE INDIVIDUAL")
    print(f"  {'─'*55}")
    sc = df["etapa_codigo"].value_counts()
    for codigo in STAGE_ORDEN:
        info = next((v for v in STAGE_MAP.values() if v["codigo"]==codigo),{})
        n    = sc.get(codigo, 0)
        bar  = "█" * int(n/total*50) if total else ""
        print(f"  {info.get('label',''):<50}  {n:>5}  {bar}")

    # 3. Resoluciones
    res_df = df[df["grupo"]=="resolucion"]
    n_res  = len(res_df)
    if n_res:
        print(f"\n  3. RESOLUCIONES ({n_res} con fecha madre)")
        print(f"  {'─'*55}")
        for cod, lbl in [("aprobado_exitoso","Aprobadas sin novedades"),
                         ("aprobado_novedades","Aprobadas con novedades"),
                         ("aprobado_gerencia","Aprobadas por Gerencia Comercial"),
                         ("negocio_rechazado","Rechazadas")]:
            n = (res_df["etapa_codigo"]==cod).sum()
            print(f"  {lbl:<45}  {n:>5}  ({n/n_res*100:5.1f}%)")
        n_apr  = ((res_df["etapa_codigo"]=="aprobado_exitoso")|(res_df["etapa_codigo"]=="aprobado_novedades")|(res_df["etapa_codigo"]=="aprobado_gerencia")).sum()
        n_vent = res_df["en_ventana_cierre"].sum()
        print(f"  {'KPI 6 — En ventana de cierre':<45}  {int(n_vent):>5}  ({n_vent/n_apr*100 if n_apr else 0:5.1f}% de aprobadas)")

    # 4. Cobertura
    print(f"\n  4. COBERTURA DE DATOS")
    print(f"  {'─'*55}")
    for lbl, mask in [
        ("Con Deal asociado",          df["deal_id"].notna()),
        ("Con proyecto asignado",      df["proyecto_limpio"]!="SIN ASIGNAR"),
        ("Con fecha_aprobacion_final", df["fecha_aprobacion_final"].notna()),
        ("Con date_entered_consig.",   df["date_entered_consignacion"].notna()),
    ]:
        n = mask.sum()
        print(f"  {lbl:<45}  {n:>5}  ({n/total*100:5.1f}%)")

    # 5. Lead time por proyecto
    df_lt = df[df["dias_consignacion_a_aprobacion"].notna()].copy()
    if not df_lt.empty:
        print(f"\n  5. LEAD TIME POR PROYECTO ({len(df_lt)} con dato)")
        print(f"  {'─'*68}")
        print(f"  {'Proyecto':<30}  {'N':>4}  {'Prom':>8}  {'Med':>8}  {'Mín':>6}  {'Máx':>6}")
        print(f"  {'─'*68}")
        resumen = (df_lt.groupby("proyecto_limpio")["dias_consignacion_a_aprobacion"]
                   .agg(n="count",promedio="mean",mediana="median",minimo="min",maximo="max")
                   .sort_values("promedio", ascending=False).reset_index())
        for _, f in resumen.iterrows():
            print(f"  {str(f['proyecto_limpio'])[:29]:<30}  {int(f['n']):>4}  "
                  f"{f['promedio']:>6.1f}d  {f['mediana']:>6.1f}d  "
                  f"{f['minimo']:>4.0f}d  {f['maximo']:>4.0f}d")
        print(f"  {'─'*68}")
        print(f"  {'GLOBAL':<30}  {len(df_lt):>4}  "
              f"{df_lt['dias_consignacion_a_aprobacion'].mean():>6.1f}d  "
              f"{df_lt['dias_consignacion_a_aprobacion'].median():>6.1f}d  "
              f"{df_lt['dias_consignacion_a_aprobacion'].min():>4.0f}d  "
              f"{df_lt['dias_consignacion_a_aprobacion'].max():>4.0f}d")

    print("\n" + "=" * 70 + "\n")
    return df


# ==========================================
# 🔍 MODO MUESTRA
# ==========================================
def imprimir_muestra(records, legal_to_deal, deals_map):
    print("\n" + "="*70)
    print(f"🔍 MODO MUESTRA — {min(len(records),LIMITE_MUESTRA)} registros")
    print("="*70)
    for i, rec in enumerate(records[:LIMITE_MUESTRA]):
        props   = rec.get("properties",{})
        obj_id  = str(rec.get("id",""))
        deal_id = legal_to_deal.get(obj_id,"SIN DEAL")
        dp      = deals_map.get(str(deal_id),{})
        si      = STAGE_MAP.get(str(props.get("hs_pipeline_stage","")),{"label":"?","codigo":"?"})
        print(f"\n{'─'*70}")
        print(f"📋 REGISTRO {i+1} | ID: {obj_id}")
        print(f"  Stage: {props.get('hs_pipeline_stage','')} → {si['label']}")
        print(f"  Proyecto raw : {props.get('lista_proyectos_negocios_sinco','') or props.get('proyecto','')}")
        print(f"  Fecha aprobación: {props.get('fecha_aprobacion_final','(vacía)')}")
        print(f"\n  📅 Fechas de entrada a stages:")
        for sid, fname in DATE_ENTERED_FIELDS.items():
            val = props.get(fname,"")
            lbl = STAGE_MAP.get(sid,{}).get("label",sid)
            if val:
                print(f"     ✅ {lbl:<45} → {parse_datetime(val)}")
            else:
                print(f"     ─  {lbl:<45} → (vacío)")
        print(f"\n  🔗 Deal: {deal_id}")
        if dp:
            print(f"     canal_atrib : {dp.get('canal_de_atribucion_conaltura_negocio','')}")
            print(f"     invdescunidad: {dp.get('invdescunidad','(vacío)')}")
        print(f"\n  📦 JSON crudo:")
        print(json.dumps({k:v for k,v in props.items() if v},indent=4,ensure_ascii=False,default=str))
    print("\n"+"="*70+"\n✅ FIN MUESTRA\n"+"="*70)


# ==========================================
# 💾 CARGA A NEON
# ==========================================
def sync_proyectos_master(df: pd.DataFrame, engine) -> None:
    print("🔄 Sincronizando proyectos_master...")
    proyectos = df[["proyecto_limpio","director","ciudad"]].drop_duplicates()
    inserted = updated = 0
    with engine.begin() as conn:
        # La tabla ya existe gracias al schema.sql, pero por seguridad:
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
                CONSTRAINT proyectos_master_pkey PRIMARY KEY (id),
                CONSTRAINT proyectos_master_codigo_unique UNIQUE (codigo_proyecto)
            )
        """))
        for _, row in proyectos.iterrows():
            nombre = row["proyecto_limpio"]
            if not nombre or nombre == "SIN ASIGNAR":
                continue
            exists = conn.execute(text(
                "SELECT id,director,ciudad FROM proyectos_master WHERE codigo_proyecto=:c"
            ),{"c":nombre}).fetchone()
            if not exists:
                conn.execute(text("""
                    INSERT INTO proyectos_master (codigo_proyecto,nombre_proyecto,director,ciudad,activo)
                    VALUES (:c,:n,:d,:ci,true) ON CONFLICT (codigo_proyecto) DO NOTHING
                """),{"c":nombre,"n":nombre,"d":row["director"],"ci":row["ciudad"]})
                inserted += 1
            elif exists[1]!=row["director"] or exists[2]!=row["ciudad"]:
                conn.execute(text("""
                    UPDATE proyectos_master
                    SET director=:d,ciudad=:ci,fecha_actualizacion=CURRENT_TIMESTAMP
                    WHERE codigo_proyecto=:c
                """),{"c":nombre,"d":row["director"],"ci":row["ciudad"]})
                updated += 1
    print(f"  ✅ insertados: {inserted} | actualizados: {updated}\n")


def load_to_neon(df: pd.DataFrame, engine) -> None:
    print("⏳ Cargando datos a Neon...")

    # raw_legalizaciones — TRUNCATE + INSERT (full reload idempotente)
    print("  💾 raw_legalizaciones: TRUNCATE + INSERT...")
    with engine.begin() as conn:
        # Crea la tabla si aún no existe (idempotente aunque ya exista por schema.sql)
        conn.execute(text("""
            CREATE TABLE IF NOT EXISTS raw_legalizaciones (
                hs_object_id BIGINT PRIMARY KEY,
                nombre_legalizacion TEXT,
                hs_pipeline_stage TEXT, etapa_codigo TEXT, grupo TEXT,
                decision_final_legalizacion TEXT, verificacion_documental_sinco TEXT,
                motivo_de_observacion TEXT, estado_sarlaft TEXT,
                fecha_aprobacion_final DATE, fecha_envio_sarlaft DATE,
                fecha_respuesta_sarlaft DATE,
                lista_proyectos_negocios_sinco TEXT, proyecto TEXT,
                proyecto_limpio TEXT, ciudad_del_negocio TEXT, ciudad TEXT,
                director TEXT, torre TEXT, valor_del_inmueble NUMERIC,
                tipo_de_cuenta_de_consignacion_de_separacion TEXT,
                nombrecomprador TEXT, documento_comprador_1 TEXT,
                documento_comprador_2 TEXT, propietario_del_negocio TEXT,
                hubspot_owner_id TEXT, id_negocio_comercial_origen BIGINT,
                hs_v2_time_in_current_stage TEXT,
                hs_createdate TIMESTAMPTZ, hs_lastmodifieddate TIMESTAMPTZ,
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
                deal_id BIGINT, dealstage TEXT,
                canal_atribucion TEXT, canal_gestion_original TEXT,
                canal_gestion_secundario TEXT, numero_unidad TEXT, invdescunidad TEXT,
                dias_en_consignacion NUMERIC, dias_en_legal_espera NUMERIC,
                dias_en_legal_aprobada_dir NUMERIC, dias_en_revision_sinco NUMERIC,
                dias_consignacion_a_aprobacion NUMERIC,
                en_ventana_cierre BOOLEAN, aging_dias NUMERIC,
                hubspot_url TEXT, updated_at TIMESTAMPTZ
            )
        """))
        conn.execute(text("TRUNCATE TABLE raw_legalizaciones"))

    df.to_sql("raw_legalizaciones", engine, if_exists="append", index=False, method="multi")
    print(f"  ✅ {len(df)} filas insertadas")

    # bi_legalizaciones_final — DROP + CREATE AS SELECT (reconstrucción completa)
    print("  💾 bi_legalizaciones_final: reconstruyendo...")
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
                    COUNT(*) AS cnt_total_resolucion,
                    COUNT(*) FILTER (WHERE en_ventana_cierre=TRUE) AS cnt_en_ventana_cierre,
                    SUM(valor_del_inmueble) AS suma_valor_inmueble,
                    ROUND(AVG(dias_consignacion_a_aprobacion)::NUMERIC,2) AS avg_lead_time_dias,
                    ROUND(PERCENTILE_CONT(0.5) WITHIN GROUP
                          (ORDER BY dias_consignacion_a_aprobacion)::NUMERIC,2) AS p50_lead_time_dias,
                    ROUND(PERCENTILE_CONT(0.9) WITHIN GROUP
                          (ORDER BY dias_consignacion_a_aprobacion)::NUMERIC,2) AS p90_lead_time_dias,
                    ROUND(AVG(dias_en_consignacion)::NUMERIC,2)   AS avg_dias_consignacion,
                    ROUND(AVG(dias_en_legal_espera)::NUMERIC,2)   AS avg_dias_legal_espera,
                    ROUND(AVG(dias_en_revision_sinco)::NUMERIC,2) AS avg_dias_revision_sinco
                FROM raw_legalizaciones
                WHERE anio IS NOT NULL AND mes IS NOT NULL
                GROUP BY proyecto_limpio,director,ciudad,
                         canal_atribucion,canal_gestion_original,anio,mes
            ),
            caidas AS (
                SELECT
                    proyecto_limpio AS proyecto,
                    anio_caida AS anio, mes_caida AS mes,
                    COUNT(*) AS cnt_venta_caida
                FROM raw_legalizaciones
                WHERE anio_caida IS NOT NULL AND mes_caida IS NOT NULL
                GROUP BY proyecto_limpio,anio_caida,mes_caida
            ),
            pipeline AS (
                SELECT
                    proyecto_limpio AS proyecto,
                    COUNT(*) FILTER (WHERE etapa_codigo='consignacion')       AS cnt_pipeline_consignacion,
                    COUNT(*) FILTER (WHERE etapa_codigo='legal_espera')       AS cnt_pipeline_legal_espera,
                    COUNT(*) FILTER (WHERE etapa_codigo='legal_aprobada_dir') AS cnt_pipeline_legal_aprobada_dir,
                    COUNT(*) FILTER (WHERE etapa_codigo='revision_sinco')     AS cnt_pipeline_revision_sinco,
                    COUNT(*) AS cnt_pipeline_total
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
    print("✅ CARGA COMPLETADA\n")


# ==========================================
# 📊 DIAGNÓSTICO POST-CARGA (cuadre matemático)
# ==========================================
def diagnostico_db(engine) -> None:
    print("\n" + "=" * 70)
    print("📊 DIAGNÓSTICO POST-CARGA — CUADRE MATEMÁTICO")
    print("=" * 70)

    with engine.connect() as conn:

        # ── Conteos base ──────────────────────────────────────────────────
        r = conn.execute(text("""
            SELECT
                COUNT(*)                                                  AS total,
                COUNT(*) FILTER (WHERE grupo='pipeline')                  AS n_pipeline,
                COUNT(*) FILTER (WHERE grupo='resolucion')                AS n_resolucion,
                COUNT(*) FILTER (WHERE grupo='caida')                     AS n_caida,
                COUNT(*) FILTER (WHERE grupo='desconocido')               AS n_desconocido,
                COUNT(*) FILTER (WHERE etapa_codigo='aprobado_exitoso')   AS n_exitoso,
                COUNT(*) FILTER (WHERE etapa_codigo='aprobado_novedades') AS n_novedades,
                COUNT(*) FILTER (WHERE etapa_codigo='negocio_rechazado')  AS n_rechazado,
                COUNT(*) FILTER (WHERE deal_id IS NOT NULL)               AS con_deal,
                COUNT(*) FILTER (WHERE proyecto_limpio='SIN ASIGNAR')     AS sin_proyecto,
                COUNT(*) FILTER (WHERE en_ventana_cierre=TRUE)            AS en_ventana
            FROM raw_legalizaciones
        """)).fetchone()

        total        = r[0]
        n_pipeline   = r[1]
        n_resolucion = r[2]
        n_caida      = r[3]
        n_desc       = r[4]
        n_exitoso    = r[5]
        n_novedades  = r[6]
        n_rechazado  = r[7]

        print(f"\n  ┌─ CUADRE 1: Cohortes (deben sumar el total)")
        print(f"  │  Total registros          : {total}")
        print(f"  │  Pipeline (en proceso)    : {n_pipeline}")
        print(f"  │  Resolución (fecha madre) : {n_resolucion}")
        print(f"  │  Venta Caída              : {n_caida}")
        print(f"  │  Stage desconocido        : {n_desc}")
        cuadre1 = n_pipeline + n_resolucion + n_caida + n_desc
        ok1 = "✅ OK" if cuadre1 == total else f"❌ DIFERENCIA: {total - cuadre1}"
        print(f"  │  Suma cohortes            : {cuadre1}  ← {ok1}")

        print(f"\n  ├─ CUADRE 2: Resolución (exitoso + novedades + rechazado = resolución)")
        print(f"  │  Aprobadas sin novedades  : {n_exitoso}")
        print(f"  │  Aprobadas con novedades  : {n_novedades}")
        print(f"  │  Rechazadas               : {n_rechazado}")
        cuadre2 = n_exitoso + n_novedades + n_rechazado
        ok2 = "✅ OK" if cuadre2 == n_resolucion else f"❌ DIFERENCIA: {n_resolucion - cuadre2}"
        print(f"  │  Suma resolución          : {cuadre2}  ← {ok2}")
        print(f"  │  Registros grupo resolución: {n_resolucion}")

        print(f"\n  ├─ COBERTURA DE DATOS")
        print(f"  │  Con Deal asociado        : {r[8]}  ({r[8]/total*100:.1f}%)")
        print(f"  │  Sin proyecto asignado    : {r[9]}  ({r[9]/total*100:.1f}%)")
        print(f"  │  En ventana de cierre     : {r[10]}  (KPI 6)")

        # ── Caídas del mes (cohorte C) ────────────────────────────────────
        r_caidas = conn.execute(text("""
            SELECT anio_caida, mes_caida, COUNT(*) AS n
            FROM raw_legalizaciones
            WHERE anio_caida IS NOT NULL
            GROUP BY anio_caida, mes_caida
            ORDER BY anio_caida DESC, mes_caida DESC
            LIMIT 6
        """)).fetchall()

        print(f"\n  ├─ VENTAS CAÍDAS POR MES (cohorte C — últimos 6 meses con dato)")
        if r_caidas:
            for row in r_caidas:
                print(f"  │  {row[0]}-{row[1]:02d}  →  {row[2]} caídas")
        else:
            print(f"  │  Sin datos de caídas aún")

        # ── Desglose por director ─────────────────────────────────────────
        r_dir = conn.execute(text("""
            SELECT
                director,
                COUNT(*) AS total,
                COUNT(*) FILTER (WHERE grupo='pipeline') AS pipeline,
                COUNT(*) FILTER (WHERE grupo='resolucion') AS resolucion,
                COUNT(*) FILTER (WHERE etapa_codigo IN ('aprobado_exitoso','aprobado_novedades')) AS aprobadas
            FROM raw_legalizaciones
            GROUP BY director
            ORDER BY total DESC
        """)).fetchall()

        print(f"\n  ├─ DESGLOSE POR DIRECTOR")
        print(f"  │  {'Director':<30}  {'Total':>6}  {'Pipeline':>8}  {'Resoluc.':>8}  {'Aprobadas':>9}")
        print(f"  │  {'─'*65}")
        for row in r_dir:
            print(f"  │  {str(row[0])[:29]:<30}  {row[1]:>6}  {row[2]:>8}  {row[3]:>8}  {row[4]:>9}")

        # ── Desglose por proyecto (top 10) ────────────────────────────────
        r_proy = conn.execute(text("""
            SELECT
                proyecto_limpio,
                COUNT(*) AS total,
                COUNT(*) FILTER (WHERE grupo='pipeline') AS pipeline,
                COUNT(*) FILTER (WHERE etapa_codigo IN ('aprobado_exitoso','aprobado_novedades')) AS aprobadas,
                ROUND(AVG(dias_consignacion_a_aprobacion)::NUMERIC,1) AS prom_lead_time
            FROM raw_legalizaciones
            GROUP BY proyecto_limpio
            ORDER BY total DESC
            LIMIT 15
        """)).fetchall()

        print(f"\n  ├─ TOP 15 PROYECTOS (por volumen)")
        print(f"  │  {'Proyecto':<30}  {'Total':>6}  {'Pipeline':>8}  {'Aprobadas':>9}  {'Lead time':>10}")
        print(f"  │  {'─'*70}")
        for row in r_proy:
            lt = f"{row[4]:.1f}d" if row[4] else "  —"
            print(f"  │  {str(row[0])[:29]:<30}  {row[1]:>6}  {row[2]:>8}  {row[3]:>9}  {lt:>10}")

        # ── Chequeos de calidad ───────────────────────────────────────────
        r_cal = conn.execute(text("""
            SELECT
                -- Resoluciones sin fecha madre (error de datos)
                COUNT(*) FILTER (WHERE grupo='resolucion' AND fecha_aprobacion_final IS NULL)
                    AS resolucion_sin_fecha,
                -- Pipeline con fecha madre (incoherencia)
                COUNT(*) FILTER (WHERE grupo='pipeline' AND fecha_aprobacion_final IS NOT NULL)
                    AS pipeline_con_fecha,
                -- Sin date_entered_consignacion (limita cálculo de lead time)
                COUNT(*) FILTER (WHERE date_entered_consignacion IS NULL AND grupo IN ('pipeline','resolucion'))
                    AS sin_date_entered_consig,
                -- Tiempos negativos (imposibles)
                COUNT(*) FILTER (WHERE dias_consignacion_a_aprobacion < 0)
                    AS lead_time_negativo,
                -- Lead time > 180 días (posibles outliers)
                COUNT(*) FILTER (WHERE dias_consignacion_a_aprobacion > 180)
                    AS lead_time_outlier_180d,
                -- Sin valor del inmueble
                COUNT(*) FILTER (WHERE valor_del_inmueble IS NULL OR valor_del_inmueble = 0)
                    AS sin_valor_inmueble
            FROM raw_legalizaciones
        """)).fetchone()

        print(f"\n  └─ CHEQUEOS DE CALIDAD")
        checks = [
            ("Resoluciones sin fecha madre (error)",      r_cal[0], r_cal[0] > 0),
            ("Pipeline con fecha madre (incoherencia)",   r_cal[1], r_cal[1] > 0),
            ("Sin date_entered_consignacion",             r_cal[2], r_cal[2] > total*0.3),
            ("Lead time negativo (tiempo imposible)",     r_cal[3], r_cal[3] > 0),
            ("Lead time > 180 días (posible outlier)",    r_cal[4], False),
            ("Sin valor del inmueble",                    r_cal[5], r_cal[5] > total*0.1),
        ]
        for lbl, val, es_alerta in checks:
            icono = "⚠️ " if es_alerta else "✅"
            print(f"     {icono}  {lbl:<50}  {val:>5}")

        # ── bi_legalizaciones_final ───────────────────────────────────────
        r_mart = conn.execute(text("""
            SELECT
                COUNT(*) AS filas,
                SUM(cnt_total_resolucion) AS tot_res,
                SUM(cnt_aprobado_exitoso) AS exitoso,
                SUM(cnt_aprobado_novedades) AS novedades,
                SUM(cnt_negocio_rechazado) AS rechazado,
                SUM(cnt_venta_caida) AS caidas,
                SUM(cnt_pipeline_total) AS pipeline_snap
            FROM bi_legalizaciones_final
        """)).fetchone()
        print(f"\n  bi_legalizaciones_final:")
        print(f"    Filas en mart    : {r_mart[0]}")
        print(f"    Resolución total : {r_mart[1]}  (= {r_mart[2]} exit + {r_mart[3]} nov + {r_mart[4]} rech)")
        print(f"    Ventas caídas    : {r_mart[5]}")
        print(f"    Pipeline snapshot: {r_mart[6]}")

        r_pm = conn.execute(text("SELECT COUNT(*) FROM proyectos_master")).scalar()
        print(f"\n  proyectos_master : {r_pm} proyectos")

    print("\n" + "=" * 70 + "\n")


# ==========================================
# 🚀 EJECUCIÓN PRINCIPAL
# ==========================================
if __name__ == "__main__":
    print("=" * 70)
    print("🏢 CONALTURA — ETL LEGALIZACIONES v3.0")
    modo_str = ("MUESTRA" if MODO_MUESTRA else
                "VERIFY"  if MODO_VERIFY  else
                "TRANSFORM (sin carga)" if MODO_TRANSFORM else
                "COMPLETO (producción)")
    print(f"   Modo : {modo_str}")
    print(f"   DB   : {'DATABASE_URL configurada ✅' if DATABASE_URL else '⚠️  DATABASE_URL vacía (solo muestra/transform/verify)'}")
    print("=" * 70)
    print(f"📅 {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}\n")

    if not HUBSPOT_TOKEN:
        print("❌ HUBSPOT_API_KEY no definido.")
        sys.exit(1)

    start = time.time()

    try:
        if MODO_MUESTRA or MODO_VERIFY:
            verificar_propiedades_objeto_legal()
        if MODO_VERIFY:
            print("\n✅ Verificación completada.")
            sys.exit(0)

        portal_id = get_portal_id_api()
        print(f"🔑 Portal ID: {portal_id}\n")

        limite  = LIMITE_MUESTRA if MODO_MUESTRA else None
        records = fetch_legalizaciones(limite=limite)
        if not records:
            print("⚠️  Sin registros.")
            sys.exit(1)

        legal_ids     = [str(r.get("id","")) for r in records]
        legal_to_deal = fetch_associations_to_deals(legal_ids)
        deal_ids      = list(set(legal_to_deal.values()))
        deals_map     = fetch_deals_by_ids(deal_ids)

        if MODO_MUESTRA:
            imprimir_muestra(records, legal_to_deal, deals_map)
            print(f"\n⏱️  {time.time()-start:.1f}s  |  ✅ MUESTRA COMPLETADA (sin BD)")
            sys.exit(0)

        df = transform_all(records, legal_to_deal, deals_map, portal_id)

        if MODO_TRANSFORM:
            print(f"\n⏱️  {time.time()-start:.1f}s  |  ✅ TRANSFORMACIÓN COMPLETADA (sin BD)")
            sys.exit(0)

        # ── CARGA A NEON ─────────────────────────────────────────────────
        if not DATABASE_URL:
            print("❌ DATABASE_URL no configurada. Agrega el secret en GitHub.")
            sys.exit(1)

        engine = create_engine(DATABASE_URL, pool_pre_ping=True)
        sync_proyectos_master(df, engine)
        load_to_neon(df, engine)
        diagnostico_db(engine)

        elapsed = time.time() - start
        print("=" * 70)
        print(f"🎉 ETL LEGALIZACIONES v3.0 COMPLETADO")
        print(f"⏱️  Tiempo total: {elapsed:.1f}s")
        print("=" * 70)

    except Exception as e:
        print(f"\n{'='*70}\n💥 ERROR CRÍTICO: {e}\n{'='*70}")
        import traceback; traceback.print_exc()
        sys.exit(1)
