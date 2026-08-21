# Database

Este directorio es la fuente versionada de los cambios físicos de PostgreSQL/Supabase.

## Estructura

- `migrations/`: DDL/DML versionado.
- `validation/`: validaciones posteriores por migración.
- `tests/`: invariantes, RLS y regresión de schema.
- `seeds/`: únicamente datos semilla seguros; nunca inventario/ventas/clientes reales.

## Regla de migración

EXPAND → BACKFILL → VALIDATE → CUTOVER → DEPRECATE → REMOVE.

No se ejecutan migraciones de Fase 0.1.4 durante el bootstrap.
