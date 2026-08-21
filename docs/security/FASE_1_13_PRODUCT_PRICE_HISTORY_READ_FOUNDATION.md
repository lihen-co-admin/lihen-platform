# FASE 1.13 — Product Price History Read Foundation

Goal: make persisted sale-price history readable through one authorized read contract without granting browser roles direct access to the history table and without enabling any write path.

## Read contract

`public.get_product_sale_price_history(uuid)` is the Data API/RPC surface. It is `SECURITY INVOKER` and delegates to a private helper.

`lihen_private.get_product_sale_price_history_authorized(uuid)` is `SECURITY DEFINER`, has an empty `search_path`, fully qualifies relations, and permits only authenticated LIHEN profiles with `authorization_status = ACTIVE` and one of `OWNER`, `ADMIN`, `OPERATOR`, or `VIEWER`.

The private schema is not an exposed API schema. `authenticated` receives only `USAGE` on the schema and `EXECUTE` on this specific helper so the public invoker wrapper can call it.

## Direct-table posture

`anon` and `authenticated` keep no direct privileges on `public.product_sale_price_history`. Existing fail-closed RLS remains in place. No INSERT, UPDATE, or DELETE grant is introduced on `products` or the price-history table.

## UI gate

The Control Center adds `VITE_PRODUCT_PRICE_HISTORY_READ_MODE=blocked|controlled`. Default is `blocked`. This allows the DB read contract to be validated independently while keeping the UI path disabled until the real GitHub/JWT/profile gate is closed.

## Non-goals

This phase does not enable CreateProduct, UpdateProduct, ChangeProductSalePrice, direct history-table reads, or production writes.
