select import_status,count(*)
from lihen_private.preview_full_canonical_product_import('99a5e5bd-6115-40eb-9ca8-8d4adaa3a209'::uuid)
group by import_status order by import_status;

select
  (select count(*) from lihen_private.full_canonical_product_import_candidates where import_run_id='99a5e5bd-6115-40eb-9ca8-8d4adaa3a209'::uuid) as staged,
  (select count(*) from lihen_private.full_canonical_product_import_candidates where import_run_id='99a5e5bd-6115-40eb-9ca8-8d4adaa3a209'::uuid and approval_source='HUMAN_APPROVED') as human_approved,
  (select count(*) from lihen_private.full_canonical_product_import_candidates where import_run_id='99a5e5bd-6115-40eb-9ca8-8d4adaa3a209'::uuid and approval_source='POLICY_APPROVED') as policy_approved,
  (select count(*) from public.products) as products_rows,
  (select count(*) from lihen_private.full_canonical_product_import_operations) as import_operations,
  has_function_privilege('authenticated','public.import_full_canonical_products_controlled(text,uuid)','EXECUTE') as authenticated_execute,
  has_function_privilege('anon','public.import_full_canonical_products_controlled(text,uuid)','EXECUTE') as anon_execute;
