# FASE 2.7A — Ventas / POS

## Contrato
Una venta completada es una operación atómica. No existe un `DRAFT` de venta: el borrador pertenece al pedido.

- Venta desde pedido confirmado: libera `RESERVED`, descuenta `ON_HAND`, marca el pedido `COMPLETED` y registra un ingreso financiero.
- Venta rápida/POS: valida `stock_available`, descuenta `ON_HAND` y registra el ingreso financiero.
- Precio de la venta queda capturado en `sale_items.unit_price`; no reescribe el precio maestro.
- Escrituras directas a `sales`, `sale_items` y `financial_movements` quedan bloqueadas para `authenticated`.
- RPCs idempotentes requieren OWNER/ADMIN ACTIVE.

## Dry-runs DEV
Se ejecutó POS y venta desde pedido dentro de transacciones con `ROLLBACK`.
Durante el dry-run se verificó la disminución de inventario y aumento del saldo financiero. Después del rollback: ventas 0, movimientos financieros 0, inventario volvió a 4 movimientos / 8 ON_HAND / 0 RESERVED.
