# WAVE 10 / GAP-033 — Assistant Context Resolver

## Classification

BUILD + REUSE / DELTA-FIRST.

## Recovery point

`c57582c8041164d64644a3096837ff57ed2b5208`

## Master rule

Intelligence must not query the database freely. It consumes governed read contexts:
ProductContext, BrandContext, SupplierContext, CatalogContext, InventoryContext,
PricingContext, PurchaseContext, SalesContext, FinanceContext and AuditContext.

A context is a permission-filtered read projection. It is not a second Product Master,
Finance ledger, Inventory authority or parallel persistence model.

## Existing architecture reused

- `IntelligenceContext` and `IntelligenceContextType` from GAP-003.
- `INTELLIGENCE_PERMISSION.READ_CONTEXT` from GAP-004.
- deterministic `evaluatePermission()` with default-deny semantics.
- existing Intelligence Orchestrator boundary from GAP-006.
- concrete domain repositories/read models remain outside `intelligence-core`.

## Delta

GAP-033 adds `context-resolver.ts` to `@lihen/intelligence-core`.

The resolver:

1. accepts an explicit context query;
2. evaluates `intelligence.read_context` before reading;
3. derives the permission scope from context type, business line and entity id;
4. requires exactly one injected read source for the requested context type;
5. executes no source when permission is denied;
6. returns the existing `IntelligenceContext` contract;
7. supports bundles of explicit context queries for future Assistant composition;
8. reports partial resolution without converting incomplete context into authority;
9. fails closed when a source is missing, duplicated or fails.

## GAP-033 governed context families

- PRODUCT
- BRAND
- SUPPLIER
- CATALOG
- INVENTORY
- PRICING
- PURCHASE
- SALE
- FINANCE
- AUDIT

`GLOBAL`, `DOCUMENT`, `ASSET` and other context types already present in the shared
contract are intentionally not added to the GAP-033 resolver scope unless a later GAP
authorizes them.

## Explicit non-goals

- No Assistant chat UI.
- No intent classification from natural language.
- No LLM/provider call.
- No embeddings/vector database.
- No external search.
- No new Supabase table/view/RPC.
- No RLS bypass.
- No direct SQL.
- No master-data mutation.
- No pricing mutation.
- No inventory/purchase/sale/finance posting.
- No lifecycle change.
- No publication.
- No autonomous command execution.
- No PROD.

## Composition rule for GAP-034+

Concrete context sources are injected at the application boundary. A source may wrap an
existing Product repository, inventory read model, finance projection, audit view, etc.,
but the resolver itself must remain persistence-neutral.

The resolver never decides that a source is authoritative merely because it exists.
Authority remains in the canonical domain source. `source` is traceability metadata only.

## DoD

- `context-resolver.ts` exported from `@lihen/intelligence-core`.
- unit tests prove default deny and no source execution on denied reads.
- unit tests prove missing/duplicate sources fail closed.
- unit tests prove bundle partial-success behavior.
- architecture test proves no Supabase/SQL/React/provider SDK/mutation boundary.
- intelligence-core typecheck PASS.
- targeted tests PASS.
- architecture test PASS.
- root lint PASS for authorized TypeScript delta.
- staging contains only GAP-033 authorized paths.
- commit/push on `next-phase`.
- LOCAL HEAD = REMOTE HEAD.
- new recovery point registered.
- master continuity updated using fresh revision + readback.
- GAP-034 remains blocked until formal GAP-033 closure.
