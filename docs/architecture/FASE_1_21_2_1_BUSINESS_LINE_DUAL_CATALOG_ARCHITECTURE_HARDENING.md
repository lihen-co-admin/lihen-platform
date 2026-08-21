# FASE 1.21.2.1 — Business Line & Dual-Catalog Architecture Hardening

## Decision
LIHEN keeps one platform, one Product Master and one audit/history model. `BEAUTY_CARE` and `STYLE` are canonical business lines, not separate databases.

## Canonical ownership
- `Product.business_line` is mandatory.
- `Category.business_line` is mandatory.
- `Brand` remains global; do not duplicate a brand merely because it appears in both lines.
- A future `Supplier` remains global. Line ownership belongs to supplier-product/product relationships, not to duplicating the supplier legal entity.
- Catalog source snapshots, candidate runs and candidates must declare `business_line`.
- Product and assigned category must share the same line, enforced by a composite database foreign key.
- Candidate and assigned category must share the same line.
- Parent/child categories cannot cross business lines.
- Candidate identity keys include `business_line`, preventing Beauty Care/Style cross-line conflicts.

## Current DEV mapping
The current final catalog `CATALOGO_LIHEN_V5_ACTL_V1` is the canonical `BEAUTY_CARE` catalog source. Its 5 categories, 1 candidate run, 1,003 staged candidates and 187-item review queue are therefore backfilled to `BEAUTY_CARE`.

`STYLE` is active as a canonical line but has no canonical taxonomy/candidates/products yet. Its future path is:

`STYLE supplier sources → Style taxonomy → Style candidates → review → Product Master → images/inventory/pricing → Style catalog version → Web Style projection`.

## Publication model
Beauty Care and Style may have independent catalog versions and storefront routes while projecting from the same Product Master. Publication must filter by `business_line`; one line must never leak into the other carousel/catalog.

## Safety
This phase creates no products. Existing controlled Create/Update Product RPCs were replaced with contracts that require `p_business_line`; both remain revoked for `anon` and `authenticated` until a later explicit cutover.
