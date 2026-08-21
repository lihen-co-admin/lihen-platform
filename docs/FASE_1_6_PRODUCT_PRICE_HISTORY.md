# FASE 1.6 — Product Price Change / Historical Command Slice

## Estado

IMPLEMENTADO EN MEMORIA. Supabase continúa en solo lectura hasta aprobar FASE 1.2.1 contra DEV real.

## Decisión principal

`UpdateProduct` ya no recibe ni cambia `salePrice`. El único flujo autorizado para cambiar el precio de venta es:

`ChangeProductSalePriceCommand → ChangeProductSalePriceHandler → ProductPricingRepository.changeSalePrice()`

## Historial

Cada cambio crea un `ProductSalePriceChange` append-only con:

- `id`
- `productId`
- `previousPrice`
- `newPrice`
- `reason`
- `actorId`
- `changedAt`

En memoria, el producto actual y el nuevo registro histórico se escriben dentro de una sola operación del mismo repository. La implementación Supabase sigue bloqueada; la futura habilitación deberá usar una operación/RPC transaccional que actualice precio actual + historial + auditoría de forma atómica.

## UI

- `/products/:id/edit`: nombre, SKU, código y estado. **No precio**.
- `/products/:id/price`: flujo especializado de cambio de precio.
- `/products/:id`: muestra precio actual e historial disponible.

## Gate de seguridad

`SupabaseProductRepository.changeSalePrice()` lanza `PRODUCT_WRITE_BLOCKED` y no contiene `insert`, `update`, `upsert` ni `delete`.

## Próximo paso

Antes de habilitar persistencia de precios en Supabase:

1. aprobar FASE 1.2.1 en DEV real;
2. crear/especificar `product_sale_price_history` en DEV;
3. implementar RPC transaccional `change_product_sale_price`;
4. probar RLS, idempotencia, historial, auditoría y regresión.
