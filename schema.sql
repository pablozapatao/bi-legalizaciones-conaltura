-- ============================================================
-- CONALTURA — BI LEGALIZACIONES: Schema en Neon (Postgres)
-- ============================================================
-- Cómo ejecutar:
--   1. Ve a console.neon.tech → tu proyecto → "SQL Editor"
--   2. Pega TODO este archivo y haz clic en "Run"
--   3. Verifica con: SELECT table_name FROM information_schema.tables
--      WHERE table_schema = 'public' ORDER BY table_name;
-- ============================================================

-- ------------------------------------------------------------
-- 1. proyectos_master — dimensión de proyectos
--    Sincronizada por el ETL desde lista_proyectos_negocios_sinco.
--    Mismas reglas de negocio que el BI de Deals.
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS proyectos_master (
    id                   SERIAL,
    codigo_proyecto      VARCHAR(255) NOT NULL,
    nombre_proyecto      VARCHAR(255) NOT NULL,
    director             VARCHAR(255) DEFAULT 'SIN ASIGNAR',
    ciudad               VARCHAR(100) DEFAULT 'Medellín',
    activo               BOOLEAN      DEFAULT true,
    fecha_creacion       TIMESTAMP    DEFAULT CURRENT_TIMESTAMP,
    fecha_actualizacion  TIMESTAMP    DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT proyectos_master_pkey           PRIMARY KEY (id),
    CONSTRAINT proyectos_master_codigo_unique  UNIQUE (codigo_proyecto)
);

COMMENT ON TABLE  proyectos_master               IS 'Dimensión de proyectos — sincronizada por ETL';
COMMENT ON COLUMN proyectos_master.codigo_proyecto IS 'Nombre limpio del proyecto (llave de unión)';
COMMENT ON COLUMN proyectos_master.director        IS 'Director comercial asignado por reglas de negocio';
COMMENT ON COLUMN proyectos_master.ciudad          IS 'Ciudad del proyecto (Medellín / Bogotá / Barranquilla / Cartagena / Cali)';


-- ------------------------------------------------------------
-- 2. manual_metas — meta mensual única de compañía
--    Editable desde el dashboard. El ETL nunca la toca.
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS manual_metas (
    id              SERIAL       PRIMARY KEY,
    anio            INT          NOT NULL,
    mes             INT          NOT NULL CHECK (mes BETWEEN 1 AND 12),
    meta_negocios   INT          NOT NULL DEFAULT 0 CHECK (meta_negocios >= 0),
    updated_at      TIMESTAMPTZ  DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT manual_metas_anio_mes_unique UNIQUE (anio, mes)
);

COMMENT ON TABLE  manual_metas             IS 'Meta mensual de legalizaciones — ingresada desde el dashboard';
COMMENT ON COLUMN manual_metas.meta_negocios IS 'Número objetivo de legalizaciones aprobadas (exitoso + novedades)';


-- ------------------------------------------------------------
-- 3. raw_legalizaciones — 1 fila por legalización
--    El ETL hace TRUNCATE + INSERT en cada corrida (full reload).
--    Incluye todas las propiedades del objeto + enriquecimiento
--    de Deal + columnas precalculadas de tiempos.
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS raw_legalizaciones (

    -- Identificadores
    hs_object_id                              BIGINT       PRIMARY KEY,
    nombre_legalizacion                       TEXT,

    -- Estado en el pipeline
    hs_pipeline_stage                         TEXT,
    etapa_codigo                              TEXT,  -- consignacion / legal_espera / etc.
    grupo                                     TEXT,  -- pipeline / resolucion / caida

    -- Dimensiones de estado
    decision_final_legalizacion               TEXT,
    verificacion_documental_sinco             TEXT,
    motivo_de_observacion                     TEXT,
    estado_sarlaft                            TEXT,

    -- Fechas de proceso
    fecha_aprobacion_final                    DATE,       -- FECHA MADRE (ancla KPIs de resolución)
    fecha_envio_sarlaft                       DATE,
    fecha_respuesta_sarlaft                   DATE,

    -- Proyecto y geografía
    lista_proyectos_negocios_sinco            TEXT,
    proyecto                                  TEXT,       -- valor raw de HubSpot
    proyecto_limpio                           TEXT,       -- limpiado por reglas ETL
    ciudad_del_negocio                        TEXT,       -- campo directo del objeto
    ciudad                                    TEXT,       -- ciudad derivada por reglas
    director                                  TEXT,       -- director asignado por reglas
    torre                                     TEXT,

    -- Valor económico
    valor_del_inmueble                        NUMERIC,
    tipo_de_cuenta_de_consignacion_de_separacion TEXT,

    -- Comprador
    nombrecomprador                           TEXT,
    documento_comprador_1                     TEXT,
    documento_comprador_2                     TEXT,

    -- Responsable operativo
    propietario_del_negocio                   TEXT,
    hubspot_owner_id                          TEXT,
    id_negocio_comercial_origen               BIGINT,

    -- Timing raw de HubSpot
    hs_v2_time_in_current_stage               TEXT,       -- ms en stage actual (raw string)
    hs_createdate                             TIMESTAMPTZ,
    hs_lastmodifieddate                       TIMESTAMPTZ,

    -- Dimensión temporal — resolución (fecha madre)
    anio                                      INT,        -- año de fecha_aprobacion_final (Colombia)
    mes                                       INT,        -- mes de fecha_aprobacion_final (Colombia)

    -- Dimensión temporal — creación (ancla pipeline)
    anio_creacion                             INT,        -- año de hs_createdate (Colombia)
    mes_creacion                              INT,        -- mes de hs_createdate (Colombia)

    -- Dimensión temporal — caída (ancla cohorte C)
    anio_caida                                INT,        -- año de date_entered_venta_caida (Colombia)
    mes_caida                                 INT,        -- mes de date_entered_venta_caida (Colombia)

    -- Fechas de entrada a cada stage (para análisis de tiempos)
    date_entered_consignacion                 TIMESTAMPTZ,  -- hs_v2_date_entered_1315416588
    date_entered_legal_espera                 TIMESTAMPTZ,  -- hs_v2_date_entered_1315313434
    date_entered_legal_aprobada_dir           TIMESTAMPTZ,  -- hs_v2_date_entered_1315313435
    date_entered_revision_sinco               TIMESTAMPTZ,  -- hs_v2_date_entered_1315574198
    date_entered_aprobado_exitoso             TIMESTAMPTZ,  -- hs_v2_date_entered_1315574199
    date_entered_aprobado_novedades           TIMESTAMPTZ,  -- hs_v2_date_entered_1345851003
    date_entered_negocio_rechazado            TIMESTAMPTZ,  -- hs_v2_date_entered_1315574200
    date_entered_venta_caida                  TIMESTAMPTZ,  -- hs_v2_date_entered_1378706098

    -- Enriquecimiento desde Deal asociado
    deal_id                                   BIGINT,
    dealstage                                 TEXT,
    canal_atribucion                          TEXT,       -- canal_de_atribucion_conaltura_negocio
    canal_gestion_original                    TEXT,       -- canal_de_gestion_comercial_original_negocio
    canal_gestion_secundario                  TEXT,       -- canal_de_gestion_comercial_secundario_negocio
    numero_unidad                             TEXT,       -- numero_de_la_unidad_del_proyecto
    invdescunidad                             TEXT,

    -- Columnas precalculadas de tiempos (días entre stages consecutivos)
    dias_en_consignacion                      NUMERIC,    -- consignacion → legal_espera
    dias_en_legal_espera                      NUMERIC,    -- legal_espera → legal_aprobada_dir
    dias_en_legal_aprobada_dir                NUMERIC,    -- legal_aprobada_dir → revision_sinco
    dias_en_revision_sinco                    NUMERIC,    -- revision_sinco → aprobación

    -- Lead time total
    dias_consignacion_a_aprobacion            NUMERIC,    -- consignacion → fecha_aprobacion_final

    -- KPI 6: ventana de cierre
    en_ventana_cierre                         BOOLEAN,    -- TRUE si aprobada en últimos 3d + primeros 4d

    -- Aging en stage actual
    aging_dias                                NUMERIC,    -- hs_v2_time_in_current_stage convertido a días

    -- Trazabilidad a HubSpot
    hubspot_url                               TEXT,       -- deep-link al record del objeto custom

    -- Control técnico
    updated_at                                TIMESTAMPTZ
);

COMMENT ON TABLE  raw_legalizaciones                         IS 'Una fila por legalización — full reload en cada corrida del ETL';
COMMENT ON COLUMN raw_legalizaciones.grupo                   IS 'pipeline | resolucion | caida';
COMMENT ON COLUMN raw_legalizaciones.etapa_codigo            IS 'Código interno: consignacion / legal_espera / legal_aprobada_dir / revision_sinco / aprobado_exitoso / aprobado_novedades / negocio_rechazado / venta_caida';
COMMENT ON COLUMN raw_legalizaciones.fecha_aprobacion_final  IS 'Fecha madre: ancla de los KPIs de resolución del mes';
COMMENT ON COLUMN raw_legalizaciones.en_ventana_cierre       IS 'KPI 6: aprobada en últimos 3 días del mes + primeros 4 del siguiente';
COMMENT ON COLUMN raw_legalizaciones.dias_consignacion_a_aprobacion IS 'Lead time total desde consignación hasta aprobación (días)';

-- Índices para el dashboard (filtros frecuentes)
CREATE INDEX IF NOT EXISTS idx_raw_grupo          ON raw_legalizaciones (grupo);
CREATE INDEX IF NOT EXISTS idx_raw_etapa          ON raw_legalizaciones (etapa_codigo);
CREATE INDEX IF NOT EXISTS idx_raw_anio_mes       ON raw_legalizaciones (anio, mes);
CREATE INDEX IF NOT EXISTS idx_raw_anio_mes_crea  ON raw_legalizaciones (anio_creacion, mes_creacion);
CREATE INDEX IF NOT EXISTS idx_raw_proyecto       ON raw_legalizaciones (proyecto_limpio);
CREATE INDEX IF NOT EXISTS idx_raw_director       ON raw_legalizaciones (director);
CREATE INDEX IF NOT EXISTS idx_raw_ciudad         ON raw_legalizaciones (ciudad);
CREATE INDEX IF NOT EXISTS idx_raw_canal_atr      ON raw_legalizaciones (canal_atribucion);


-- ------------------------------------------------------------
-- 4. bi_legalizaciones_final — mart agregado
--    Reconstruida completamente en cada corrida del ETL.
--    El dashboard lee principalmente de aquí para los KPIs.
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS bi_legalizaciones_final (

    -- Dimensiones de agrupación
    proyecto                          TEXT,
    director                          TEXT,
    ciudad                            TEXT,
    canal_atribucion                  TEXT,
    canal_gestion_original            TEXT,
    anio                              INT,
    mes                               INT,

    -- KPIs de resolución (cohorte B: con fecha_aprobacion_final)
    cnt_aprobado_exitoso              INT  DEFAULT 0,
    cnt_aprobado_novedades            INT  DEFAULT 0,
    cnt_negocio_rechazado             INT  DEFAULT 0,
    cnt_total_resolucion              INT  DEFAULT 0,  -- = exitoso + novedades + rechazado

    -- KPI 5: ventas caídas (cohorte C: por date_entered_venta_caida)
    cnt_venta_caida                   INT  DEFAULT 0,

    -- KPI 6: aprobadas en ventana de cierre
    cnt_en_ventana_cierre             INT  DEFAULT 0,

    -- Pipeline activo (snapshot — sin fecha madre)
    cnt_pipeline_consignacion         INT  DEFAULT 0,
    cnt_pipeline_legal_espera         INT  DEFAULT 0,
    cnt_pipeline_legal_aprobada_dir   INT  DEFAULT 0,
    cnt_pipeline_revision_sinco       INT  DEFAULT 0,
    cnt_pipeline_total                INT  DEFAULT 0,

    -- Valor económico
    suma_valor_inmueble               NUMERIC DEFAULT 0,

    -- Estadísticas de lead time (cohorte B)
    avg_lead_time_dias                NUMERIC,
    p50_lead_time_dias                NUMERIC,
    p90_lead_time_dias                NUMERIC,

    -- Estadísticas de tiempos por stage
    avg_dias_consignacion             NUMERIC,
    avg_dias_legal_espera             NUMERIC,
    avg_dias_revision_sinco           NUMERIC
);

COMMENT ON TABLE bi_legalizaciones_final IS 'Mart agregado por proyecto/director/ciudad/canal/año/mes — reconstruido por el ETL';


-- ------------------------------------------------------------
-- VERIFICACIÓN FINAL
-- Corre esto después del INSERT para confirmar que todo quedó:
-- ------------------------------------------------------------
/*
SELECT
    table_name,
    pg_size_pretty(pg_total_relation_size(quote_ident(table_name))) AS tamaño
FROM information_schema.tables
WHERE table_schema = 'public'
ORDER BY table_name;
*/
