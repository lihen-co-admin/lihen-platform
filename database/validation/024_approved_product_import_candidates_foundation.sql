-- Expected after FASE 1.21.5 foundation and before cutover.
select import_status,count(*)
from lihen_private.preview_approved_product_import('388a459d-f3f9-4709-88b5-b025dac28ba2'::uuid)
group by import_status order by import_status;

select
  (select count(*) from public.products) as products_rows,
  (select count(*) from lihen_private.approved_product_import_candidates where import_run_id='388a459d-f3f9-4709-88b5-b025dac28ba2'::uuid) as staged,
  (select count(*) from lihen_private.approved_product_import_operations) as import_operations,
  has_function_privilege('authenticated','public.import_approved_products_controlled(text,uuid)','EXECUTE') as import_rpc_authenticated_execute;
-- Acceptance: READY_CREATE=136, products=0, staged=136, import_operations=0, execute=false.
