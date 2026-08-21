# FASE 1.14 — Product Images Persistence Foundation

- Adds canonical `public.product_images` metadata.
- Enforces at most one ACTIVE main image per product with a partial unique index.
- Keeps `products.main_image_url` untouched as legacy compatibility.
- Adds authenticated, profile-authorized read RPC `get_product_images`.
- Direct table reads remain denied.
- Product-image writes and Supabase Storage remain blocked.
- No legacy backfill is executed in this phase.
