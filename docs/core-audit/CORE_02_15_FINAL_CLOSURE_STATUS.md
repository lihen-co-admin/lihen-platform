# CORE 02→15 — Estado de cierre después de Waves 1–3

## Nota de interpretación

Este documento evalúa los entregables arquitectónicos 02→15. Un `PASS` de foundation/modelo no implica que todos los datos históricos o todos los módulos operativos futuros ya estén migrados.

| # | Requisito | Estado final | Evidencia principal |
|---|---|---|---|
| 02 | Modelo de producto maestro | PASS | Product Master canónico + DEV. |
| 03 | Modelo de proveedores | PASS | `@lihen/suppliers` + tablas canónicas Supplier. |
| 04 | Modelo histórico de precios | PASS | history model/RPC/contracts. |
| 05 | Modelo compras/facturas | PASS | `@lihen/procurement` + purchases/items/invoices foundation. |
| 06 | Modelo inventario | PASS | `@lihen/inventory` + ledger canónico. |
| 07 | Modelo catálogo | PASS | `@lihen/catalog` + catalog versions/entries. |
| 08 | Modelo eventos | PASS | event store + outbox. |
| 09 | Contratos Repository | PASS | Ports en bounded contexts. |
| 10 | Eventos de dominio | PASS | bus/store/handlers contracts + concrete domain events. |
| 11 | Estrategias | PASS | Strategy contract/registry + conservative import strategy. |
| 12 | Adapters de importación | PASS | legacy/import/reconciliation adapters y tests. |
| 13 | Estados permitidos | PASS | estados/constraints explícitos. |
| 14 | Matriz reutilizar/adaptar/eliminar | PASS | `CORE_14_REUSE_ADAPT_REMOVE_MATRIX.md`. |
| 15 | Plan de migración de los 3 proyectos | PASS | `CORE_15_THREE_PROJECT_MIGRATION_PLAN.md`. |

## Resultado

**14 / 14 requisitos: PASS**.

### Límites de este cierre

Siguen existiendo trabajos posteriores que no reabren estos requisitos:

- reconciliación/importación de proveedores y compras legacy;
- publicación operativa de versiones de catálogo;
- adaptación de `lihen_intelligence`;
- migración futura de ventas/pedidos/caja/finanzas operativas;
- retiro definitivo de los tres runtimes legacy cuando cumplan sus gates.

Estos trabajos son ejecución del plan de migración, no ausencia del plan/modelo Core.
