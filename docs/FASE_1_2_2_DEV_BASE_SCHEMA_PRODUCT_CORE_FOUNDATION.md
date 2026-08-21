# FASE 1.2.2 — DEV BASE SCHEMA / PRODUCT CORE FOUNDATION

## Target
- Supabase DEV: `lihen-platform-dev`
- Project ref: `vnmkupzptujtywnnabkp`
- `lihen-inauguracion`: not modified.

## Applied
1. `product_core_base_foundation`
2. `create_brands_expand`
3. `create_categories_expand`
4. `add_product_taxonomy_refs_expand`
5. `validate_product_taxonomy_fks_empty_baseline`

## Product read contract
The six fields required by `SupabaseProductRepository` exist with compatible types:
`id`, `sku`, `catalog_code`, `name`, `status`, `sale_price`.

## Security
- RLS enabled on `products`, `brands`, `categories`.
- `anon`: no privileges.
- `authenticated`: SELECT only.
- No INSERT/UPDATE/DELETE policy exists.
- SQL role probe: `authenticated` can SELECT; `anon` receives permission denied.
- Supabase security advisors: 0 findings after DDL.

## Data state
- products: 0
- brands: 0
- categories: 0
- legacy taxonomy values: 0
- taxonomy backfill: NOT EXECUTED / no source data.

## Taxonomy status
Structural expansion is applied. Legacy text columns remain intact and `brand_id/category_id` are nullable canonical refs. FKs are validated because the DEV baseline is empty.

## Cutover
NOT DONE. `SupabaseProductRepository` continues using the original six-field read contract. Canonical taxonomy read cutover waits for real data/mapping evidence.

## Remaining runtime gate
An authenticated browser/JWT probe through Supabase Data API is still required once Control Center Auth is wired. Database-level role/RLS behavior is verified.
