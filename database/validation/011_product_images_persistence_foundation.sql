select c.relrowsecurity as rls_enabled
from pg_class c join pg_namespace n on n.oid=c.relnamespace
where n.nspname='public' and c.relname='product_images';

select indexname, indexdef from pg_indexes
where schemaname='public' and tablename='product_images'
order by indexname;

select
  has_table_privilege('anon','public.product_images','SELECT') as anon_select,
  has_table_privilege('authenticated','public.product_images','SELECT') as authenticated_select,
  has_function_privilege('anon','public.get_product_images(uuid)','EXECUTE') as anon_rpc,
  has_function_privilege('authenticated','public.get_product_images(uuid)','EXECUTE') as authenticated_rpc;
