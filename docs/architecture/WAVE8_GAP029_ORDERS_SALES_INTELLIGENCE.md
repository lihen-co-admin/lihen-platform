# WAVE 8 / GAP-029 — Orders & Sales Intelligence

## Status target

IMPLEMENTATION PACKAGE V1 — pending local application, validation, exact staging,
commit/push, remote SHA verification, and continuity readback.

## Audit classification

**REUSE + EXTEND / CONSOLIDATE.**

GAP-029 is not a rebuild of Orders or Sales. The current platform already has:

- `@lihen/orders` with Order / OrderItem, lifecycle statuses, Order Commerce Policy,
  application handlers, repository port, in-memory repository and Supabase adapter.
- Controlled order writes through `create_order_draft_controlled`,
  `confirm_order_controlled` and `cancel_order_controlled`.
- `@lihen/sales` with Sale / SaleItem, Sale Reversal Policy, repository port and
  Supabase adapter.
- Controlled sales writes through `create_pos_sale_controlled` and
  `complete_order_sale_controlled`.
- Control Center operational intelligence concepts already embedded in OrdersPage
  and SalesPage.
- Existing cross-domain `commerce-reconciliation`,
  `order-cancellation-reconciliation` and `commerce-readiness` read models.
- GAP-003..GAP-010 Intelligence Core, Assurance, Orchestrator, Unified Human Review
  Queue and Existing Control Plane.
- GAP-027 Inventory Intelligence and GAP-028 Procurement Intelligence as the
  immediate WAVE 8 capability pattern.

Therefore the minimum architecturally correct delta is to generalize Orders/Sales
operational intelligence inside `@lihen/intelligence-core`, consuming governed read
models and existing reconciliation observations without moving transaction
ownership away from Orders/Sales.

## Current physical DEV evidence

Read-only audit confirms existing physical tables:

- `public.orders`
- `public.order_items`
- `public.sales`
- `public.sale_items`
- `public.inventory_movements`
- `public.financial_movements`
- `lihen_private.financial_ledger_entries`

Existing controlled routines confirmed:

- `create_order_draft_controlled`
- `confirm_order_controlled`
- `cancel_order_controlled`
- `create_pos_sale_controlled`
- `complete_order_sale_controlled`

GAP-029 does not add or modify SQL, migrations, RLS or RPCs.

## Capability responsibility

`analyzeOrdersSalesIntelligence()` is a pure ANALYTICS capability over:

- governed Order snapshots;
- governed Sale snapshots;
- optional existing commerce reconciliation observations;
- optional existing order-cancellation reconciliation observations;
- explicit attention thresholds.

It produces:

- operational summary metrics;
- deterministic intelligence signals;
- first-party evidence;
- recommendations with risk classification;
- explicit governance flags that remain false for every mutation path.

Signals in V1:

- `ORDER_INTEGRITY_ANOMALY`
- `ORDER_ATTENTION_REQUIRED`
- `ORDER_READY_FOR_SALE`
- `COMMERCE_RECONCILIATION_BLOCKED`
- `COMMERCE_RECONCILIATION_REVIEW`
- `CANCELLATION_RECONCILIATION_BLOCKED`
- `REVERSED_SALE_AUDIT`

## Mandatory governance boundary

Orders & Sales Intelligence may READ / ANALYZE / RECOMMEND.

It may not:

- create, confirm or cancel Orders;
- complete or reverse Sales;
- write Inventory;
- post Finance;
- call Supabase/RPC directly;
- rewrite transactional history;
- bypass Human Decision;
- bypass the Existing Control Plane.

Any governed action remains:

`Recommendation -> Human Decision -> Existing Control Plane -> controlled domain RPC -> Audit`

## Finance separation

GAP-029 can consume finance reconciliation results as evidence only.

It must not decide Finance authority and must not create a Finance model, adapter,
ledger or posting path.

**NO THIRD FINANCE LEDGER.**

The coexistence of `public.financial_movements` and
`lihen_private.financial_ledger_entries` remains the explicit subject of
**GAP-030 — Finance Authority Consolidation**.

## Explicit deferrals

This V1 does not implement broad commercial forecasting, margin intelligence,
marketing attribution or generic analytics warehousing. Those remain appropriate
for later Analytics Intelligence work where applicable.

## Negative scope

- SQL / migrations: 0
- RLS changes: 0
- RPC changes: 0
- Supabase writes: 0
- UI changes: 0
- Product Master mutations: 0
- Inventory mutations: 0
- Finance postings: 0
- Publishing: 0
- PROD: 0
- execution/canary/release gate changes: 0
