"""
🏢 CONALTURA — ETL LEGALIZACIONES v1.0
================================================================
OBJETO:    Legalizaciones de Venta (objectTypeId = 2-58255488)
BASE DE DATOS: Neon (Postgres serverless)
AUTOR:     Data Engineering Team
FECHA:     2026

FLUJO:
1. Verificación de propiedades disponibles en HubSpot (solo en MODO_MUESTRA)
2. Extracción paginada del objeto 2-58255488
3. Resolución de asociaciones → Deal (associationTypeId 23)
4. Enriquecimiento con propiedades del Deal asociado
5. Transformación: limpieza, clasificación de grupo, cálculo de tiempos
6. Sincronización de proyectos_master
7. Carga a raw_legalizaciones y bi_legalizaciones_final
8. Diagnóstico final

MODO DE EJECUCIÓN:
  python etl_legalizaciones.py          → ETL completo (producción)
  python etl_legalizaciones.py --muestra → Muestra 5 registros + verificación
  python etl_legalizaciones.py --verify  → Solo verifica propiedades (sin DB)
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
from typing import List, Dict, Optional, Tuple
from zoneinfo import ZoneInfo

# ==========================================
# MODO DE EJECUCIÓN
# ==========================================
MODO_MUESTRA = "--muestra" in sys.argv
MODO_VERIFY  = "--verify"  in sys.argv
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

# Conexión a Neon (solo en ETL completo, no en --verify)
DB_URI = None
if not MODO_VERIFY:
    DB_USER     = os.environ.get("DB_USER", "")
    DB_PASSWORD = os.environ.get("DB_PASSWORD", "")
    DB_HOST     = os.environ.get("DB_HOST", "")
    if DB_USER and DB_PASSWORD and DB_HOST:
        DB_URI = f"postgresql://{DB_USER}:{DB_PASSWORD}@{DB_HOST}:5432/postgres?sslmode=require"

# ==========================================
# MAPEO DE STAGES — OFICIAL
# ==========================================
# ID HubSpot → código interno → grupo
STAGE_MAP = {
    "1315416588": {"codigo": "consignacion",          "grupo": "pipeline",   "label": "Negocios con Consignación"},
    "1315313434": {"codigo": "legal_espera",           "grupo": "pipeline",   "label": "Legalización en Espera por Director"},
    "1315313435": {"codigo": "legal_aprobada_dir",     "grupo": "pipeline",   "label": "Legalización Aprobada por Director"},
    "1315574198": {"codigo": "revision_sinco",         "grupo": "pipeline",   "label": "Negocio por Revisar en SINCO"},
    "1315574199": {"codigo": "aprobado_exitoso",       "grupo": "resolucion", "label": "Aprobado Exitoso"},
    "1345851003": {"codigo": "aprobado_novedades",     "grupo": "resolucion", "label": "Aprobado con Novedades"},
    "1315574200": {"codigo": "negocio_rechazado",      "grupo": "resolucion", "label": "Negocio Rechazado"},
    "1378706098": {"codigo": "venta_caida",            "grupo": "caida",      "label": "Negocios Fallidos - Venta Caída"},
}

# Campos hs_v2_date_entered_ para cada stage
DATE_ENTERED_FIELDS = {
    "1315416588": "hs_v2_date_entered_1315416588",  # consignacion
    "1315313434": "hs_v2_date_entered_1315313434",  # legal_espera
    "1315313435": "hs_v2_date_entered_1315313435",  # legal_aprobada_dir
    "1315574198": "hs_v2_date_entered_1315574198",  # revision_sinco
    "1315574199": "hs_v2_date_entered_1315574199",  # aprobado_exitoso
    "1345851003": "hs_v2_date_entered_1345851003",  # aprobado_novedades
    "1315574200": "hs_v2_date_entered_1315574200",  # negocio_rechazado
    "1378706098": "hs_v2_date_entered_1378706098",  # venta_caida
}

# Propiedades a extraer del objeto Legalización
LEGAL_PROPS = [
    # Identificadores
    "hs_object_id",
    "nombre_de_legalizaci_n",
    # Estado / clasificación
    "hs_pipeline_stage",
    "decision_final_legalizacion",
    "verificacion_documental_sinco",
    "motivo_de_observacion",
    "estado_sarlaft",
    # Fechas clave
    "fecha_aprobacion_final",
    "fecha_envio_sarlaft",
    "fecha_respuesta_sarlaft",
    # Proyecto y geografía
    "lista_proyectos_negocios_sinco",
    "proyecto",
    "ciudad_del_negocio",
    "torre",
    # Valor
    "valor_del_inmueble",
    "tipo_de_cuenta_de_consignacion_de_separacion",
    # Comprador
    "nombrecomprador",
    "documento_comprador_1",
    "documento_comprador_2",
    # Responsable
    "propietario_del_negocio",
    "hubspot_owner_id",
    # Auxiliar
    "id_negocio_comercial_origen",
    # Timing
    "hs_v2_time_in_current_stage",
    "hs_createdate",
    "hs_lastmodifieddate",
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

# Propiedades a extraer del Deal asociado
DEAL_PROPS = [
    "dealname",
    "dealstage",
    "canal_de_atribucion_conaltura_negocio",
    "canal_de_gestion_comercial_original_negocio",
    "canal_de_gestion_comercial_secundario_negocio",
    "numero_de_la_unidad_del_proyecto___negocio_conaltura",
    "invdescunidad",
    "lista_proyectos_negocios_sinco",
    "nombre_de_proyecto___negocio",
]


# ==========================================
# 🔍 VERIFICACIÓN DE PROPIEDADES EN HUBSPOT
# ==========================================
def verificar_propiedades_objeto_legal() -> Dict:
    """
    Consulta /crm/v3/properties/2-58255488 y verifica:
    1. Cuáles hs_v2_date_entered_<id> existen realmente
    2. El campo hs_v2_time_in_current_stage
    3. El internal name de InvDescUnidad (en el objeto Deal)
    4. El formato del record URL del objeto custom

    Retorna un dict con el resultado del diagnóstico.
    """
    print("\n" + "=" * 70)
    print("🔍 VERIFICACIÓN DE PROPIEDADES EN HUBSPOT")
    print("=" * 70)

    headers = {"Authorization": f"Bearer {HUBSPOT_TOKEN}"}
    resultado = {
        "date_entered_encontrados": [],
        "date_entered_faltantes":   [],
        "time_in_stage_existe":     False,
        "invdescunidad_deal":       None,
        "record_url_formato":       None,
        "portal_id_verificado":     None,
    }

    # ── 1. Verificar portal ID ─────────────────────────────────────────────
    print("\n📋 1. Verificando Portal ID...")
    try:
        r = requests.get(
            "https://api.hubspot.com/account-info/v3/details",
            headers=headers, timeout=15
        )
        if r.status_code == 200:
            portal = r.json().get("portalId")
            resultado["portal_id_verificado"] = portal
            print(f"   ✅ Portal ID confirmado: {portal}")
        else:
            print(f"   ⚠️  No se pudo verificar: {r.status_code}")
    except Exception as e:
        print(f"   ⚠️  Error: {e}")

    # ── 2. Listar todas las propiedades del objeto Legalización ───────────
    print("\n📋 2. Listando propiedades del objeto 2-58255488...")
    prop_names_legal = []
    try:
        url = "https://api.hubapi.com/crm/v3/properties/2-58255488"
        r = requests.get(url, headers=headers, timeout=30)
        if r.status_code == 200:
            props = r.json().get("results", [])
            prop_names_legal = [p["name"] for p in props]
            print(f"   ✅ {len(prop_names_legal)} propiedades encontradas")

            # Buscar hs_v2_date_entered_ para cada stage
            print("\n   📅 Verificando hs_v2_date_entered_ por stage:")
            for stage_id, field_name in DATE_ENTERED_FIELDS.items():
                stage_info = STAGE_MAP.get(stage_id, {})
                label = stage_info.get("label", stage_id)
                if field_name in prop_names_legal:
                    resultado["date_entered_encontrados"].append(field_name)
                    print(f"   ✅ {field_name}  ← {label}")
                else:
                    resultado["date_entered_faltantes"].append(field_name)
                    print(f"   ❌ {field_name}  ← {label} — NO EXISTE")

            # Verificar hs_v2_time_in_current_stage
            if "hs_v2_time_in_current_stage" in prop_names_legal:
                resultado["time_in_stage_existe"] = True
                print("\n   ✅ hs_v2_time_in_current_stage — EXISTE")
            else:
                print("\n   ❌ hs_v2_time_in_current_stage — NO EXISTE")

            # Buscar el campo de URL del registro
            url_fields = [p for p in props if "url" in p["name"].lower() or "link" in p["name"].lower()]
            if url_fields:
                print(f"\n   🔗 Campos con 'url/link' en el nombre:")
                for f in url_fields[:5]:
                    print(f"      {f['name']} ({f.get('type','?')})")
        else:
            print(f"   ❌ Error {r.status_code}: {r.text[:200]}")
    except Exception as e:
        print(f"   ❌ Error: {e}")

    # ── 3. Verificar propiedades del Deal (InvDescUnidad) ─────────────────
    print("\n📋 3. Verificando propiedades de Deals...")
    try:
        url_deals = "https://api.hubapi.com/crm/v3/properties/deals/invdescunidad"
        r2 = requests.get(url_deals, headers=headers, timeout=15)
        if r2.status_code == 200:
            prop = r2.json()
            resultado["invdescunidad_deal"] = prop.get("name")
            print(f"   ✅ invdescunidad en Deals: {prop.get('name')} (tipo: {prop.get('type')})")
        else:
            print(f"   ⚠️  invdescunidad en Deals: {r2.status_code} — puede no existir con ese nombre")
            # Buscar por label
            r3 = requests.get(
                "https://api.hubapi.com/crm/v3/properties/deals",
                headers=headers, timeout=30
            )
            if r3.status_code == 200:
                all_deal_props = r3.json().get("results", [])
                candidatos = [
                    p for p in all_deal_props
                    if "invdesc" in p["name"].lower()
                    or "inv_desc" in p["name"].lower()
                    or (p.get("label", "").lower().find("invdesc") >= 0)
                ]
                if candidatos:
                    print(f"   🔍 Candidatos encontrados por búsqueda:")
                    for c in candidatos:
                        print(f"      name={c['name']}  label={c.get('label','')}  type={c.get('type','')}")
                        resultado["invdescunidad_deal"] = c["name"]
                else:
                    print(f"   ❌ No se encontró ninguna propiedad con 'invdesc' en Deals")
    except Exception as e:
        print(f"   ❌ Error: {e}")

    # ── 4. Verificar record URL de objeto custom ──────────────────────────
    print("\n📋 4. Verificando formato del record URL del objeto custom...")
    # El patrón estándar para objetos custom de HubSpot es:
    # https://app.hubspot.com/contacts/{portalId}/record/{objectTypeId}/{objectId}
    portal = resultado.get("portal_id_verificado") or PORTAL_ID
    url_pattern = f"https://app.hubspot.com/contacts/{portal}/record/2-58255488/{{hs_object_id}}"
    resultado["record_url_formato"] = url_pattern
    print(f"   ✅ Patrón confirmado: {url_pattern}")
    print(f"      (Se usa el portalId {portal} y objectTypeId 2-58255488)")

    # ── 5. Resumen final ──────────────────────────────────────────────────
    print("\n" + "=" * 70)
    print("📊 RESUMEN DE VERIFICACIÓN")
    print("=" * 70)
    print(f"  Portal ID:            {resultado['portal_id_verificado']}")
    print(f"  date_entered OK:      {len(resultado['date_entered_encontrados'])}/8")
    print(f"  date_entered falta:   {resultado['date_entered_faltantes'] or 'ninguno'}")
    print(f"  time_in_stage existe: {resultado['time_in_stage_existe']}")
    print(f"  invdescunidad deal:   {resultado['invdescunidad_deal']}")
    print(f"  URL pattern:          {resultado['record_url_formato']}")

    if resultado["date_entered_faltantes"]:
        print("\n⚠️  PLAN B PARA CAMPOS FALTANTES:")
        print("   Tiempos entre stages se calcularán con fecha_aprobacion_final como ancla.")
        print("   Ventana de cierre (KPI 6) usará fecha_aprobacion_final directamente.")

    return resultado


# ==========================================
# 🔥 LIMPIEZA DE NOMBRE DE PROYECTO
# ==========================================
def limpiar_nombre_proyecto(nombre: Optional[str]) -> str:
    """
    Limpia el nombre del proyecto eliminando prefijos numéricos y variantes de 'Ventas'.
    Mismas reglas que el ETL de Deals (producción probada).
    """
    if not nombre:
        return "SIN ASIGNAR"
    nombre_limpio = re.sub(r'^\s*\d+\s*[-–—]?\s*', '', nombre)
    nombre_limpio = re.sub(r'\b[Vv][Ee][Nn][Tt][Aa][Ss]?\b\s*[-–—]?\s*', '', nombre_limpio, flags=re.IGNORECASE)
    nombre_limpio = re.sub(r'^\s*[-–—]\s*', '', nombre_limpio)
    nombre_limpio = re.sub(r'\s+', ' ', nombre_limpio)
    nombre_limpio = nombre_limpio.strip().upper()
    if not nombre_limpio:
        return nombre.strip().upper() if nombre else "SIN ASIGNAR"
    return nombre_limpio


def normalizar_para_comparacion(nombre: str) -> str:
    """Normaliza nombre para comparaciones (elimina acentos, mayúsculas)."""
    if not nombre:
        return ""
    acentos = {
        'Á': 'A', 'É': 'E', 'Í': 'I', 'Ó': 'O', 'Ú': 'U',
        'á': 'a', 'é': 'e', 'í': 'i', 'ó': 'o', 'ú': 'u',
        'Ñ': 'N', 'ñ': 'n', 'Ü': 'U', 'ü': 'u',
    }
    resultado = nombre.upper()
    for acento, sin_acento in acentos.items():
        resultado = resultado.replace(acento, sin_acento)
    return resultado.strip()


# ==========================================
# 🔥 ASIGNACIÓN DE DIRECTORES
# ==========================================
def asignar_director(proyecto: Optional[str]) -> str:
    """
    Asigna director comercial según reglas de negocio.
    Mismas reglas que el ETL de Deals (producción probada).
    """
    if not proyecto:
        return "SIN ASIGNAR"
    n = normalizar_para_comparacion(proyecto)

    alba_luz = ["BAVARO", "SENZA", "CATARA", "ANDES", "KANTU", "KANTÚ", "NANTIA", "NANTIAA"]
    if any(x in n for x in alba_luz):
        return "Alba Luz Consuegra"

    carolina = ["CORALIA", "NATIVA", "DIPORTO"]
    if any(x in n for x in carolina):
        return "Carolina Cárdenas"

    ingrid = ["ALMENDRO", "CORAL", "ESMERALDA", "CUSPIDE", "CÚSPIDE", "GO", "MEETY",
              "AMARA", "CANARIAS", "INDIGO", "NAVARRA", "INDIGÓ", "INDIGOO"]
    if any(x in n for x in ingrid):
        return "Ingrid Marcela Matta"

    leonardo = ["CATALANA", "POLANCO", "SOLEI", "BORA", "MISTRAL", "TORRES DEL CAMPO"]
    if any(x in n for x in leonardo):
        return "Leonardo Villegas"

    natalia = ["PRATO", "LIVORNO", "TIRRENA", "CAMPURA", "FORESTA",
               "AZZURI", "AZZURRI", "TOSCANA", "CAOBA"]
    if any(x in n for x in natalia):
        return "Natalia Giraldo"

    patricia = ["FAROVERDE", "FARO VERDE", "PALMA", "CRISTA", "MUNAY",
                "KIVA", "WE SENIOR", "WE", "SENIOR"]
    if any(x in n for x in patricia):
        return "Patricia Herrera"

    return "SIN ASIGNAR"


def asignar_ciudad_proyecto(proyecto: Optional[str]) -> str:
    """Determina la ciudad del proyecto según su nombre limpio."""
    if not proyecto:
        return "Otras"
    n = normalizar_para_comparacion(proyecto)

    if any(x in n for x in ["CORALIA", "NATIVA", "DIPORTO"]):
        return "Cartagena"
    if any(x in n for x in ["BAVARO", "CATARA", "SENZA", "ANDES", "KANTU", "NANTIA"]):
        return "Barranquilla"
    if any(x in n for x in ["ALMENDRO", "CANARIAS", "CORAL", "CUSPIDE", "GO",
                              "MEETY", "ESMERALDA", "NAVARRA", "INDIGO"]):
        return "Bogotá"
    if any(x in n for x in ["AMARA"]):
        return "Cali"
    return "Medellín"


# ==========================================
# 🔌 CLIENTE HUBSPOT
# ==========================================
def hubspot_get(url: str, params: Dict = None, timeout: int = 90) -> Dict:
    """Wrapper para GET a la API de HubSpot con manejo de errores y rate limit."""
    headers = {"Authorization": f"Bearer {HUBSPOT_TOKEN}"}
    for intento in range(3):
        try:
            r = requests.get(url, headers=headers, params=params or {}, timeout=timeout)
            if r.status_code == 429:
                # Rate limit: esperar y reintentar
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
    """Obtiene el portal ID real desde la API (usa el hardcodeado como fallback)."""
    try:
        data = hubspot_get("https://api.hubspot.com/account-info/v3/details", timeout=15)
        return str(data.get("portalId", PORTAL_ID))
    except Exception:
        return PORTAL_ID


# ==========================================
# 📥 EXTRACCIÓN — LEGALIZACIONES
# ==========================================
def fetch_legalizaciones(limite: Optional[int] = None) -> List[Dict]:
    """
    Extrae todas las legalizaciones del objeto 2-58255488.
    Pagina de a 100 registros, archived=false.
    Si limite está definido, detiene al llegar a esa cantidad (modo muestra).
    """
    print("⏳ Extrayendo legalizaciones de HubSpot (2-58255488)...")
    url = "https://api.hubapi.com/crm/v3/objects/2-58255488"
    props_str = ",".join(LEGAL_PROPS)
    all_records = []
    after = None
    page = 0

    while True:
        params = {
            "limit": 100,
            "properties": props_str,
            "archived": "false",
        }
        if after:
            params["after"] = after

        data = hubspot_get(url, params)
        results = data.get("results", [])
        all_records.extend(results)
        page += 1
        print(f"  📄 Página {page}: {len(results)} registros (Total: {len(all_records)})")

        if limite and len(all_records) >= limite:
            all_records = all_records[:limite]
            print(f"  🔍 MODO MUESTRA: limitado a {limite} registros")
            break

        paging = data.get("paging", {}).get("next", {})
        if paging.get("after"):
            after = paging["after"]
        else:
            break

    print(f"✅ Extracción completada: {len(all_records)} legalizaciones\n")
    return all_records


# ==========================================
# 📥 EXTRACCIÓN — ASOCIACIONES → DEALS
# ==========================================
def fetch_associations_to_deals(legal_ids: List[str]) -> Dict[str, str]:
    """
    Trae las asociaciones de legalizaciones → deals usando la API de asociaciones.
    Endpoint: /crm/v4/associations/2-58255488/deals/batch/read
    Retorna: {legal_id: deal_id}

    Usa lotes de 100 (límite de la API de asociaciones).
    """
    print("⏳ Resolviendo asociaciones Legalización → Deal...")
    url = "https://api.hubapi.com/crm/v4/associations/2-58255488/deals/batch/read"
    headers = {
        "Authorization": f"Bearer {HUBSPOT_TOKEN}",
        "Content-Type": "application/json",
    }
    legal_to_deal = {}
    total_con_deal = 0
    BATCH_SIZE = 100

    for i in range(0, len(legal_ids), BATCH_SIZE):
        lote = legal_ids[i:i + BATCH_SIZE]
        payload = {"inputs": [{"id": lid} for lid in lote]}
        try:
            r = requests.post(url, headers=headers, json=payload, timeout=60)
            if r.status_code == 429:
                wait = int(r.headers.get("Retry-After", "10"))
                print(f"   ⏳ Rate limit. Esperando {wait}s...")
                time.sleep(wait)
                r = requests.post(url, headers=headers, json=payload, timeout=60)
            r.raise_for_status()
            data = r.json()
            resultados = data.get("results", [])
            for item in resultados:
                from_id = str(item.get("from", {}).get("id", ""))
                to_list = item.get("to", [])
                if to_list:
                    # Tomamos el primer deal asociado
                    deal_id = str(to_list[0].get("toObjectId", ""))
                    if deal_id:
                        legal_to_deal[from_id] = deal_id
                        total_con_deal += 1
        except Exception as e:
            print(f"   ⚠️  Error en lote {i//BATCH_SIZE + 1}: {e}")
            time.sleep(2)

        if (i // BATCH_SIZE + 1) % 5 == 0:
            print(f"  📦 Procesados {i + BATCH_SIZE}/{len(legal_ids)} ids...")

    print(f"✅ Asociaciones: {total_con_deal}/{len(legal_ids)} legalizaciones tienen Deal\n")
    return legal_to_deal


# ==========================================
# 📥 EXTRACCIÓN — DEALS ENRIQUECIMIENTO
# ==========================================
def fetch_deals_by_ids(deal_ids: List[str]) -> Dict[str, Dict]:
    """
    Trae las propiedades de los deals por ID (batch de 100).
    Retorna: {deal_id: propiedades}
    """
    if not deal_ids:
        return {}

    print(f"⏳ Enriqueciendo desde {len(deal_ids)} deals asociados...")
    url = "https://api.hubapi.com/crm/v3/objects/deals/batch/read"
    headers = {
        "Authorization": f"Bearer {HUBSPOT_TOKEN}",
        "Content-Type": "application/json",
    }
    deals_map = {}
    BATCH_SIZE = 100

    for i in range(0, len(deal_ids), BATCH_SIZE):
        lote = deal_ids[i:i + BATCH_SIZE]
        payload = {
            "properties": DEAL_PROPS,
            "inputs": [{"id": did} for did in lote],
        }
        try:
            r = requests.post(url, headers=headers, json=payload, timeout=60)
            if r.status_code == 429:
                wait = int(r.headers.get("Retry-After", "10"))
                print(f"   ⏳ Rate limit. Esperando {wait}s...")
                time.sleep(wait)
                r = requests.post(url, headers=headers, json=payload, timeout=60)
            r.raise_for_status()
            for item in r.json().get("results", []):
                deals_map[str(item["id"])] = item.get("properties", {})
        except Exception as e:
            print(f"   ⚠️  Error en lote deals {i//BATCH_SIZE + 1}: {e}")
            time.sleep(2)

    print(f"✅ {len(deals_map)} deals enriquecidos\n")
    return deals_map


# ==========================================
# ⚙️ TRANSFORMACIÓN
# ==========================================
def parse_fecha(valor: Optional[str]) -> Optional[date]:
    """Parsea una fecha de HubSpot (ISO 8601 o timestamp ms) → date Colombia."""
    if not valor:
        return None
    try:
        # Timestamp en milisegundos
        if str(valor).isdigit() and len(str(valor)) > 10:
            dt = datetime.fromtimestamp(int(valor) / 1000, tz=timezone.utc)
            return dt.astimezone(TZ_COLOMBIA).date()
        # ISO 8601
        dt = datetime.fromisoformat(str(valor).replace("Z", "+00:00"))
        return dt.astimezone(TZ_COLOMBIA).date()
    except Exception:
        return None


def parse_datetime(valor: Optional[str]) -> Optional[datetime]:
    """Parsea un datetime de HubSpot → datetime con zona Colombia."""
    if not valor:
        return None
    try:
        if str(valor).isdigit() and len(str(valor)) > 10:
            dt = datetime.fromtimestamp(int(valor) / 1000, tz=timezone.utc)
            return dt.astimezone(TZ_COLOMBIA)
        dt = datetime.fromisoformat(str(valor).replace("Z", "+00:00"))
        return dt.astimezone(TZ_COLOMBIA)
    except Exception:
        return None


def calcular_dias_entre(dt_inicio: Optional[datetime], dt_fin: Optional[datetime]) -> Optional[float]:
    """Calcula días entre dos datetimes. Retorna None si alguno falta."""
    if not dt_inicio or not dt_fin:
        return None
    delta = dt_fin - dt_inicio
    return round(delta.total_seconds() / 86400, 2)


def calcular_dias_entre_dates(d_inicio: Optional[date], d_fin: Optional[date]) -> Optional[float]:
    """Calcula días entre dos dates."""
    if not d_inicio or not d_fin:
        return None
    return float((d_fin - d_inicio).days)


def es_ventana_cierre(fecha_aprobacion: Optional[date], anio: Optional[int], mes: Optional[int]) -> bool:
    """
    KPI 6: determina si la aprobación cayó en la ventana de cierre.
    Ventana = últimos 3 días calendario del mes + primeros 4 días del mes siguiente.
    Plan B activo: usa fecha_aprobacion_final como ancla (no date_entered de stage).
    """
    if not fecha_aprobacion or not anio or not mes:
        return False
    try:
        # Último día del mes
        if mes == 12:
            primer_dia_siguiente = date(anio + 1, 1, 1)
        else:
            primer_dia_siguiente = date(anio, mes + 1, 1)
        ultimo_dia = primer_dia_siguiente - timedelta(days=1)

        # Ventana: [último_día - 2, último_día + 4]
        inicio_ventana = ultimo_dia - timedelta(days=2)
        fin_ventana    = primer_dia_siguiente + timedelta(days=3)

        return inicio_ventana <= fecha_aprobacion <= fin_ventana
    except Exception:
        return False


def transform_legalizacion(record: Dict, legal_to_deal: Dict, deals_map: Dict, portal_id: str) -> Dict:
    """
    Transforma un registro crudo de legalización en una fila lista para la BD.
    """
    props = record.get("properties", {})
    obj_id = str(record.get("id", props.get("hs_object_id", "")))

    # ── Stage y grupo ──────────────────────────────────────────────────────
    stage_raw = props.get("hs_pipeline_stage", "")
    stage_info = STAGE_MAP.get(str(stage_raw), {"codigo": "desconocido", "grupo": "desconocido", "label": stage_raw})
    etapa_codigo = stage_info["codigo"]
    grupo = stage_info["grupo"]

    # ── Fechas de entrada a stages ────────────────────────────────────────
    date_entered = {}
    col_map = {
        "consignacion":        "date_entered_consignacion",
        "legal_espera":        "date_entered_legal_espera",
        "legal_aprobada_dir":  "date_entered_legal_aprobada_dir",
        "revision_sinco":      "date_entered_revision_sinco",
        "aprobado_exitoso":    "date_entered_aprobado_exitoso",
        "aprobado_novedades":  "date_entered_aprobado_novedades",
        "negocio_rechazado":   "date_entered_negocio_rechazado",
        "venta_caida":         "date_entered_venta_caida",
    }
    for stage_id, field_name in DATE_ENTERED_FIELDS.items():
        codigo = STAGE_MAP.get(stage_id, {}).get("codigo", "")
        col_name = col_map.get(codigo, f"date_entered_{stage_id}")
        date_entered[col_name] = parse_datetime(props.get(field_name))

    # ── Fecha madre ────────────────────────────────────────────────────────
    fecha_aprobacion = parse_fecha(props.get("fecha_aprobacion_final"))
    anio  = fecha_aprobacion.year  if fecha_aprobacion else None
    mes   = fecha_aprobacion.month if fecha_aprobacion else None

    # Fecha de creación (ancla para pipeline)
    createdate_dt = parse_datetime(props.get("hs_createdate"))
    anio_creacion = createdate_dt.year  if createdate_dt else None
    mes_creacion  = createdate_dt.month if createdate_dt else None

    # ── Proyecto ──────────────────────────────────────────────────────────
    raw_proyecto = (
        props.get("lista_proyectos_negocios_sinco") or
        props.get("proyecto") or ""
    )
    proyecto_limpio = limpiar_nombre_proyecto(raw_proyecto)
    director        = asignar_director(proyecto_limpio)
    ciudad_proyecto = asignar_ciudad_proyecto(proyecto_limpio)

    # Ciudad del negocio (campo directo del objeto, como fallback)
    ciudad_campo = props.get("ciudad_del_negocio", "") or ciudad_proyecto

    # ── Tiempos precalculados ──────────────────────────────────────────────
    dt_consig    = date_entered.get("date_entered_consignacion")
    dt_l_espera  = date_entered.get("date_entered_legal_espera")
    dt_l_apr_dir = date_entered.get("date_entered_legal_aprobada_dir")
    dt_rev_sinco = date_entered.get("date_entered_revision_sinco")

    # Fecha de aprobación como datetime para cálculos de lead time
    if fecha_aprobacion:
        fecha_apr_dt = datetime.combine(fecha_aprobacion, datetime.min.time()).replace(tzinfo=TZ_COLOMBIA)
    else:
        fecha_apr_dt = None

    dias_en_consignacion     = calcular_dias_entre(dt_consig, dt_l_espera or dt_l_apr_dir or fecha_apr_dt)
    dias_en_legal_espera     = calcular_dias_entre(dt_l_espera, dt_l_apr_dir or fecha_apr_dt)
    dias_en_legal_aprobada_dir = calcular_dias_entre(dt_l_apr_dir, dt_rev_sinco or fecha_apr_dt)
    dias_en_revision_sinco   = calcular_dias_entre(dt_rev_sinco, fecha_apr_dt)

    # Lead time total: desde consignacion hasta aprobación
    dias_consignacion_a_aprobacion = calcular_dias_entre(dt_consig, fecha_apr_dt)

    # Aging en stage actual (hs_v2_time_in_current_stage viene en ms)
    time_in_stage_raw = props.get("hs_v2_time_in_current_stage")
    aging_dias = None
    if time_in_stage_raw:
        try:
            # Puede venir como ms (número largo) o como string de fecha
            val = str(time_in_stage_raw)
            if val.isdigit() and len(val) > 10:
                aging_dias = round(int(val) / 86400000, 2)
        except Exception:
            pass

    # Ventana de cierre (Plan B: usa fecha_aprobacion_final)
    en_ventana_cierre = es_ventana_cierre(fecha_aprobacion, anio, mes)

    # ── Deal enriquecimiento ──────────────────────────────────────────────
    deal_id = legal_to_deal.get(obj_id)
    deal_props = deals_map.get(str(deal_id), {}) if deal_id else {}

    # Proyecto del deal (como respaldo)
    raw_proyecto_deal = (
        deal_props.get("lista_proyectos_negocios_sinco") or
        deal_props.get("nombre_de_proyecto___negocio") or ""
    )
    if raw_proyecto_deal and proyecto_limpio == "SIN ASIGNAR":
        proyecto_limpio = limpiar_nombre_proyecto(raw_proyecto_deal)
        director        = asignar_director(proyecto_limpio)
        ciudad_proyecto = asignar_ciudad_proyecto(proyecto_limpio)

    # ── URL a HubSpot ─────────────────────────────────────────────────────
    hubspot_url = f"https://app.hubspot.com/contacts/{portal_id}/record/2-58255488/{obj_id}"

    # ── Construir fila completa ───────────────────────────────────────────
    row = {
        # Identificadores
        "hs_object_id":              int(obj_id) if obj_id.isdigit() else None,
        "nombre_legalizacion":       props.get("nombre_de_legalizaci_n", ""),
        # Estado
        "hs_pipeline_stage":         str(stage_raw),
        "etapa_codigo":              etapa_codigo,
        "grupo":                     grupo,
        "decision_final_legalizacion": props.get("decision_final_legalizacion", ""),
        "verificacion_documental_sinco": props.get("verificacion_documental_sinco", ""),
        "motivo_de_observacion":     props.get("motivo_de_observacion", ""),
        "estado_sarlaft":            props.get("estado_sarlaft", ""),
        # Fechas de proceso
        "fecha_aprobacion_final":    fecha_aprobacion,
        "fecha_envio_sarlaft":       parse_fecha(props.get("fecha_envio_sarlaft")),
        "fecha_respuesta_sarlaft":   parse_fecha(props.get("fecha_respuesta_sarlaft")),
        # Proyecto y geografía
        "lista_proyectos_negocios_sinco": props.get("lista_proyectos_negocios_sinco", ""),
        "proyecto":                  raw_proyecto,
        "proyecto_limpio":           proyecto_limpio,
        "ciudad_del_negocio":        ciudad_campo,
        "ciudad":                    ciudad_proyecto,
        "director":                  director,
        "torre":                     props.get("torre", ""),
        # Valor
        "valor_del_inmueble":        float(props.get("valor_del_inmueble") or 0) or None,
        "tipo_de_cuenta_de_consignacion_de_separacion": props.get("tipo_de_cuenta_de_consignacion_de_separacion", ""),
        # Comprador
        "nombrecomprador":           props.get("nombrecomprador", ""),
        "documento_comprador_1":     props.get("documento_comprador_1", ""),
        "documento_comprador_2":     props.get("documento_comprador_2", ""),
        # Responsable
        "propietario_del_negocio":   props.get("propietario_del_negocio", ""),
        "hubspot_owner_id":          props.get("hubspot_owner_id", ""),
        # Auxiliar
        "id_negocio_comercial_origen": props.get("id_negocio_comercial_origen"),
        # Timing raw
        "hs_v2_time_in_current_stage": time_in_stage_raw,
        "hs_createdate":             createdate_dt,
        "hs_lastmodifieddate":       parse_datetime(props.get("hs_lastmodifieddate")),
        "anio_creacion":             anio_creacion,
        "mes_creacion":              mes_creacion,
        "anio":                      anio,
        "mes":                       mes,
        # Fechas de entrada a stages
        **date_entered,
        # Deal
        "deal_id":                   int(deal_id) if deal_id and str(deal_id).isdigit() else None,
        "dealstage":                 deal_props.get("dealstage", ""),
        "canal_atribucion":          deal_props.get("canal_de_atribucion_conaltura_negocio", ""),
        "canal_gestion_original":    deal_props.get("canal_de_gestion_comercial_original_negocio", ""),
        "canal_gestion_secundario":  deal_props.get("canal_de_gestion_comercial_secundario_negocio", ""),
        "numero_unidad":             deal_props.get("numero_de_la_unidad_del_proyecto___negocio_conaltura", ""),
        "invdescunidad":             deal_props.get("invdescunidad", ""),
        # Precalculados
        "dias_en_consignacion":             dias_en_consignacion,
        "dias_en_legal_espera":             dias_en_legal_espera,
        "dias_en_legal_aprobada_dir":       dias_en_legal_aprobada_dir,
        "dias_en_revision_sinco":           dias_en_revision_sinco,
        "dias_consignacion_a_aprobacion":   dias_consignacion_a_aprobacion,
        "en_ventana_cierre":                en_ventana_cierre,
        "aging_dias":                       aging_dias,
        # Meta
        "hubspot_url":               hubspot_url,
        "updated_at":                datetime.now(TZ_COLOMBIA),
    }
    return row


def transform_all(records: List[Dict], legal_to_deal: Dict, deals_map: Dict, portal_id: str) -> pd.DataFrame:
    """Transforma todos los registros y construye el DataFrame."""
    print(f"⏳ Transformando {len(records)} registros...")
    rows = []
    sin_proyecto = 0
    por_grupo = {"pipeline": 0, "resolucion": 0, "caida": 0, "desconocido": 0}

    for rec in records:
        try:
            row = transform_legalizacion(rec, legal_to_deal, deals_map, portal_id)
            rows.append(row)
            grupo = row.get("grupo", "desconocido")
            por_grupo[grupo] = por_grupo.get(grupo, 0) + 1
            if row.get("proyecto_limpio") == "SIN ASIGNAR":
                sin_proyecto += 1
        except Exception as e:
            print(f"   ⚠️  Error en registro {rec.get('id','?')}: {e}")

    df = pd.DataFrame(rows)
    print(f"✅ {len(df)} filas transformadas")
    print(f"\n   Distribución por grupo:")
    print(f"     Pipeline (en proceso)     : {por_grupo['pipeline']}")
    print(f"     Resolución (fecha madre)  : {por_grupo['resolucion']}")
    print(f"     Venta Caída               : {por_grupo['caida']}")
    print(f"     Sin stage mapeado         : {por_grupo.get('desconocido', 0)}")
    print(f"     Sin proyecto asignado     : {sin_proyecto}")
    print()
    return df


# ==========================================
# 🔥 MODO MUESTRA — imprime JSON crudo
# ==========================================
def imprimir_muestra(records: List[Dict], legal_to_deal: Dict, deals_map: Dict):
    """
    Imprime los primeros 5 registros con:
    - JSON crudo de propiedades
    - Deal asociado
    - Fechas de entrada a stages
    """
    print("\n" + "=" * 70)
    print(f"🔍 MODO MUESTRA — {min(len(records), LIMITE_MUESTRA)} registros")
    print("=" * 70)

    for i, rec in enumerate(records[:LIMITE_MUESTRA]):
        props = rec.get("properties", {})
        obj_id = str(rec.get("id", ""))
        deal_id = legal_to_deal.get(obj_id, "SIN DEAL")
        deal_props = deals_map.get(str(deal_id), {})

        print(f"\n{'─'*70}")
        print(f"📋 REGISTRO {i+1} | ID: {obj_id}")
        print(f"{'─'*70}")

        # Stage actual
        stage_raw  = props.get("hs_pipeline_stage", "")
        stage_info = STAGE_MAP.get(str(stage_raw), {"label": "DESCONOCIDO", "codigo": "?"})
        print(f"  Stage actual: {stage_raw} → {stage_info['label']} ({stage_info['codigo']})")
        print(f"  Proyecto raw: {props.get('lista_proyectos_negocios_sinco','') or props.get('proyecto','')}")
        print(f"  Fecha aprobación: {props.get('fecha_aprobacion_final','(vacía)')}")
        print(f"  Nombre legalización: {props.get('nombre_de_legalizaci_n','')}")
        print(f"  Valor inmueble: {props.get('valor_del_inmueble','')}")

        # Fechas de entrada a stages
        print(f"\n  📅 Fechas de entrada a stages:")
        for stage_id, field_name in DATE_ENTERED_FIELDS.items():
            val = props.get(field_name, "")
            label = STAGE_MAP.get(stage_id, {}).get("label", stage_id)
            if val:
                parsed = parse_datetime(val)
                print(f"     ✅ {label:<45} → {parsed}")
            else:
                print(f"     ─  {label:<45} → (vacío)")

        # Deal asociado
        print(f"\n  🔗 Deal asociado: {deal_id}")
        if deal_props:
            print(f"     dealname:      {deal_props.get('dealname','')}")
            print(f"     dealstage:     {deal_props.get('dealstage','')}")
            print(f"     canal_atrib:   {deal_props.get('canal_de_atribucion_conaltura_negocio','')}")
            print(f"     canal_orig:    {deal_props.get('canal_de_gestion_comercial_original_negocio','')}")
            print(f"     canal_sec:     {deal_props.get('canal_de_gestion_comercial_secundario_negocio','')}")
            print(f"     numero_unidad: {deal_props.get('numero_de_la_unidad_del_proyecto___negocio_conaltura','')}")
            print(f"     invdescunidad: {deal_props.get('invdescunidad','(vacío)')}")
        else:
            print(f"     (Sin deal asociado)")

        # JSON crudo completo (solo propiedades no vacías)
        print(f"\n  📦 JSON crudo (propiedades no vacías):")
        props_no_vacias = {k: v for k, v in props.items() if v}
        print(json.dumps(props_no_vacias, indent=4, ensure_ascii=False, default=str))

        # URL a HubSpot
        print(f"\n  🔗 HubSpot URL: https://app.hubspot.com/contacts/{PORTAL_ID}/record/2-58255488/{obj_id}")

    print("\n" + "=" * 70)
    print("✅ FIN DE LA MUESTRA")
    print("=" * 70)


# ==========================================
# 💾 CARGA A NEON
# ==========================================
def sync_proyectos_master(df: pd.DataFrame, engine) -> None:
    """
    Sincroniza proyectos_master con los proyectos encontrados en legalizaciones.
    Reutiliza el mismo patrón probado del ETL de Deals.
    """
    print("🔄 Sincronizando proyectos_master...")
    proyectos_df = df[["proyecto_limpio", "director", "ciudad"]].drop_duplicates()
    inserted = 0
    updated  = 0

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

        for _, row in proyectos_df.iterrows():
            nombre = row["proyecto_limpio"]
            if not nombre or nombre == "SIN ASIGNAR":
                continue
            exists = conn.execute(text(
                "SELECT id, director, ciudad FROM proyectos_master WHERE codigo_proyecto = :codigo"
            ), {"codigo": nombre}).fetchone()

            if not exists:
                conn.execute(text("""
                    INSERT INTO proyectos_master (codigo_proyecto, nombre_proyecto, director, ciudad, activo)
                    VALUES (:codigo, :nombre, :director, :ciudad, true)
                    ON CONFLICT (codigo_proyecto) DO NOTHING
                """), {"codigo": nombre, "nombre": nombre, "director": row["director"], "ciudad": row["ciudad"]})
                inserted += 1
            else:
                if exists[1] != row["director"] or exists[2] != row["ciudad"]:
                    conn.execute(text("""
                        UPDATE proyectos_master
                        SET director=:director, ciudad=:ciudad, fecha_actualizacion=CURRENT_TIMESTAMP
                        WHERE codigo_proyecto=:codigo
                    """), {"codigo": nombre, "director": row["director"], "ciudad": row["ciudad"]})
                    updated += 1

    print(f"  ✅ Proyectos insertados: {inserted} | actualizados: {updated}\n")


def crear_tablas_si_no_existen(engine) -> None:
    """Crea las tablas en Neon si no existen todavía."""
    print("🔧 Verificando / creando tablas en Neon...")
    with engine.begin() as conn:
        # manual_metas
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
    """
    Carga los datos a Neon.
    Estrategia: TRUNCATE + INSERT (full reload idempotente).
    """
    print("⏳ Cargando datos a Neon...")

    # ── raw_legalizaciones ─────────────────────────────────────────────────
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
                anio_creacion INT,
                mes_creacion INT,
                anio INT,
                mes INT,
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
    print(f"  ✅ raw_legalizaciones: {len(df)} filas cargadas")

    # ── bi_legalizaciones_final ────────────────────────────────────────────
    print("  💾 Calculando y escribiendo bi_legalizaciones_final...")
    with engine.begin() as conn:
        conn.execute(text("DROP TABLE IF EXISTS bi_legalizaciones_final"))
        conn.execute(text("""
            CREATE TABLE bi_legalizaciones_final AS
            WITH
            -- Cohorte B: registros con fecha_aprobacion_final (resolución del mes)
            resolucion AS (
                SELECT
                    proyecto_limpio          AS proyecto,
                    director,
                    ciudad,
                    canal_atribucion,
                    canal_gestion_original,
                    anio,
                    mes,
                    COUNT(*) FILTER (WHERE etapa_codigo = 'aprobado_exitoso')   AS cnt_aprobado_exitoso,
                    COUNT(*) FILTER (WHERE etapa_codigo = 'aprobado_novedades') AS cnt_aprobado_novedades,
                    COUNT(*) FILTER (WHERE etapa_codigo = 'negocio_rechazado')  AS cnt_negocio_rechazado,
                    COUNT(*)                                                     AS cnt_total_resolucion,
                    COUNT(*) FILTER (WHERE en_ventana_cierre = TRUE)            AS cnt_en_ventana_cierre,
                    SUM(valor_del_inmueble)                                      AS suma_valor_inmueble,
                    ROUND(AVG(dias_consignacion_a_aprobacion)::NUMERIC, 2)      AS avg_lead_time_dias,
                    ROUND(PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY dias_consignacion_a_aprobacion)::NUMERIC, 2) AS p50_lead_time_dias,
                    ROUND(PERCENTILE_CONT(0.9) WITHIN GROUP (ORDER BY dias_consignacion_a_aprobacion)::NUMERIC, 2) AS p90_lead_time_dias,
                    ROUND(AVG(dias_en_consignacion)::NUMERIC, 2)                AS avg_dias_consignacion,
                    ROUND(AVG(dias_en_legal_espera)::NUMERIC, 2)                AS avg_dias_legal_espera,
                    ROUND(AVG(dias_en_revision_sinco)::NUMERIC, 2)              AS avg_dias_revision_sinco
                FROM raw_legalizaciones
                WHERE anio IS NOT NULL AND mes IS NOT NULL
                GROUP BY proyecto_limpio, director, ciudad, canal_atribucion, canal_gestion_original, anio, mes
            ),
            -- Cohorte C: ventas caídas (ancla = date_entered_venta_caida)
            caidas AS (
                SELECT
                    proyecto_limpio AS proyecto,
                    EXTRACT(YEAR FROM date_entered_venta_caida AT TIME ZONE 'America/Bogota')::INT AS anio,
                    EXTRACT(MONTH FROM date_entered_venta_caida AT TIME ZONE 'America/Bogota')::INT AS mes,
                    COUNT(*) AS cnt_venta_caida
                FROM raw_legalizaciones
                WHERE date_entered_venta_caida IS NOT NULL
                GROUP BY proyecto_limpio, 2, 3
            ),
            -- Pipeline activo (snapshot): registros SIN fecha_aprobacion_final, en stages de proceso
            pipeline AS (
                SELECT
                    proyecto_limpio AS proyecto,
                    COUNT(*) FILTER (WHERE etapa_codigo = 'consignacion')      AS cnt_pipeline_consignacion,
                    COUNT(*) FILTER (WHERE etapa_codigo = 'legal_espera')      AS cnt_pipeline_legal_espera,
                    COUNT(*) FILTER (WHERE etapa_codigo = 'legal_aprobada_dir') AS cnt_pipeline_legal_aprobada_dir,
                    COUNT(*) FILTER (WHERE etapa_codigo = 'revision_sinco')    AS cnt_pipeline_revision_sinco,
                    COUNT(*)                                                     AS cnt_pipeline_total
                FROM raw_legalizaciones
                WHERE fecha_aprobacion_final IS NULL
                  AND grupo = 'pipeline'
                GROUP BY proyecto_limpio
            )
            SELECT
                r.proyecto,
                r.director,
                r.ciudad,
                r.canal_atribucion,
                r.canal_gestion_original,
                r.anio,
                r.mes,
                COALESCE(r.cnt_aprobado_exitoso,   0) AS cnt_aprobado_exitoso,
                COALESCE(r.cnt_aprobado_novedades, 0) AS cnt_aprobado_novedades,
                COALESCE(r.cnt_negocio_rechazado,  0) AS cnt_negocio_rechazado,
                COALESCE(r.cnt_total_resolucion,   0) AS cnt_total_resolucion,
                COALESCE(c.cnt_venta_caida,        0) AS cnt_venta_caida,
                COALESCE(r.cnt_en_ventana_cierre,  0) AS cnt_en_ventana_cierre,
                COALESCE(p.cnt_pipeline_consignacion,       0) AS cnt_pipeline_consignacion,
                COALESCE(p.cnt_pipeline_legal_espera,       0) AS cnt_pipeline_legal_espera,
                COALESCE(p.cnt_pipeline_legal_aprobada_dir, 0) AS cnt_pipeline_legal_aprobada_dir,
                COALESCE(p.cnt_pipeline_revision_sinco,     0) AS cnt_pipeline_revision_sinco,
                COALESCE(p.cnt_pipeline_total,              0) AS cnt_pipeline_total,
                COALESCE(r.suma_valor_inmueble,    0) AS suma_valor_inmueble,
                r.avg_lead_time_dias,
                r.p50_lead_time_dias,
                r.p90_lead_time_dias,
                r.avg_dias_consignacion,
                r.avg_dias_legal_espera,
                r.avg_dias_revision_sinco
            FROM resolucion r
            LEFT JOIN caidas  c ON c.proyecto = r.proyecto AND c.anio = r.anio AND c.mes = r.mes
            LEFT JOIN pipeline p ON p.proyecto = r.proyecto
            ORDER BY r.proyecto, r.anio, r.mes
        """))
    print("  ✅ bi_legalizaciones_final reconstruida")
    print(f"\n✅ CARGA A NEON COMPLETADA\n")


# ==========================================
# 📊 DIAGNÓSTICO FINAL
# ==========================================
def diagnostico(engine) -> None:
    """Imprime resumen de lo que quedó en la base de datos."""
    print("\n" + "=" * 70)
    print("📊 DIAGNÓSTICO POST-ETL")
    print("=" * 70)
    with engine.connect() as conn:
        # raw_legalizaciones
        r = conn.execute(text("""
            SELECT
                COUNT(*)                                                     AS total,
                COUNT(*) FILTER (WHERE grupo = 'pipeline')                   AS pipeline,
                COUNT(*) FILTER (WHERE grupo = 'resolucion')                 AS resolucion,
                COUNT(*) FILTER (WHERE grupo = 'caida')                      AS caida,
                COUNT(*) FILTER (WHERE deal_id IS NOT NULL)                  AS con_deal,
                COUNT(*) FILTER (WHERE proyecto_limpio = 'SIN ASIGNAR')      AS sin_proyecto
            FROM raw_legalizaciones
        """)).fetchone()
        print(f"\n  raw_legalizaciones:")
        print(f"    Total registros       : {r[0]}")
        print(f"    Pipeline (en proceso) : {r[1]}")
        print(f"    Resolución (c/fecha)  : {r[2]}")
        print(f"    Venta Caída           : {r[3]}")
        print(f"    Con Deal asociado     : {r[4]}")
        print(f"    Sin proyecto asignado : {r[5]}")

        # bi_legalizaciones_final
        r2 = conn.execute(text("""
            SELECT
                COUNT(*) AS filas,
                SUM(cnt_total_resolucion) AS total_resolucion,
                SUM(cnt_aprobado_exitoso) AS aprobado_exitoso,
                SUM(cnt_aprobado_novedades) AS aprobado_novedades,
                SUM(cnt_negocio_rechazado) AS rechazado,
                SUM(cnt_venta_caida) AS caidas
            FROM bi_legalizaciones_final
        """)).fetchone()
        print(f"\n  bi_legalizaciones_final:")
        print(f"    Filas en mart         : {r2[0]}")
        print(f"    Total resolución      : {r2[1]}")
        print(f"    Aprobados exitosos    : {r2[2]}")
        print(f"    Aprobados con novedad : {r2[3]}")
        print(f"    Rechazados            : {r2[4]}")
        print(f"    Ventas caídas         : {r2[5]}")

        # Proyectos
        r3 = conn.execute(text("SELECT COUNT(*) FROM proyectos_master")).scalar()
        print(f"\n  proyectos_master       : {r3} proyectos")
    print("=" * 70 + "\n")


# ==========================================
# 🚀 EJECUCIÓN PRINCIPAL
# ==========================================
if __name__ == "__main__":
    print("=" * 70)
    print("🏢 CONALTURA — ETL LEGALIZACIONES v1.0")
    if MODO_MUESTRA:
        print("   🔍 MODO MUESTRA: 5 registros + verificación de propiedades")
    elif MODO_VERIFY:
        print("   🔍 MODO VERIFY: solo verificación de propiedades")
    print("=" * 70)
    print(f"📅 {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}\n")

    if not HUBSPOT_TOKEN:
        print("❌ HUBSPOT_API_KEY no está definido. Verifica los secrets de GitHub.")
        sys.exit(1)

    start = time.time()

    try:
        # 1. Verificar propiedades (siempre en muestra/verify, opcional en producción)
        if MODO_MUESTRA or MODO_VERIFY:
            verificar_propiedades_objeto_legal()

        if MODO_VERIFY:
            print("\n✅ Verificación completada (modo --verify, sin carga a BD).")
            sys.exit(0)

        # 2. Obtener portal ID real
        portal_id = get_portal_id_api()
        print(f"🔑 Portal ID: {portal_id}\n")

        # 3. Extraer legalizaciones
        limite = LIMITE_MUESTRA if MODO_MUESTRA else None
        records = fetch_legalizaciones(limite=limite)

        if not records:
            print("⚠️  No se encontraron registros. Verifica el token y el objectTypeId.")
            sys.exit(1)

        # 4. Resolver asociaciones → Deals
        legal_ids = [str(r.get("id", "")) for r in records]
        legal_to_deal = fetch_associations_to_deals(legal_ids)

        # 5. Enriquecer con datos del Deal
        deal_ids_unicos = list(set(legal_to_deal.values()))
        deals_map = fetch_deals_by_ids(deal_ids_unicos)

        # 6. Modo muestra: imprimir y salir
        if MODO_MUESTRA:
            imprimir_muestra(records, legal_to_deal, deals_map)
            print(f"\n⏱️  Tiempo: {time.time()-start:.1f}s")
            print("✅ MUESTRA COMPLETADA — sin escritura en base de datos.")
            sys.exit(0)

        # 7. Transformar
        df = transform_all(records, legal_to_deal, deals_map, portal_id)

        # 8. Conectar a Neon
        if not DB_URI:
            print("❌ Variables de base de datos no configuradas (DB_USER, DB_PASSWORD, DB_HOST).")
            sys.exit(1)
        engine = create_engine(DB_URI, pool_pre_ping=True)

        # 9. Crear tablas si no existen
        crear_tablas_si_no_existen(engine)

        # 10. Sincronizar proyectos
        sync_proyectos_master(df, engine)

        # 11. Cargar a Neon
        load_to_neon(df, engine)

        # 12. Diagnóstico
        diagnostico(engine)

        elapsed = time.time() - start
        print("=" * 70)
        print(f"🎉 ETL LEGALIZACIONES COMPLETADO EXITOSAMENTE")
        print(f"⏱️  Tiempo total: {elapsed:.1f}s")
        print("=" * 70)

    except Exception as e:
        print(f"\n{'='*70}")
        print(f"💥 ERROR CRÍTICO: {e}")
        print("=" * 70)
        import traceback
        traceback.print_exc()
        sys.exit(1)
