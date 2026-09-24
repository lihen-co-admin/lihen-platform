drop policy if exists customers_active_admin_select
on public.customers;

drop policy if exists customers_owner_admin_read
on public.customers;

create policy customers_owner_admin_read
on public.customers
for select
to authenticated
using (
  exists (
    select 1
    from public.profiles p
    where p.id = (select auth.uid())
      and p.authorization_status = 'ACTIVE'
      and p.role_code in ('OWNER','ADMIN')
  )
);
