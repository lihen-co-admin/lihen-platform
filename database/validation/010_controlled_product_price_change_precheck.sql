-- FASE 1.12 validation gate
select
  has_function_privilege('anon', 'public.change_product_sale_price_controlled(text,uuid,uuid,numeric,text,text)', 'EXECUTE') as anon_can_execute,
  has_function_privilege('authenticated', 'public.change_product_sale_price_controlled(text,uuid,uuid,numeric,text,text)', 'EXECUTE') as authenticated_can_execute;

select grantee, privilege_type
from information_schema.role_table_grants
where table_schema='public' and table_name in ('products','product_sale_price_history')
  and grantee in ('anon','authenticated')
order by table_name, grantee, privilege_type;
