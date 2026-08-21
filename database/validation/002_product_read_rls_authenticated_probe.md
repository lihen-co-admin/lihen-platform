# Product Read RLS — authenticated DEV probe

This is the runtime half of FASE 1.2.1. The SQL precheck proves the deployed schema/policies; this probe proves that the same publishable-key + authenticated-user path used by Control Center can actually read the six-field contract.

## Gate

1. Use **Supabase DEV**, never Production.
2. Set `VITE_PRODUCT_READ_SOURCE=supabase`.
3. Set the DEV `VITE_SUPABASE_URL` and DEV publishable key.
4. Sign in as a Control Center DEV user that should have `PRODUCT_READ` access under current RLS.
5. Open `/products` and `/products/<real-dev-product-id>`.
6. Confirm the browser request selects only `id, sku, catalog_code, name, status, sale_price` and succeeds under the user's JWT.
7. Confirm an unauthorized/anonymous context cannot gain broader private access merely by knowing the table name.

## Required evidence before marking FASE 1.2.1 PASS

- `001_product_read_contract_precheck.sql` output saved in DEV evidence.
- Six required columns are present and compatible.
- RLS is enabled on `public.products`.
- At least one SELECT policy grants the intended authenticated role/user access.
- All real status values are supported by `LegacyProductMapper`.
- No blank product names.
- No NULL/negative sale prices for rows expected to be readable by the new Product domain.
- `/products` works with DEV credentials.
- `/products/:id` works for a real DEV product.

If any item fails, do **not** weaken RLS to make the page work. Fix the contract/policy intentionally in DEV, document it, retest, then promote through the migration process.
