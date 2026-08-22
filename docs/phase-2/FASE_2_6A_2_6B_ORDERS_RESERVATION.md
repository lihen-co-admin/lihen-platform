# FASE 2.6A–2.6B — Pedidos y reserva de inventario

Estado: implementado en Supabase DEV, pendiente de `pnpm check` y gate visual.

Reglas:
- Un pedido nace `DRAFT`: no reserva inventario y no mueve caja.
- El pedido captura canal, cliente opcional, teléfono opcional, notas y snapshot de precio por ítem.
- Confirmar exige stock disponible suficiente para todas las líneas antes de reservar cualquiera.
- Confirmar crea `RESERVED` sin reducir `ON_HAND`.
- Cancelar un pedido confirmado libera exactamente la reserva.
- `COMPLETED` y `CANCELLED` no pueden cancelarse con esta operación.
- Ventas/POS y caja quedan fuera de este gate.

Dry-runs DEV ejecutados con `ROLLBACK`: 0 pedidos y 0 reservas residuales; 8 ON_HAND conservados.
