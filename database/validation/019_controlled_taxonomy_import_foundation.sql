-- FASE 1.20.2 validation
-- Expected before cutover: 51 preview rows, 51 READY_CREATE, 0 brands/categories/products.

select *
from lihen_private.preview_taxonomy_import('320706a7-e345-5936-892a-d01727ad0afb'::uuid)
order by entity_type, source_page nulls last, canonical_name;

select
  count(*) as preview_rows,
  count(*) filter (where import_status = 'READY_CREATE') as ready_create,
  count(*) filter (where import_status = 'ALREADY_EXISTS') as already_exists,
  count(*) filter (where import_status like 'CONFLICT%') as conflicts
from lihen_private.preview_taxonomy_import('320706a7-e345-5936-892a-d01727ad0afb'::uuid);

select
  (select count(*) from public.brands) as brands_rows,
  (select count(*) from public.categories) as categories_rows,
  (select count(*) from public.products) as products_rows,
  has_function_privilege('anon', 'public.import_approved_taxonomy_controlled(text,uuid)', 'EXECUTE') as anon_execute,
  has_function_privilege('authenticated', 'public.import_approved_taxonomy_controlled(text,uuid)', 'EXECUTE') as authenticated_execute;
