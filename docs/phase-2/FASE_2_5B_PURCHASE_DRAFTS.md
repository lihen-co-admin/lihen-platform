# FASE 2.5B — Compras DRAFT controladas

- Se puede crear cabecera + líneas de compra de forma atómica e idempotente.
- Requiere proveedor canónico ACTIVE y productos canónicos existentes.
- Valida cantidades, costos no negativos y productos duplicados.
- Un DRAFT NO mueve ON_HAND, RESERVED, PENDING_IN, caja, facturas ni precios.
- Confirmación, recepción, facturación y pago quedan en gates posteriores.
