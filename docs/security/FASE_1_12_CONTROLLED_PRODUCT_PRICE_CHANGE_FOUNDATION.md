# FASE 1.12 — Controlled Product Price Change Foundation

Status: FOUNDATION DEPLOYED / CUTOVER BLOCKED.

`ChangeProductSalePrice` is the only future operation allowed to mutate `products.sale_price`.
The controlled RPC locks the current product row, derives the authoritative previous price in PostgreSQL, appends an immutable history row, changes the current price, and records the idempotency operation in one transaction.

Cutover remains blocked until GitHub/JWT, profile promotion to OWNER/ADMIN + ACTIVE, authorization probe, and explicit approval.

The history table is append-only: client roles have no write grants and a trigger rejects UPDATE/DELETE.
