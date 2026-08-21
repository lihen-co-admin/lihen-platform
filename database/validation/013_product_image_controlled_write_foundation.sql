-- FASE 1.16 validation — safe to run in DEV.
select
  p.proname as function_name,
  p.prosecdef as security_definer,
  has_function_privilege('anon', p.oid, 'EXECUTE') as anon_can_execute,
  has_function_privilege('authenticated', p.oid, 'EXECUTE') as authenticated_can_execute
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public'
  and p.proname in ('add_product_image_controlled','set_main_product_image_controlled')
order by p.proname;

select
  has_table_privilege('authenticated','public.product_images','INSERT') as authenticated_insert,
  has_table_privilege('authenticated','public.product_images','UPDATE') as authenticated_update,
  has_table_privilege('authenticated','public.product_images','DELETE') as authenticated_delete,
  (select count(*) from public.product_images) as product_images_rows,
  (select count(*) from lihen_private.product_image_write_operations) as image_write_operations;
