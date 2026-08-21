-- FASE 1.13 — Product Price History Read Foundation
-- Safe read projection through an authorized RPC. No write permission is added.

-- Keep the source table inaccessible directly from browser roles.
revoke all on table public.product_sale_price_history from anon, authenticated;

-- Harden the private schema first, then explicitly allow only this read helper.
revoke all on schema lihen_private from public, anon, authenticated;
grant usage on schema lihen_private to authenticated;
revoke execute on all functions in schema lihen_private from public, anon, authenticated;

create or replace function lihen_private.get_product_sale_price_history_authorized(
  p_product_id uuid
)
returns table (
  id uuid,
  product_id uuid,
  previous_price numeric,
  new_price numeric,
  currency text,
  reason text,
  actor_id uuid,
  changed_at timestamptz
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_actor_id uuid;
begin
  v_actor_id := (select auth.uid());

  if v_actor_id is null then
    raise exception using errcode = '42501', message = 'LIHEN_AUTH_REQUIRED';
  end if;

  if not exists (
    select 1
    from public.profiles p
    where p.id = v_actor_id
      and p.authorization_status = 'ACTIVE'
      and p.role_code in ('OWNER', 'ADMIN', 'OPERATOR', 'VIEWER')
  ) then
    raise exception using errcode = '42501', message = 'LIHEN_PRODUCT_PRICE_HISTORY_READ_FORBIDDEN';
  end if;

  if p_product_id is null then
    raise exception using errcode = '22023', message = 'LIHEN_PRODUCT_ID_REQUIRED';
  end if;

  if not exists (select 1 from public.products p where p.id = p_product_id) then
    raise exception using errcode = 'P0002', message = 'LIHEN_PRODUCT_NOT_FOUND';
  end if;

  return query
  select
    h.id,
    h.product_id,
    h.previous_price,
    h.new_price,
    h.currency,
    h.reason,
    h.actor_id,
    h.changed_at
  from public.product_sale_price_history h
  where h.product_id = p_product_id
  order by h.changed_at desc, h.id desc;
end;
$$;

revoke execute on function lihen_private.get_product_sale_price_history_authorized(uuid)
  from public, anon, authenticated;
grant execute on function lihen_private.get_product_sale_price_history_authorized(uuid)
  to authenticated;

-- Public Data API surface remains SECURITY INVOKER. It cannot bypass authorization itself.
create or replace function public.get_product_sale_price_history(
  p_product_id uuid
)
returns table (
  id uuid,
  product_id uuid,
  previous_price numeric,
  new_price numeric,
  currency text,
  reason text,
  actor_id uuid,
  changed_at timestamptz
)
language sql
stable
security invoker
set search_path = ''
as $$
  select *
  from lihen_private.get_product_sale_price_history_authorized(p_product_id);
$$;

revoke execute on function public.get_product_sale_price_history(uuid)
  from public, anon;
grant execute on function public.get_product_sale_price_history(uuid)
  to authenticated;

-- Reassert that this phase does not enable any business write.
revoke insert, update, delete on table public.products from anon, authenticated;
revoke insert, update, delete on table public.product_sale_price_history from anon, authenticated;
