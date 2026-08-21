select count(*) as products from public.products;
select count(*) as product_images from public.product_images;
select count(*) as storage_objects from storage.objects;
select linkage_status,count(*) from lihen_private.preview_canonical_product_image_linkage('39514b38-f90b-4b15-9ac1-0f12d8b1e625') group by linkage_status order by linkage_status;
select approval_source,count(*) from lihen_private.canonical_product_image_linkage_candidates where run_id='39514b38-f90b-4b15-9ac1-0f12d8b1e625' group by approval_source order by approval_source;
select exclusion_reason,count(*) from lihen_private.canonical_product_image_linkage_exclusions where run_id='39514b38-f90b-4b15-9ac1-0f12d8b1e625' group by exclusion_reason order by exclusion_reason;
