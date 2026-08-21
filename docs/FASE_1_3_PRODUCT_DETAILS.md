# FASE 1.3 — Product Details / GetProductById

Status: **IMPLEMENTED**.

Vertical slice:

`ProductDetailPage -> GetProductByIdQuery -> GetProductByIdHandler -> ProductRepository.findById -> InMemoryProductRepository | SupabaseProductRepository`

The detail page is repository-agnostic and uses the same composition switch as the list page. The Supabase adapter remains SELECT-only and requests the same six legacy fields validated by FASE 1.2.1.

## Behavior

- `/products/:id` loads one product.
- Existing product: renders name, SKU, catalog code, status, current sale price and configured source.
- Missing product: renders an explicit not-found state.
- Infrastructure failure: renders an error state without exposing Supabase internals.
- Product names in `/products` link to the detail route.

No product writes, migrations or production access are introduced by this phase.
