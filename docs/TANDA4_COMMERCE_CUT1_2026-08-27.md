# TANDA 4 — Commerce · CUT 1

Fecha: 2026-08-27

## Objetivo

Formalizar el puente de dominio entre Order lifecycle, reserva de inventario y cierre de venta sin convertir pedido, venta y movimiento financiero en el mismo concepto.

## Cambios

- Se agrega `packages/orders/src/domain/order-commerce-policy.ts`.
- Se centraliza `isOrderEligibleForSale()` para `CONFIRMED`, `PREPARING` y `READY`.
- Se agrega `evaluateOrderCommercePolicy()` con estados explícitos de reserva y elegibilidad comercial.
- Se detectan inconsistencias estructurales como `COMPLETED_ORDER_WITHOUT_SALE` y `SALE_ORDER_STATUS_MISMATCH`.
- `SalesPage` deja de duplicar la lista de estados elegibles y reutiliza la política de dominio.
- `SalesPage` realiza un preflight adicional antes de invocar `completeOrder`.
- `OrdersPage` muestra pedidos elegibles para venta y explica que la reserva se consume únicamente al completar la venta.
- Se agregan tests puros de la política de comercio.

## Invariantes preservados

- DRAFT no reserva inventario.
- CONFIRMED/PREPARING/READY representan reserva activa y son elegibles para venta.
- Completar una venta desde pedido consume RESERVED, descuenta ON_HAND, registra SALE_INCOME y cierra el pedido dentro del flujo controlado existente.
- Pedido confirmado != venta completada != movimiento financiero.
- No hay writes directos desde LIHEN Intelligence.
- No se habilita ejecución fuera de los comandos/RPC controlados existentes.
- No se toca PROD.

## Siguiente corte recomendado

Commerce CUT 2: conciliación Order -> Sale -> Inventory -> Finance y señales de integridad read-only antes de cierre de Commerce.
