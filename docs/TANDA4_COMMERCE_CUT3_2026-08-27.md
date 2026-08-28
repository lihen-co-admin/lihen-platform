# TANDA 4 — Commerce · CUT 3

Fecha: 2026-08-27

## Objetivo

Consolidar el readiness de Commerce y endurecer los casos de cancelación y reverso sin introducir compensaciones automáticas ni un falso workflow de reversión de ventas.

## Cambios

- Se agrega `apps/control-center/src/domain/order-cancellation-reconciliation.ts` con `reconcileCancelledOrder()`.
  - Una cancelación desde `DRAFT` se trata como válida sin reserva previa y queda en `REVIEW` informativo.
  - Si existió `ORDER_CONFIRMED`, la liberación `ORDER_CANCELLED` debe compensar exactamente la reserva creada por producto.
  - Un pedido `CANCELLED` que ya tenga una venta asociada queda `BLOCKED`.
- Se agrega `apps/control-center/src/domain/commerce-readiness.ts` con `evaluateCommerceReadiness()`.
  - Consolida conciliaciones de ventas y cancelaciones.
  - Usa estados `READY / REVIEW / BLOCKED`.
  - La ausencia de cuenta financiera activa bloquea readiness operativo, pero no altera datos.
  - Ventas históricas `REVERSED` generan revisión, no una acción automática.
- Se agrega `packages/sales/src/domain/sale-reversal-policy.ts`.
  - Un reverso de venta no puede ejecutarse como reverso financiero genérico.
  - La UI de Ventas tampoco ofrece reverso mientras no exista un workflow de dominio dedicado que compense Sale, Inventory, Reservation, Finance y Audit de forma atómica.
  - Un registro `REVERSED` se trata como evidencia histórica a auditar y no como acción repetible.
- `SalesPage` incorpora:
  - readiness agregado de Commerce;
  - tabla read-only de conciliación de cancelaciones;
  - advertencia explícita sobre reversos de venta;
  - visibilidad del estado de política de reverso en el historial.
- `OrdersPage` exige motivo de cancelación desde Control Center para conservar evidencia operativa.
- Se agregan tests para:
  - liberación completa de reservas al cancelar;
  - cancelación desde DRAFT;
  - reserva no liberada completamente;
  - pedido cancelado con venta;
  - readiness agregado READY/REVIEW/BLOCKED;
  - política de reverso de ventas.

## Invariantes preservados

- Pedido confirmado != venta completada != movimiento financiero.
- Cancelar un pedido activo libera `RESERVED`; no descuenta ni repone `ON_HAND` por sí mismo.
- Un pedido ya `COMPLETED` no se cancela para deshacer una venta.
- `SALE_INCOME` no se revierte desde Finanzas como sustituto de un reverso comercial.
- No se implementa un workflow de reverso incompleto o inseguro.
- Intelligence y conciliaciones siguen siendo read-only.
- No se corrige automáticamente ninguna diferencia.
- No hay writes directos desde UI.
- PROD permanece fuera de alcance.

## Validación del artefacto

En el entorno de empaquetado se ejecutó validación sintáctica/transpilación de TypeScript sobre los archivos nuevos y modificados del CUT 3. El `pnpm check` acumulado debe confirmarse en el entorno local del repositorio antes de marcar el corte como PASS.

## Siguiente paso recomendado

Si el checkpoint local pasa, preparar `TANDA 4 · CUT 4 / CLOSURE` con Definition of Done consolidado de Commerce y manifiesto final de archivos intencionales antes de iniciar Finance.
