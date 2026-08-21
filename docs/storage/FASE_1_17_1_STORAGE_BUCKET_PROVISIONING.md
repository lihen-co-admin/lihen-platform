# FASE 1.17.1 — Storage Bucket Provisioning

## Objective

Provision the two empty product-image buckets using a supported Supabase Storage lifecycle mechanism, without enabling any upload/update/delete policy and without uploading any object.

## Canonical bucket specification

### `lihen-product-originals`
- Access: PRIVATE
- File size limit: 12 MiB
- Allowed MIME: `image/jpeg`, `image/png`, `image/webp`
- Purpose: immutable source originals
- Browser upload: BLOCKED

### `lihen-product-web`
- Access: PUBLIC READ
- File size limit: 3 MiB
- Allowed MIME: `image/jpeg`, `image/png`, `image/webp`
- Purpose: optimized public derivatives for web/catalog delivery
- Browser upload/update/delete: BLOCKED

## Non-negotiable gates

- No object upload in this phase.
- No `INSERT`, `UPDATE`, or `DELETE` policy for these buckets.
- No direct application mutation of `storage.objects`.
- No `service_role` in browser code.
- `VITE_PRODUCT_IMAGE_STORAGE_UPLOAD_MODE=blocked` remains unchanged.
- `VITE_PRODUCT_IMAGE_WRITE_MODE=blocked` remains unchanged.

## Reproducible provisioning source

`supabase/config.toml` contains the same restrictions and can be used by a supported Supabase CLI workflow.

## Remote DEV provisioning

DEV provisioning was completed using Supabase's documented SQL bucket-creation mechanism. The reproducible SQL is stored in `supabase/provisioning/001_product_image_buckets.sql`. This creates bucket definitions only; it does not create Storage objects or policies.

## Validation

Run `database/validation/014_storage_bucket_provisioning.sql` after remote provisioning.

Expected result:
- 2 expected buckets exist.
- both configurations match exactly.
- 0 objects in both buckets.
- 0 LIHEN product-image Storage policies.

## Next gate

Only after validation passes may LIHEN proceed to the image reconciliation/orchestration phase. Upload policies remain a separate future cutover.


## DEV result — PASS

Both buckets exist remotely with the exact expected visibility, file-size limits and MIME restrictions. Both contain 0 objects and there are 0 LIHEN product-image Storage policies.
