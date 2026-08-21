# FASE 1.2.1 — DEV Schema + RLS Precheck

Status in this artifact: **IMPLEMENTED / DEV EXECUTION PENDING**.

The repository now contains a read-only precheck at `database/validation/001_product_read_contract_precheck.sql` and an authenticated runtime probe checklist at `database/validation/002_product_read_rls_authenticated_probe.md`.

The gate validates the exact six-field legacy contract currently used by `SupabaseProductRepository`:

- `id`
- `sku`
- `catalog_code`
- `name`
- `status`
- `sale_price`

It also inventories the real status vocabulary, rejects blank names and negative/NULL sale prices, inspects RLS enablement and lists the deployed `products` policies.

No SQL in this phase mutates data or policies.

This environment does not contain LIHEN Supabase DEV credentials or an authenticated DEV session, therefore the gate is deliberately **not marked PASS**. The correct next execution is to run the SQL against DEV and store the output as evidence. Production must not be used as a substitute.
