# FASE 3 — Estado pre-cutover

## Estado

| Subfase | Estado |
|---|---|
| 3.1 Intake + Reconciliation Gate | DEV listo |
| 3.2 Snapshot exporter legacy | Preparado |
| 3.3 Reconciliación por dominio | Infraestructura lista |
| 3.4 Inventario | Infraestructura lista |
| 3.5 Proveedores / compras | Infraestructura lista |
| 3.6 Pedidos | Infraestructura lista |
| 3.7 Ventas | Infraestructura lista |
| 3.8 Finanzas | Infraestructura lista |
| 3.9 Dry-run + readiness gate | Infraestructura lista |
| 3.10 Cutover real | BLOQUEADO deliberadamente |
| 3.11 Post-verificación | Infraestructura lista |

## Invariantes

- El snapshot se identifica por SHA-256.
- Un mismo snapshot no debe procesarse dos veces.
- `AMBIGUOUS`, `UNMATCHED`, `BLOCKED`, `PENDING` o validaciones `FAIL` bloquean el cutover.
- El plan usa `CURRENT → PROPOSED → DELTA`.
- Operaciones: `NOOP`, `CREATE`, `ADJUST`, `LINK`, `IMPORT_HISTORY`, `BLOCK`.
- La ejecución real debe producir un receipt por operación.
- No se borra historia para corregir estados.
- Fase 3 no mezcla el snapshot histórico de Fase 1 con el snapshot operativo fresco.
- LIHEN_ADMIN_PRO permanece fuente operativa hasta que 3.10 + 3.11 pasen.

## Bloqueo actual correcto

No hay snapshot fresco cargado. Por tanto no debe existir ningún run real listo para ejecutar.
