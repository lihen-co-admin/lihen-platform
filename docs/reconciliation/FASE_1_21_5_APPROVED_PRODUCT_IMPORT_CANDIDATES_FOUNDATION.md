# FASE 1.21.5 — APPROVED PRODUCT IMPORT CANDIDATES FOUNDATION

## Scope

This phase prepares, but does not execute, a controlled import for the 136 `APPROVE_CREATE` decisions produced by FASE 1.21.4 for `BEAUTY_CARE`.

Authority rule:

`HUMAN_APPROVED_IMPORT_SUBSET != FULL_BEAUTY_CARE_PRODUCT_MASTER`

The 816 `READY_CANDIDATE` rows did not require human review and remain outside this 136-row subset until their approval policy is explicitly resolved.

## DEV outcome

- Human-approved rows staged: **136**
- `REJECT` excluded: **6**
- `DEFER` excluded: **45**
- Clean `READY_CANDIDATE` outside this scope: **816**
- Dry-run: **136 READY_CREATE / 0 conflicts**
- `public.products`: **0**
- Import operations executed: **0**

## Identity/code strategy

Because the canonical PDF does not contain authoritative SKU or catalog codes for these 136 rows, and the known ADMIN PRO seed does not provide an exact `normalized name + brand` match for any of them, the phase does not claim recovered legacy identity.

For a deterministic DEV cutover candidate set:

- `proposed_product_id`: deterministic UUID derived from `LIHEN_PRODUCT_V1 | business_line | source_reference_id`.
- `proposed_sku`: reserved import range `BC-10000..BC-10135`.
- `proposed_catalog_code`: `BCV5-0001..BCV5-0136`.
- `proposed_slug`: deterministic `beauty-care-<normalized-name>`, with page/slot suffix only for collisions.

The SKU range is explicitly marked `RESERVED_IMPORT_RANGE`; it is not asserted as historical inventory identity.

## Product Master hardening

`public.products.slug` is now `NOT NULL` and globally unique. Controlled create/update RPCs accept slug, while application-domain Product guarantees a slug even when older callers omit one.

## Cutover gate

`public.import_approved_products_controlled(text, uuid)` is installed with:

- `SECURITY DEFINER`
- `auth.uid()` required
- active OWNER/ADMIN required
- advisory transaction lock
- preview must be 100% `READY_CREATE`
- idempotent operation record
- browser `EXECUTE` revoked

The function has **not** been executed.

## Important global gate

A full Beauty Care Product Master cutover must not be declared complete from this subset alone. The 816 clean candidates still require an explicit policy decision: approve-by-rule or separate approval event.
