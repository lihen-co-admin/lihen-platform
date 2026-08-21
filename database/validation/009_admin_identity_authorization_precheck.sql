-- FASE 1.9 acceptance checks. Read-only.
select c.relname as table_name, c.relrowsecurity as rls_enabled
from pg_class c
join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public' and c.relname in ('admin_roles','profiles','products')
order by c.relname;

select tablename, policyname, roles, cmd, qual, with_check
from pg_policies
where schemaname = 'public' and tablename in ('admin_roles','profiles','products')
order by tablename, policyname;

select table_name, grantee, privilege_type
from information_schema.role_table_grants
where table_schema = 'public'
  and table_name in ('admin_roles','profiles','products')
  and grantee in ('anon','authenticated')
order by table_name, grantee, privilege_type;

select code, name, sort_order from public.admin_roles order by sort_order;

select count(*)::int as auth_users from auth.users;
select count(*)::int as profiles from public.profiles;
