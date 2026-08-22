# FASE 2.4A — Inventario operativo seguro

## Alcance

- `inventory_movements` sigue siendo ledger inmutable.
- `inventory_stock` sigue siendo una proyección derivada, nunca un saldo editable.
- Control Center puede leer saldos e historial solo con sesión autenticada y perfil `ACTIVE` `OWNER/ADMIN`.
- La única escritura humana de esta subfase es un ajuste físico de `ON_HAND` mediante RPC idempotente.
- `RESERVED` pertenece al futuro módulo Pedidos.
- `PENDING_IN` pertenece al futuro módulo Compras.
- No se importan ni alteran saldos legacy en esta fase. Eso pertenece al cutover/reconciliación.

## Invariantes

`ON_HAND >= 0`, `RESERVED >= 0`, `PENDING_IN >= 0` y `AVAILABLE = ON_HAND - RESERVED >= 0`.

Un movimiento no se corrige con UPDATE/DELETE: se registra un movimiento compensatorio.
