# FASE 1.2 — Supabase DEV Product Read Adapter

## Purpose

Connect the existing `GetProducts` read slice to Supabase DEV without changing the domain, query handler, or page contract.

## Runtime selection

`VITE_PRODUCT_READ_SOURCE` controls the product read adapter:

- `memory` — default, safe local fixtures.
- `supabase` — read-only access to the configured Supabase DEV project.

When `supabase` is selected, both `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY` are required. There is no fallback to production and no service-role credential in the browser.

## Flow

```text
ProductsPage
  -> GetProductsHandler
  -> ProductRepository
  -> SupabaseProductRepository
  -> public.products (DEV, SELECT only)
  -> LegacyProductMapper
  -> Product domain
  -> ProductListItemDTO
```

## Legacy boundary

The adapter currently reads only the verified legacy fields needed by the Product Read Slice:

- `id`
- `sku`
- `catalog_code`
- `name`
- `status`
- `sale_price`

`LegacyProductMapper` converts physical legacy names and values into the canonical domain. It deliberately rejects unknown statuses or invalid prices rather than inventing a mapping.

## Non-goals

FASE 1.2 does **not**:

- write products;
- run migrations;
- modify RLS;
- connect to production;
- read supplier costs, inventory, or private finance data;
- remove the in-memory repository.

## DEV connection

Create a local `.env.local` (never commit it):

```dotenv
VITE_PRODUCT_READ_SOURCE=supabase
VITE_SUPABASE_URL=<DEV URL>
VITE_SUPABASE_PUBLISHABLE_KEY=<DEV publishable key>
```

The DEV database must expose `SELECT` on the required product fields for the authenticated Control Center user under the deployed RLS policies.
