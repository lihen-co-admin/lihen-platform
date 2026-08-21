-- FASE 1.13 validation: read RPC exposed, direct history table hidden, no writes opened.
select
  has_function_privilege('anon', 'public.get_product_sale_price_history(uuid)', 'EXECUTE') as anon_can_execute_public_rpc,
  has_function_privilege('authenticated', 'public.get_product_sale_price_history(uuid)', 'EXECUTE') as authenticated_can_execute_public_rpc,
  has_table_privilege('anon', 'public.product_sale_price_history', 'SELECT') as anon_can_select_history_table,
  has_table_privilege('authenticated', 'public.product_sale_price_history', 'SELECT') as authenticated_can_select_history_table,
  has_table_privilege('authenticated', 'public.products', 'UPDATE') as authenticated_can_update_products,
  has_table_privilege('authenticated', 'public.product_sale_price_history', 'INSERT') as authenticated_can_insert_history;

select policyname, cmd, roles, qual
from pg_policies
where schemaname = 'public'
  and tablename = 'product_sale_price_history'
order by policyname;
