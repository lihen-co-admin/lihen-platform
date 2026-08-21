# FASE 1.21.7 — FULL CANONICAL PRODUCT IMPORT DEV CUTOVER

## Purpose
Execute exactly one controlled DEV import of the authoritative 952-product BEAUTY_CARE canonical set prepared in FASE 1.21.6, validate idempotency, and immediately re-lock the import RPC.

## Authoritative run
- scope: `FULL_CANONICAL_APPROVED`
- business line: `BEAUTY_CARE`
- canonical approved: 952
- human approved: 136
- policy approved: 816
- pre-cutover `public.products`: 0
- pre-cutover preview: 952 `READY_CREATE`, 0 conflicts

## Idempotency defect found before cutover
The FASE 1.21.6 RPC checked the mutable import preview before checking whether the supplied `operation_key` had already completed. After the first import, the preview would necessarily report product/SKU/catalog-code/slug conflicts, preventing a legitimate replay from returning the original result.

The RPC was corrected before any product write. A stable fingerprint is now derived from immutable run identity/counts/strategy. An existing completed operation is resolved before the live preview is evaluated.

## Controlled cutover
The RPC was temporarily granted to `authenticated`. Authorization still required an authenticated ACTIVE OWNER or ADMIN inside the `SECURITY DEFINER` function.

One operation was executed with the deterministic cutover key:
`FASE_1_21_7_FULL_CANONICAL_PRODUCT_IMPORT_2026_08_21_V1`.

Result:
- created products: 952
- HUMAN_APPROVED: 136
- POLICY_APPROVED: 816
- business line: BEAUTY_CARE

## Idempotency verification
The exact same operation key was replayed after the 952 products existed.

The RPC returned the original result snapshot, including the original completion timestamp, and did not create additional rows.

Final import operation rows: 1.

## Physical post-cutover validation
- `public.products`: 952
- BEAUTY_CARE products: 952
- STYLE products: 0
- unique product IDs: 952
- unique SKUs: 952
- unique catalog codes: 952
- unique slugs: 952
- all 952 staged product IDs/SKUs/catalog codes/slugs/prices/brands/categories/business lines match the inserted Product Master rows
- `visible_on_website = true`: 0
- non-null `main_image_url`: 0
- `public.product_images`: 0
- Storage objects: 0
- private Storage asset metadata: 0

No inventory/stock/movement table exists in the current DEV Product Master schema used by this cutover, and the cutover RPC only inserted `public.products`. No inventory movement was performed.

## Gate closure
Immediately after validation and replay, `EXECUTE` was revoked again from `authenticated`, `anon`, and `public`.

Final:
- authenticated EXECUTE: false
- anon EXECUTE: false

## Explicit non-goals
This cutover did not:
- publish any product to Web,
- upload or link product images,
- create Storage objects,
- move inventory/stock,
- write STYLE products,
- publish a PDF catalog,
- change supplier data.
