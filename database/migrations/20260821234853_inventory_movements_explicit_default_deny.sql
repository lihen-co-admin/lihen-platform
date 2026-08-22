drop policy if exists inventory_movements_explicit_deny on public.inventory_movements;
create policy inventory_movements_explicit_deny
on public.inventory_movements
as restrictive
for all
to anon, authenticated
using (false)
with check (false);
