# FASE 1.17 — Storage Architecture & Image Upload Foundation

## Status

FOUNDATION ONLY. No real upload is enabled.

## Design

LIHEN separates source originals from public delivery assets:

- `lihen-product-originals` — PRIVATE, max 12 MiB, JPEG/PNG/WebP.
- `lihen-product-web` — PUBLIC delivery bucket, max 3 MiB, JPEG/PNG/WebP; preferred derivative format is WebP.

The buckets are intentionally **not created by SQL migration**. Supabase documents the `storage` schema as metadata that should be treated as read-only; bucket lifecycle should go through Storage API/CLI/Dashboard.

## Canonical paths

Objects are immutable and content-addressed:

`products/{product_id}/{image_id}/original/{sha256}.{ext}`

`products/{product_id}/{image_id}/web/{sha256}.{ext}`

Rules:

- UUID product/image identity is embedded in the path.
- SHA-256 is embedded in the filename.
- `upsert=false`: no overwrite-in-place.
- Replacing content creates a new SHA/path; historical evidence is preserved.

## Responsibilities

`ProductImage` is domain metadata.

`ProductImageStorage` is an infrastructure port.

`SupabaseProductImageStorage` is the adapter.

The browser must never hold a `service_role` key.

## Intended future flow

1. OWNER/ADMIN selects an image.
2. Application validates MIME/size and computes SHA-256.
3. Original is uploaded to the private originals bucket.
4. A trusted worker creates the web derivative.
5. Web derivative is uploaded to the public delivery bucket.
6. Controlled metadata operation writes `product_images` and storage-asset metadata.
7. Main-image selection remains a separate controlled command.

The worker/orchestration is NOT implemented in FASE 1.17.

## Bucket restrictions

### Originals
- private: true
- max: 12 MiB
- MIME: image/jpeg, image/png, image/webp
- authenticated browser INSERT: blocked in this phase
- update/upsert: forbidden by design
- delete: not part of normal application flow

### Web derivatives
- public: true
- max: 3 MiB
- MIME: image/jpeg, image/png, image/webp
- browser INSERT/UPDATE/DELETE: blocked
- future writes: trusted worker/server only

## HEIC/HEIF

Not accepted as canonical Storage input in this phase. Phone-origin HEIC/HEIF must be converted before upload so the canonical pipeline only persists supported, renderable formats.

## Catalog V1 relationship

The 1,003 image evidence hashes produced by FASE 1.16.1 are reconciliation evidence, not Storage objects. They can later help match catalog cards against canonical product images without blindly importing PDF-rendered crops as original assets.

## Gates

- `VITE_PRODUCT_IMAGE_STORAGE_UPLOAD_MODE=blocked` by default.
- Product image metadata write gate remains independently controlled.
- No Storage INSERT policy is active.
- No web derivative worker exists yet.
- No bucket/object contains production image content.
