select status,source_count,generated_count,ready_upload_count,over_limit_count,duplicate_hash_group_count,
       metadata_authority,upload_manifest_sha256,derivative_manifest_sha256,generated_total_bytes
from lihen_private.web_image_derivative_runs
where id='35301d9d-fbee-4244-8f42-67273118411d';
select count(*) as product_images from public.product_images;
select count(*) as storage_objects from storage.objects;
select count(*) as visible_web from public.products where visible_on_website=true;
select count(*) as main_image_urls from public.products where main_image_url is not null;
