-- FASE 1.21.2.1 acceptance gates
select code,display_name,status,sort_order from public.business_lines order by sort_order;
select business_line,count(*) from public.categories group by business_line order by business_line;
select business_line,count(*) from lihen_private.product_import_candidate_runs group by business_line order by business_line;
select business_line,count(*) from lihen_private.product_import_candidates group by business_line order by business_line;
select count(*) as products_rows from public.products;
select count(*) as category_candidate_line_mismatch
from lihen_private.product_import_candidates c
join public.categories cat on cat.id=c.category_id
where c.business_line<>cat.business_line;
select business_line,count(*) from lihen_private.product_candidate_review_resolution_queue group by business_line order by business_line;
select p.proname,pg_get_function_identity_arguments(p.oid) args,p.prosecdef,
       has_function_privilege('anon',p.oid,'EXECUTE') anon_execute,
       has_function_privilege('authenticated',p.oid,'EXECUTE') authenticated_execute
from pg_proc p join pg_namespace n on n.oid=p.pronamespace
where n.nspname='public' and p.proname in('create_product_controlled','update_product_controlled') order by p.proname;
select conname,pg_get_constraintdef(oid) definition
from pg_constraint
where conname in (
  'products_category_business_line_fkey',
  'product_import_candidates_category_business_line_fkey',
  'categories_parent_business_line_fkey'
)
order by conname;

select business_line,count(*)
from lihen_private.product_candidate_identity_groups
group by business_line
order by business_line;
