# TANDA 4 — Commerce · CUT 4 / CLOSURE

Fecha: 2026-08-27

Estado: **CLOSED / PASS**

## Evidencia de cierre

El checkpoint local posterior a CUT 3 completó correctamente:

- `git diff --check`: sin errores de whitespace; solo warnings de conversión LF → CRLF.
- `pnpm typecheck`: PASS en los workspaces aplicables.
- `pnpm lint`: PASS.
- `pnpm test`: 72 archivos / 243 tests PASS.
- `tests/architecture/boundaries.test.ts`: 16/16 PASS.
- `pnpm build`: PASS para storefront, packages y control-center.

La advertencia de chunks mayores a 500 kB emitida por Vite es informativa y no bloqueó el build.

## Alcance consolidado cerrado

La TANDA 4 deja formalizado y observable el flujo comercial:

`Order lifecycle → reservation → sale completion → inventory consumption → financial income`

sin confundir los límites entre pedido, venta, inventario y finanzas.

### 1. Order Commerce Policy

Se incorporó `evaluateOrderCommercePolicy()` junto con `isOrderEligibleForSale()` como fuente única para decidir qué estados de pedido pueden convertirse en venta.

Estados principales:

- `DRAFT`: sin reserva y no elegible para venta.
- `CONFIRMED`: reserva activa y elegible.
- `PREPARING`: reserva activa y elegible.
- `READY`: reserva activa y elegible.
- `COMPLETED`: reserva consumida y comercio cerrado.
- `CANCELLED`: reserva liberada y comercio cerrado.

Invariante:

`pedido confirmado ≠ venta completada ≠ movimiento financiero`

### 2. Order → Sale → Inventory → Finance reconciliation

Se incorporó `reconcileCommerceFlow()` como lectura determinística read-only para contrastar por venta:

- referencia al pedido cuando aplica;
- cierre del pedido en `COMPLETED`;
- existencia de `sale_items`;
- consumo esperado de `ON_HAND`;
- consumo de `RESERVED` cuando la venta proviene de un pedido;
- ausencia de movimientos `RESERVED` para POS directo;
- existencia del `SALE_INCOME`;
- coincidencia de monto financiero;
- coincidencia de cuenta financiera.

Estados de conciliación:

- `PASS`
- `REVIEW`
- `BLOCKED`

La conciliación no repara, revierte ni compensa datos automáticamente.

### 3. Cancellation reconciliation

Se incorporó `reconcileCancelledOrder()` para verificar que las reservas creadas por un pedido se liberen correctamente al cancelar.

La política detecta:

- liberación parcial de reservas;
- liberación sin reserva previa;
- pedido `CANCELLED` con venta asociada;
- cancelación desde `DRAFT` sin reserva previa, tratada como revisión informativa.

Cancelar un pedido activo no equivale a reversar una venta completada.

### 4. Commerce aggregate readiness

Se incorporó `evaluateCommerceReadiness()` para consolidar:

- conciliaciones de ventas;
- conciliaciones de cancelaciones;
- disponibilidad de cuenta financiera activa;
- evidencia histórica de ventas `REVERSED`.

Estados globales:

- `READY`
- `REVIEW`
- `BLOCKED`

Este readiness es diagnóstico y no habilita automatización implícita.

### 5. Safe sale reversal policy

Se incorporó `evaluateSaleReversalPolicy()` para dejar explícito que un reverso de venta requiere un workflow de dominio dedicado y atómico que compense como mínimo:

- Sale;
- Inventory;
- Reservation;
- Finance;
- Audit.

Mientras ese workflow no exista, Control Center no ofrece un reverso parcial o inseguro.

Un `SALE_INCOME` no debe revertirse desde Finanzas como sustituto de un reverso comercial.

### 6. Control Center visibility

`OrdersPage` y `SalesPage` quedaron alineadas con la Admin Foundation y muestran señales operativas de:

- pedidos elegibles para venta;
- conciliación venta ↔ pedido ↔ inventario ↔ finanzas;
- conciliación de cancelaciones;
- readiness agregado de Commerce;
- política de reversos.

LIHEN Intelligence permanece read-only y solo explica, prioriza y señala inconsistencias.

## Invariantes preservados

- No hay writes directos desde UI a tablas de negocio.
- No hay reparación automática de ventas, reservas, inventario o finanzas.
- POS directo no fabrica reservas inexistentes.
- Cancelación de pedido no se usa para deshacer una venta ya completada.
- Reverso financiero genérico no sustituye un reverso de venta.
- Reglas sensibles continúan detrás de application commands/RPC controlados.
- RLS, auditabilidad, append-only donde aplica e idempotencia continúan siendo obligatorios.
- No se habilita ejecución automática, dispatch ni canary real.
- PROD permanece fuera de alcance.

## Definition of Done — TANDA 4

### Functional

- [x] Política única de elegibilidad Order → Sale.
- [x] Conciliación Order → Sale → Inventory → Finance.
- [x] Conciliación de cancelaciones y liberación de reserva.
- [x] Readiness agregado de Commerce.
- [x] Política segura para reversos de venta.

### Architecture

- [x] Reglas determinísticas separadas de UI.
- [x] Repositories exponen lecturas batch requeridas sin lectura directa desde páginas.
- [x] Dependencias respetan boundaries.
- [x] Sin writes directos desde Control Center.

### Security & integrity

- [x] Sin compensaciones automáticas.
- [x] Sin reverso parcial de ventas.
- [x] Reserva, inventario y finanzas se concilian sin alterar su historia.
- [x] Evidencia histórica `REVERSED` se audita, no se reutiliza como acción repetible.

### UX

- [x] Admin Foundation aplicada.
- [x] Intelligence contextual read-only.
- [x] Estados de integridad y readiness explicables.
- [x] Motivo de cancelación exigido desde Control Center.

### QA

- [x] Typecheck PASS.
- [x] Lint PASS.
- [x] 72 test files PASS.
- [x] 243 tests PASS.
- [x] Architecture boundaries 16/16 PASS.
- [x] Build PASS.

## Resultado

**TANDA 4 — Commerce = CLOSED / PASS**

Siguiente bloque recomendado: **TANDA 5 — Finance**, manteniendo el ledger financiero como fuente trazable e inmutable y sin usar Finanzas para corregir inconsistencias comerciales de otros dominios.
