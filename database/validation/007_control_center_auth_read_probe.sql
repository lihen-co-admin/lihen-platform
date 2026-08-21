-- FASE 1.2.3 - DB-side evidence only. This does NOT replace a browser JWT probe.
select relname as table_name, relrowsecurity as rls_enabled
from pg_class
where oid = 'public.products'::regclass;

select policyname, roles, cmd, qual, with_check
from pg_policies
where schemaname = 'public' and tablename = 'products';

select grantee, privilege_type
from information_schema.role_table_grants
where table_schema = 'public' and table_name = 'products'
  and grantee in ('anon','authenticated')
order by grantee, privilege_type;
