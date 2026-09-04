# WAVE 8 / GAP-027 — Inventory Intelligence

## Classification

**REUSE + BUILD / DELTA-FIRST.**

Inventory already owns the canonical ledger/state boundary through governed balances,
movement history and controlled adjustment execution. GAP-027 does not create another
ledger, another stock table, or another write path.

## Existing foundation reused

- `InventoryBalance`: ON_HAND, RESERVED, PENDING and AVAILABLE.
- `InventoryMovement`: governed deltas, buckets and occurrence history.
- `InventoryRepository`: read balances/movements plus the existing controlled write path.
- DEV persistence: `inventory_stock`, `inventory_movements` and
  `record_inventory_adjustment_controlled`.

## New Intelligence responsibility

`@lihen/intelligence-core` receives structural, read-only Inventory snapshots and produces
deterministic ANALYTICS artifacts for:

- critical stock;
- observed rotation;
- potential overstock;
- immobile inventory;
- stockout projection;
- suggested replenishment;
- balance-integrity anomalies.

Thresholds are explicit `InventoryIntelligencePolicy` inputs. Demand-dependent analytics
are emitted only when an explicit demand observation is supplied. Inventory movement
history is never reinterpreted as sales demand.

## Authority boundary

Inventory Intelligence may **UNDERSTAND / COMPARE / VERIFY / RECOMMEND**.

It may not:

- write `inventory_stock`;
- insert or repair `inventory_movements`;
- call the controlled inventory RPC;
- approve its own R3/R4 recommendations;
- mutate Supabase or PROD;
- silently transform a recommendation into an inventory adjustment.

If an anomaly needs correction, execution remains in the existing governed Inventory
write/control plane.

## Data path

`Inventory Ledger / State`
→ `Inventory read model`
→ `Inventory Intelligence (ANALYTICS)`
→ `Evidence + Signals + Recommendations`
→ `Human / governed execution when applicable`

## Out of scope

No migration, SQL, RLS, RPC change, Product Master mutation, purchasing execution,
automatic replenishment, UI redesign, or PROD mutation is part of GAP-027.
