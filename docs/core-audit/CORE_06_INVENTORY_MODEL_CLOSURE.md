# CORE 06 — Inventory Model Closure

The database ledger already existed from Phase 1 and remains unchanged:

- immutable `public.inventory_movements`;
- buckets `ON_HAND`, `RESERVED`, `PENDING_IN`;
- `public.inventory_stock` projection;
- canonical Product Master foreign key;
- compensating-entry model instead of mutation.

This closure adds the missing domain model and Repository contract in `@lihen/inventory` without opening browser writes or rewriting historical balances.
