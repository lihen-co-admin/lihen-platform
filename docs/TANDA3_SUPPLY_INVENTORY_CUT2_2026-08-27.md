# TANDA 3 — Supply & Inventory · CUT 2

Fecha: 2026-08-27
Estado del corte: listo para checkpoint local.

## Objetivo

Cerrar la lectura transversal **Supplier → Purchase → PENDING_IN → Receipt → ON_HAND** sin introducir correcciones automáticas ni mezclar responsabilidades financieras.

## Cambios

### 1. Conciliación determinística Purchase ↔ Inventory

Se añadió `apps/control-center/src/domain/supply-inventory-reconciliation.ts`.

La política compara por compra y producto:

- pendiente esperado = `quantity_requested - quantity_received`;
- PENDING_IN real = suma neta del ledger para `external_reference = purchase_number`;
- recibido esperado = `quantity_received`;
- ON_HAND recibido = entradas `PURCHASE_RECEIVED` para la misma referencia.

Estados:

- `PASS`: Purchase Master y ledger coinciden;
- `MISMATCH`: existe diferencia que requiere investigación humana;
- `NOT_APPLICABLE`: el estado de compra todavía no debe producir efectos de abastecimiento.

**La política es read-only. No corrige movimientos ni saldos.**

### 2. Purchase Detail

La pantalla ahora carga los movimientos de inventario relacionados con los productos de la compra y muestra una tabla de conciliación por línea.

También contrasta el proveedor histórico con Supplier Master para advertir si está inactivo o ya no existe.

Una discrepancia genera una señal CRITICAL de LIHEN Intelligence, pero la única acción propuesta es investigar el ledger.

### 3. Supplier Master

Proveedores ahora muestra la cantidad de compras abiertas por proveedor y detecta proveedores inactivos que todavía tienen compras `CONFIRMED` o `PARTIALLY_RECEIVED`.

La relación es observacional: editar el proveedor no modifica la compra y una compra histórica conserva su referencia original.

### 4. Cobertura

Se añadió `apps/control-center/tests/supply-inventory-reconciliation.test.ts` con casos para:

- compra confirmada conciliada con PENDING_IN;
- recepción parcial conciliada con PENDING_IN + ON_HAND;
- diferencia de pendiente;
- aislamiento por `external_reference`;
- borrador sin efectos de ledger.

## Invariantes preservados

1. Supplier Master no escribe Purchase Master.
2. Purchase Master no sobrescribe inventario.
3. Confirmación crea intención pendiente; recepción física es la causa de ON_HAND.
4. PENDING_IN y ON_HAND se derivan de movimientos inmutables.
5. Una discrepancia se investiga; Intelligence no “arregla” saldos.
6. Pago de proveedor continúa fuera de este corte y pertenece a Finance.
7. No se habilita execution/canary/dispatch.
8. PROD permanece fuera de alcance.

## Definition of Done del CUT 2

El corte puede declararse PASS cuando en el entorno local se confirme:

```bash
git diff --check
pnpm check
git status
```

Los dos `tsbuildinfo` generados por el check deben restaurarse antes de staging.
