-- FASE 1.20.3 acceptance evidence.
select
  (select count(*) from public.brands) as brands_rows,
  (select count(*) from public.categories) as categories_rows,
  (select count(*) from public.products) as products_rows,
  (select count(*) from lihen_private.taxonomy_import_operations) as import_operations,
  has_function_privilege('anon','public.import_approved_taxonomy_controlled(text,uuid)','EXECUTE') as anon_execute,
  has_function_privilege('authenticated','public.import_approved_taxonomy_controlled(text,uuid)','EXECUTE') as authenticated_execute,
  has_table_privilege('authenticated','public.brands','INSERT') as brands_insert,
  has_table_privilege('authenticated','public.categories','INSERT') as categories_insert;

-- Expected after FASE 1.20.3:
-- brands_rows=46
-- categories_rows=5
-- products_rows=0
-- import_operations=1
-- anon_execute=false
-- authenticated_execute=false
-- brands_insert=false
-- categories_insert=false
