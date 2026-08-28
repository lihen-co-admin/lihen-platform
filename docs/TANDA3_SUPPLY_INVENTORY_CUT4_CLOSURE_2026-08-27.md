# TANDA 3 — Supply & Inventory · CUT 4 / CLOSURE

Fecha: 2026-08-27

Estado: **CLOSED / PASS**

## Evidencia de cierre

El checkpoint local posterior a CUT 3 FIX 1 completó correctamente:

- `git diff --check`: sin errores de whitespace; solo warnings de conversión LF → CRLF.
- `pnpm typecheck`: PASS en los workspaces aplicables.
- `pnpm lint`: PASS.
- `pnpm test`: 67 archivos / 222 tests PASS.
- `tests/architecture/boundaries.test.ts`: 16/16 PASS.
- `pnpm build`: PASS para storefront, packages y control-center.

La advertencia de chunks mayores a 500 kB emitida por Vite es informativa y no bloqueó el build.

## Alcance consolidado cerrado

La TANDA 3 deja cubierto el flujo operativo:

`Supplier → Purchase → PENDING_IN → Receipt → ON_HAND → protected adjustments`

### 1. Purchase Supply Readiness

Se incorporó una política determinística para evaluar compras, recepción parcial, unidades pendientes y vencimientos sin mezclar pago de proveedor con recepción física.

Invariante:

`confirmar compra ≠ recibir mercancía ≠ pagar proveedor`

### 2. Purchase ↔ Inventory reconciliation

Se incorporó conciliación entre Purchase Master y ledger de inventario para contrastar:

- pendiente esperado por compra;
- `PENDING_IN` real;
- unidades recibidas;
- `ON_HAND` originado por recepción;
- diferencias por producto y compra.

Estados de conciliación:

- `PASS`
- `MISMATCH`
- `NOT_APPLICABLE`

La conciliación es read-only: no repara ni modifica saldos automáticamente.

### 3. Supplier dependency visibility

Control Center permite identificar compras abiertas por proveedor y advertir referencias históricas a proveedores inactivos sin perder trazabilidad.

### 4. Inventory ledger visibility

Inventario deja de tratarse como un saldo aislado. La UI permite inspeccionar ledger por producto y distinguir buckets:

- `ON_HAND`
- `RESERVED`
- `PENDING_IN`

### 5. Protected physical adjustments

Se incorporó `evaluateInventoryAdjustmentPolicy()` para validar ajustes manuales de `ON_HAND`.

Reglas principales:

- `PHYSICAL_COUNT_INCREASE` → delta positivo.
- `RETURN_TO_STOCK` → delta positivo.
- `PHYSICAL_COUNT_DECREASE` → delta negativo.
- `DAMAGE_WRITE_OFF` → delta negativo.
- `LOSS_WRITE_OFF` → delta negativo.
- `MANUAL_CORRECTION` → ambos sentidos, con evidencia operativa.

Daño, pérdida y corrección manual requieren nota operativa suficiente. La validación se ejecuta nuevamente en application antes del repositorio.

### 6. Supply & Inventory aggregate readiness

Se incorporó `evaluateSupplyInventoryReadiness()` para detectar:

- diferencias agregadas entre compras abiertas y `PENDING_IN`;
- buckets negativos;
- compras abiertas vencidas;
- estado global `READY | REVIEW | BLOCKED`.

Cuando el estado está `BLOCKED`, Control Center no debe permitir que un ajuste manual oculte una inconsistencia estructural Compra ↔ Ledger.

## Inteligencia LIHEN

LIHEN Intelligence se mantiene como capa read-only para:

- priorizar diferencias;
- explicar bloqueos;
- señalar recepción parcial o vencida;
- detectar buckets negativos;
- guiar investigación de ledger.

No se habilita reparación automática, mutación directa desde Intelligence ni ejecución fuera de comandos controlados.

## Invariantes preservados

- No hay escrituras directas desde UI a tablas de negocio.
- No hay reparación automática de ledger.
- No hay edición manual de saldo como fuente de verdad.
- No se mezclan recepción física y movimientos financieros.
- No se habilita ejecución automática, dispatch ni canary real.
- PROD permanece fuera de alcance.
- RLS, auditabilidad, idempotencia y operation keys continúan siendo obligatorios para comandos sensibles.

## Definition of Done — TANDA 3

### Functional

- [x] Readiness de compra y recepción.
- [x] Conciliación Purchase ↔ Inventory.
- [x] Visibilidad de ledger por producto.
- [x] Dependencia Supplier ↔ Purchase visible.
- [x] Ajustes físicos protegidos.
- [x] Readiness agregado Supply & Inventory.

### Architecture

- [x] Reglas determinísticas separadas de UI.
- [x] Dependencias respetan boundaries.
- [x] Sin writes directos desde Control Center.

### Security & integrity

- [x] Ajustes manuales validados antes del repositorio.
- [x] Sin auto-fix de inconsistencias.
- [x] Historial preservado.

### UX

- [x] Admin Foundation aplicada.
- [x] Inteligencia contextual read-only.
- [x] Estados operativos explicables.

### QA

- [x] Typecheck PASS.
- [x] Lint PASS.
- [x] 67 test files PASS.
- [x] 222 tests PASS.
- [x] Architecture boundaries 16/16 PASS.
- [x] Build PASS.

## Resultado

**TANDA 3 — Supply & Inventory = CLOSED / PASS**

Siguiente bloque recomendado: **TANDA 4 — Commerce**, manteniendo la separación:

`Order lifecycle → reservation → sale completion → financial movement`

sin confundir pedido confirmado, venta completada y movimiento financiero.
