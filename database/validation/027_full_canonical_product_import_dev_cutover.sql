-- FASE 1.21.7 validation — expected final DEV state after controlled cutover.
select count(*) as products from public.products; -- 952
select count(*) as beauty_care_products from public.products where business_line='BEAUTY_CARE'; -- 952
select count(*) as style_products from public.products where business_line='STYLE'; -- 0
select count(distinct id) as unique_product_ids from public.products; -- 952
select count(distinct sku) as unique_skus from public.products; -- 952
select count(distinct catalog_code) as unique_catalog_codes from public.products; -- 952
select count(distinct slug) as unique_slugs from public.products; -- 952
select count(*) as visible_web from public.products where visible_on_website; -- 0
select count(*) as products_with_main_image from public.products where main_image_url is not null; -- 0
select count(*) as product_images from public.product_images; -- 0
select count(*) as storage_objects from storage.objects; -- 0
select count(*) as storage_asset_metadata from lihen_private.product_image_storage_assets; -- 0
select count(*) as import_operations from lihen_private.full_canonical_product_import_operations; -- 1
select has_function_privilege('authenticated','public.import_full_canonical_products_controlled(text,uuid)','EXECUTE') as authenticated_execute; -- false
select has_function_privilege('anon','public.import_full_canonical_products_controlled(text,uuid)','EXECUTE') as anon_execute; -- false
