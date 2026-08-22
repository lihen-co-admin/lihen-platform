# FASE 2.10 / 2.11 — Dashboard operativo, integridad y auditoría

## Objetivo
Convertir el Dashboard en una lectura operacional real y agregar una bitácora append-only para operaciones controladas.

## Dashboard
`operational_dashboard_summary` es una vista `security_invoker=true`. Resume productos, inventario, proveedores, compras, pedidos, ventas, cuentas, saldos canónicos, integridad y cantidad de operaciones auditadas.

## Auditoría
`operational_audit_log` no se escribe desde el navegador. Triggers privados proyectan únicamente operaciones persistidas desde los ledgers de idempotencia controlados. La tabla no guarda request fingerprints ni snapshots completos; expone módulo, tipo de operación, actor, entidad y fecha.

## Seguridad
- SELECT solo para perfiles ACTIVE con rol OWNER/ADMIN mediante RLS.
- INSERT/UPDATE/DELETE no se otorgan a `authenticated`.
- La función trigger vive en `lihen_private` y no es ejecutable directamente por navegador.
- Los dry-runs con `ROLLBACK` no dejan auditoría.

## Estado DEV
- Dashboard: 952 productos, 8 ON_HAND, 0 RESERVED, 0 PENDING_IN al momento del gate.
- Integridad: 0 incidencias.
- Auditoría: 0 operaciones persistidas al momento del gate; correcto antes de iniciar operación canónica real.
