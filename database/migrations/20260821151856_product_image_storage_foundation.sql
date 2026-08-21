-- FASE 1.17 — STORAGE ARCHITECTURE & IMAGE UPLOAD FOUNDATION
-- Does NOT create Storage buckets or Storage upload policies.
-- Supabase Storage schema is treated as read-only; buckets must be created through Storage API/CLI/Dashboard.

begin;

-- Expand source types without changing existing rows.
alter table public.product_images
  drop constraint if exists product_images_source_type_check;

alter table public.product_images
  add constraint product_images_source_type_check
  check (source_type in ('MANUAL','LEGACY_MAIN_IMAGE_URL','STORAGE'));

-- Internal metadata for immutable Storage objects. Not exposed through Data API.
create table if not exists lihen_private.product_image_storage_assets (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products(id) on delete restrict,
  product_image_id uuid not null references public.product_images(id) on delete restrict,
  variant text not null,
  bucket_id text not null,
  object_path text not null,
  mime_type text not null,
  byte_size bigint not null,
  sha256 text not null,
  width_px integer null,
  height_px integer null,
  status text not null default 'STAGED',
  created_by uuid null references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  activated_at timestamptz null,
  constraint product_image_storage_variant_check
    check (variant in ('ORIGINAL','WEB')),
  constraint product_image_storage_bucket_variant_check
    check (
      (variant = 'ORIGINAL' and bucket_id = 'lihen-product-originals')
      or (variant = 'WEB' and bucket_id = 'lihen-product-web')
    ),
  constraint product_image_storage_mime_check
    check (mime_type in ('image/jpeg','image/png','image/webp')),
  constraint product_image_storage_byte_size_check
    check (byte_size > 0),
  constraint product_image_storage_sha256_check
    check (sha256 ~ '^[0-9a-f]{64}$'),
  constraint product_image_storage_width_check
    check (width_px is null or width_px > 0),
  constraint product_image_storage_height_check
    check (height_px is null or height_px > 0),
  constraint product_image_storage_status_check
    check (status in ('STAGED','ACTIVE','SUPERSEDED','DELETED')),
  constraint product_image_storage_path_prefix_check
    check (object_path like ('products/' || product_id::text || '/' || product_image_id::text || '/%')),
  constraint product_image_storage_variant_path_check
    check (
      (variant = 'ORIGINAL' and object_path like '%/original/%')
      or (variant = 'WEB' and object_path like '%/web/%')
    ),
  constraint product_image_storage_bucket_path_unique unique (bucket_id, object_path)
);

create index if not exists product_image_storage_assets_product_idx
  on lihen_private.product_image_storage_assets(product_id, product_image_id, variant, status);

create unique index if not exists product_image_storage_one_active_variant_idx
  on lihen_private.product_image_storage_assets(product_image_id, variant)
  where status = 'ACTIVE';

revoke all on table lihen_private.product_image_storage_assets from public, anon, authenticated;

comment on table lihen_private.product_image_storage_assets is
  'Internal immutable Storage-object metadata. FASE 1.17 creates no buckets and enables no Storage writes.';

commit;
