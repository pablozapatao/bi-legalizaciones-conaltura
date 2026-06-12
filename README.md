# BI Legalizaciones Conaltura

Sistema analítico de Legalizaciones de Venta — objeto HubSpot `2-58255488`.

## Estructura

```
├── .github/workflows/etl.yml     # GitHub Actions (cron 2h + dispatch manual)
├── etl_legalizaciones.py          # ETL Python principal
├── requirements.txt               # Dependencias Python
└── dashboard/                     # App Next.js (se crea en Fase 2)
```

## Modos de ejecución del ETL

| Modo | Comando | Descripción |
|------|---------|-------------|
| Muestra | `--muestra` | 5 registros + verificación de propiedades HubSpot (sin BD) |
| Verify | `--verify` | Solo verifica propiedades HubSpot (sin extracción, sin BD) |
| Completo | (sin args) | ETL completo → Neon |

## Secrets de GitHub Actions requeridos

| Secret | Descripción |
|--------|-------------|
| `HUBSPOT_API_KEY` | Token de la Private App de HubSpot |
| `DB_HOST` | Host de Neon |
| `DB_USER` | Usuario de Neon |
| `DB_PASSWORD` | Contraseña de Neon |

## Variables de entorno Vercel (dashboard)

| Variable | Descripción |
|----------|-------------|
| `DATABASE_URL` | Connection string completa de Neon |
| `SITE_PASSWORD` | Contraseña del dashboard |
