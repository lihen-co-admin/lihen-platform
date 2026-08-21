# FASE 1.21.6 — FULL CANONICAL PRODUCT IMPORT FOUNDATION

## Purpose
Build the authoritative pending-cutover import set for the complete approved BEAUTY_CARE Product Master without writing any row to `public.products`.

## Canonical authority
The import authority is `lihen_private.canonical_product_approvals`, not the older 136-row human-only import subset.

- 136 `HUMAN_APPROVED`
- 816 `POLICY_APPROVED`
- 952 canonical approved total
- 6 `REJECT` excluded
- 45 `DEFER` excluded

## Authoritative DEV run
- candidate run: `d4d17a39-008d-4bcc-88b2-384cc147e262`
- full import run: `99a5e5bd-6115-40eb-9ca8-8d4adaa3a209`
- business line: `BEAUTY_CARE`
- scope: `FULL_CANONICAL_APPROVED`
- status: `COMPLETED`

The previous 136-row run is preserved but marked `SUPERSEDED`.

## Deterministic identity strategy
- Product ID: MD5-derived UUID from `LIHEN_PRODUCT_V1|business_line|source_reference_id`.
- SKU: reserved migration range `BC-20000` through `BC-20951`.
- Catalog code: `BCV5-0001` through `BCV5-0952`.
- Slug: `beauty-care-<normalized name>`; source reference suffix is added only when the normalized base slug collides.

These SKUs are migration-reserved identifiers, not claimed historical SKUs recovered from ADMIN PRO.

## Dry-run gates
DEV preview result:

- 952 `READY_CREATE`
- 0 conflicts
- 952 unique product IDs
- 952 unique SKUs
- 952 unique catalog codes
- 952 unique slugs
- 136 human-approved
- 816 policy-approved
- `public.products = 0`
- import operations = 0

Local and DEV manifests match with MD5:
`bb5fda9f4e9e0215b172139799941222`.

## Cutover gate
`public.import_full_canonical_products_controlled(text, uuid)` is installed with authentication, OWNER/ADMIN authorization, advisory locking, preview validation, count validation, approval-source drift protection, taxonomy validation and idempotency.

`EXECUTE` remains revoked from both `anon` and `authenticated` in this phase.

## Non-goals
This phase does not:
- insert products,
- upload images,
- alter inventory,
- publish products to the website,
- write price history,
- touch STYLE candidates.
