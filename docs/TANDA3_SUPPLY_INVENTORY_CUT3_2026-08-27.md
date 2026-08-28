# TANDA 3 — Supply & Inventory · CUT 3

Fecha: 2026-08-27
Estado del corte: pendiente de checkpoint local completo.

## Objetivo

Consolidar integridad Compra ↔ Inventario y proteger los ajustes físicos para que nunca se usen como atajo frente a una diferencia de abastecimiento.

## Cambios

### 1. Política explícita de ajustes de inventario

Se incorpora `evaluateInventoryAdjustmentPolicy()` en `@lihen/inventory`.

La política exige:
- delta entero y distinto de cero;
- `PHYSICAL_COUNT_INCREASE` y `RETURN_TO_STOCK` con signo positivo;
- `PHYSICAL_COUNT_DECREASE`, `DAMAGE_WRITE_OFF` y `LOSS_WRITE_OFF` con signo negativo;
- evidencia operativa mínima para daño, pérdida y corrección manual.

El handler vuelve a validar la política antes de llegar al repositorio. La UI no es la única barrera.

### 2. Readiness transversal Supply & Inventory

Se incorpora `evaluateSupplyInventoryReadiness()` en Control Center.

Compara, a nivel agregado por producto:
- unidades pendientes esperadas en compras `CONFIRMED` / `PARTIALLY_RECEIVED`;
- `PENDING_IN` derivado del ledger;
- buckets negativos;
- compras abiertas vencidas.

Estados:
- `READY`: conciliación agregada consistente y sin buckets negativos;
- `REVIEW`: integridad consistente, pero existen compras abiertas vencidas;
- `BLOCKED`: existe mismatch Compra ↔ PENDING_IN o un bucket negativo.

### 3. Ajustes protegidos por integridad

Si el readiness está `BLOCKED`, Control Center no permite registrar un ajuste manual de ON_HAND. La intención es evitar que una corrección manual oculte la causa raíz de una inconsistencia entre compras y ledger.

Esto no modifica datos automáticamente. LIHEN Intelligence sigue siendo read-only.

## Invariantes preservados

- Compra confirmada ≠ recepción física.
- Recepción física ≠ pago a proveedor.
- `PENDING_IN` se origina y resuelve desde Compras.
- `ON_HAND` se deriva del ledger.
- Ajustes manuales no corrigen `PENDING_IN` ni sustituyen recepción.
- Ledger histórico no se borra ni sobrescribe.
- No hay reparación automática de diferencias.
- No se toca PROD ni se habilita execution/canary/dispatch.

## Definition of Done del CUT 3

Pendiente de confirmar en entorno local:

```bash
git diff --check
pnpm check
git status
```

Esperado: nuevos tests de política de ajuste y readiness Supply & Inventory en PASS junto con la suite acumulada.
