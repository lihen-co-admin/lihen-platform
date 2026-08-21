# FASE 1.2 Validation

## Implemented

- `SupabaseProductRepository` implements `ProductRepository`.
- `LegacyProductMapper` isolates the current ADMIN database shape from the canonical Product domain.
- Adapter selection is explicit through `VITE_PRODUCT_READ_SOURCE=memory|supabase`.
- `memory` remains the default and remains available for unit tests/offline development.
- Supabase browser configuration accepts only URL + publishable key.
- Product reads use `SELECT` only.
- ProductsPage does not import Supabase or a concrete repository.

## Required before real DEV verification

1. Provide a dedicated Supabase DEV project URL and publishable key through `.env.local`.
2. Confirm the deployed DEV `products` table has the expected physical columns:
   `id`, `sku`, `catalog_code`, `name`, `status`, `sale_price`.
3. Confirm actual status values in DEV map to the canonical status vocabulary.
4. Confirm RLS permits the intended authenticated read.
5. Run the full workspace checks with Node 24 and installed pnpm dependencies.

## Explicitly not verified in this container

The execution environment does not currently provide the project dependencies/pnpm setup needed to run the complete Vite/Vitest/Playwright suite, and no Supabase DEV credentials were supplied. Therefore no claim is made that a live DEV query has been executed.
