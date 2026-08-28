# TANDA 9 — Dashboard Intelligence · CUT 2
Fecha: 2026-08-28

## Objetivo
Agregar una capa de integridad propia del read model del Dashboard antes de interpretar salud operativa o recomendaciones.

## Implementación
Se agrega `evaluateDashboardMetricIntegrity(...)` con estado:
- PASS
- BLOCKED

Valida de forma determinística:
- métricas numéricas finitas;
- conteos no negativos;
- `productsActive <= productsTotal`;
- `stockAvailableTotal = stockOnHandTotal - stockReservedTotal`.

La fórmula de disponibilidad no es un threshold inventado: reproduce la semántica canónica de `public.inventory_stock`.

No se bloquea un balance financiero negativo únicamente por su signo; esa semántica pertenece al dominio financiero y no se redefine desde el Dashboard.

## Integración
`evaluateDashboardOperationalHealth(...)` ahora recibe `dashboardMetricIntegrityStatus`.
Un resumen matemáticamente inconsistente entra en foco `INTEGRITY`.

El Dashboard muestra:
- `Dashboard integrity`;
- cantidad de métricas verificadas;
- explicación de coherencia del read model.

## Seguridad
- READ ONLY.
- Sin writes.
- Sin RPC nuevos.
- Sin migraciones.
- Sin auto-repair.
- Sin auto-execution.
- Sin cambios PROD.
