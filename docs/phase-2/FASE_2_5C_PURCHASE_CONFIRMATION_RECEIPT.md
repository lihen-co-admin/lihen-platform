# FASE 2.5C — Confirmación y recepción de compras

Estado: implementado en Supabase DEV, pendiente de `pnpm check` y gate visual.

Reglas:
- DRAFT no afecta inventario.
- Confirmar una compra crea movimientos `PENDING_IN`.
- Recibir mercancía reduce `PENDING_IN` y aumenta `ON_HAND` por la misma cantidad.
- La recepción exige costo final unitario y registra `product_cost_history`.
- Recibir mercancía no mueve caja ni marca pagos a proveedor.
- Operaciones idempotentes y autorizadas solo para perfiles ACTIVE con rol OWNER/ADMIN.
- Escrituras directas permanecen revocadas.

Dry-run DEV ejecutado con `ROLLBACK`: sin residuos. DEV regresó a 4 movimientos, 8 ON_HAND, 0 PENDING_IN, 0 compras, 0 costos históricos.
