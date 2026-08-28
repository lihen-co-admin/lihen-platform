# TANDA 4 — Commerce · CUT 2

Fecha: 2026-08-27

## Objetivo

Conciliar en modo read-only el rastro `Order -> Sale -> Inventory -> Finance` y convertir diferencias estructurales en señales de integridad visibles, sin reparar ni mutar automáticamente datos canónicos.

## Cambios

- Se agrega `apps/control-center/src/domain/commerce-reconciliation.ts` con `reconcileCommerceFlow()`.
- La conciliación valida, por venta completada:
  - pedido referenciado y estado `COMPLETED` cuando la venta nace de Order;
  - líneas canónicas de `sale_items`;
  - salida `ON_HAND` por la cantidad vendida;
  - consumo de `RESERVED` para ventas originadas en pedido;
  - ausencia de consumo `RESERVED` para POS directo;
  - movimiento financiero `SALE_INCOME` referenciado a la venta;
  - importe y cuenta financiera coincidentes con Sale Master.
- Se agregan lecturas batch controladas a repositories de Sales, Inventory y Finance para evitar lecturas directas de tablas desde UI.
- `SalesPage` muestra una muestra reciente de conciliación Commerce y señales Intelligence `PASS / REVIEW / BLOCKED`.
- Se agregan tests puros para happy path, ingreso faltante, Order no cerrado, mismatch ON_HAND, POS sin reserva y mismatch financiero.

## Invariantes preservados

- Pedido confirmado != venta completada != movimiento financiero.
- POS directo no crea una reserva previa ficticia.
- Una venta desde Order debe consumir la reserva existente y ON_HAND en el cierre controlado.
- `SALE_INCOME` es consecuencia financiera trazable de la venta, no la venta misma.
- La conciliación es read-only; un mismatch no ejecuta ajustes, reversos ni correcciones automáticas.
- No hay writes directos desde la UI.
- No se toca PROD.

## Siguiente corte recomendado

Commerce CUT 3: consolidar readiness comercial, casos de reverso/cancelación y gates de cierre de TANDA 4 antes de Finance.
