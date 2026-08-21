# FASE 1.7 — Product Images / Image Command Slice

## Implemented

- `ProductImage` domain model.
- `ProductImageRepository` port.
- `InMemoryProductImageRepository`.
- `AddProductImage` command/handler.
- `SetMainProductImage` command/handler.
- `GetProductImages` query/handler.
- exactly-one-main-image invariant in memory.
- `LegacyMainImageBackfillMapper` to prepare migration from `products.main_image_url`.
- Control Center image management page for memory mode.
- Supabase image writes explicitly blocked.
- DEV read-only precheck for `product_images`, RLS and legacy `main_image_url`.

## Deliberately NOT implemented

- Supabase Storage uploads.
- writes to `product_images` in Supabase.
- backfill from `products.main_image_url`.
- modification/removal of legacy `main_image_url`.
- Storage bucket/policies.

Those remain blocked until the DEV schema + RLS + Storage gate is approved.

## Main-image rule

Adding an image as main or calling `SetMainProductImage` demotes the previous main image in the same operation. The in-memory repository rejects an invalid initial state containing two active main images for one product.
