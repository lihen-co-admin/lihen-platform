-- FASE 1.17 validation. Read-only checks.

select
  count(*) filter (where id = 'lihen-product-originals') as originals_bucket_count,
  count(*) filter (where id = 'lihen-product-web') as web_bucket_count,
  count(*) as total_storage_buckets
from storage.buckets;

select
  count(*) as storage_objects
from storage.objects;

select
  has_table_privilege('authenticated', 'public.product_images', 'INSERT') as authenticated_product_images_insert,
  has_table_privilege('authenticated', 'public.product_images', 'UPDATE') as authenticated_product_images_update,
  has_table_privilege('authenticated', 'public.product_images', 'DELETE') as authenticated_product_images_delete;

select
  count(*) as storage_asset_metadata_rows
from lihen_private.product_image_storage_assets;

select conname, pg_get_constraintdef(oid)
from pg_constraint
where conrelid = 'lihen_private.product_image_storage_assets'::regclass
order by conname;
