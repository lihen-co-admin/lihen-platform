-- FASE 1.18 acceptance checks. Must remain read-only.
select
  (select count(*) from public.products) as products_rows,
  (select count(*) from public.product_images) as product_images_rows,
  (select count(*) from storage.objects where bucket_id in ('lihen-product-originals','lihen-product-web')) as storage_objects_rows,
  (select count(*) from lihen_private.catalog_image_evidence) as imported_evidence_rows,
  (select count(*) from lihen_private.catalog_image_reconciliation_results) as reconciliation_result_rows,
  (select count(*) from lihen_private.catalog_image_reconciliation_decisions) as reconciliation_decision_rows;

select table_name, grantee, privilege_type
from information_schema.role_table_grants
where table_schema = 'lihen_private'
  and table_name in (
    'catalog_image_evidence_sources',
    'catalog_image_evidence',
    'catalog_image_reconciliation_runs',
    'catalog_image_reconciliation_results',
    'catalog_image_reconciliation_decisions'
  )
  and grantee in ('anon','authenticated','PUBLIC')
order by table_name, grantee, privilege_type;
