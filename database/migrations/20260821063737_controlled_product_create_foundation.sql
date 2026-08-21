-- FASE 1.10 — Controlled Product Write Foundation
-- Prepara CreateProduct transaccional e idempotente, pero NO lo habilita para authenticated.

create table if not exists lihen_private.product_write_operations (
  operation_key text primary key,
  operation_type text not null,
  actor_id uuid not null references auth.users(id) on delete restrict,
  product_id uuid not null references public.products(id) on delete restrict,
  created_at timestamptz not null default now(),
  constraint product_write_operations_key_not_blank check (length(btrim(operation_key)) > 0),
  constraint product_write_operations_type_check check (operation_type in ('CREATE_PRODUCT'))
);

revoke all on table lihen_private.product_write_operations from public, anon, authenticated;

create or replace function public.create_product_controlled(
  p_operation_key text,
  p_id uuid,
  p_sku text,
  p_catalog_code text,
  p_name text,
  p_brand_id uuid,
  p_category_id uuid,
  p_status text,
  p_sale_price numeric
)
returns table (
  id uuid,
  sku text,
  catalog_code text,
  name text,
  brand_id uuid,
  category_id uuid,
  status text,
  sale_price numeric
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor_id uuid;
  v_existing_product_id uuid;
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
      and p.role_code in ('OWNER', 'ADMIN')
  ) then
    raise exception using errcode = '42501', message = 'LIHEN_PRODUCT_CREATE_FORBIDDEN';
  end if;

  if p_operation_key is null or length(btrim(p_operation_key)) = 0 then
    raise exception using errcode = '22023', message = 'LIHEN_OPERATION_KEY_REQUIRED';
  end if;

  if p_id is null then
    raise exception using errcode = '22023', message = 'LIHEN_PRODUCT_ID_REQUIRED';
  end if;

  if p_name is null or length(btrim(p_name)) = 0 then
    raise exception using errcode = '22023', message = 'LIHEN_PRODUCT_NAME_REQUIRED';
  end if;

  if p_sale_price is null or p_sale_price < 0 then
    raise exception using errcode = '22023', message = 'LIHEN_PRODUCT_PRICE_INVALID';
  end if;

  if p_status not in ('ACTIVE', 'INACTIVE', 'DISCONTINUED', 'ARCHIVED') then
    raise exception using errcode = '22023', message = 'LIHEN_PRODUCT_STATUS_INVALID';
  end if;

  -- Idempotencia: la misma operation_key devuelve el producto creado originalmente.
  select o.product_id
    into v_existing_product_id
  from lihen_private.product_write_operations o
  where o.operation_key = btrim(p_operation_key)
    and o.operation_type = 'CREATE_PRODUCT'
    and o.actor_id = v_actor_id;

  if v_existing_product_id is not null then
    return query
    select pr.id, pr.sku, pr.catalog_code, pr.name, pr.brand_id, pr.category_id, pr.status, pr.sale_price
    from public.products pr
    where pr.id = v_existing_product_id;
    return;
  end if;

  insert into public.products (
    id,
    sku,
    catalog_code,
    name,
    brand_id,
    category_id,
    status,
    sale_price
  ) values (
    p_id,
    nullif(btrim(p_sku), ''),
    nullif(btrim(p_catalog_code), ''),
    btrim(p_name),
    p_brand_id,
    p_category_id,
    p_status,
    p_sale_price
  );

  insert into lihen_private.product_write_operations (
    operation_key,
    operation_type,
    actor_id,
    product_id
  ) values (
    btrim(p_operation_key),
    'CREATE_PRODUCT',
    v_actor_id,
    p_id
  );

  return query
  select pr.id, pr.sku, pr.catalog_code, pr.name, pr.brand_id, pr.category_id, pr.status, pr.sale_price
  from public.products pr
  where pr.id = p_id;
end;
$$;

-- Critical: functions are executable by PUBLIC by default. Keep this RPC physically OFF.
revoke execute on function public.create_product_controlled(text, uuid, text, text, text, uuid, uuid, text, numeric) from public;
revoke execute on function public.create_product_controlled(text, uuid, text, text, text, uuid, uuid, text, numeric) from anon;
revoke execute on function public.create_product_controlled(text, uuid, text, text, text, uuid, uuid, text, numeric) from authenticated;

-- Direct product writes remain blocked. Only SELECT stays granted to authenticated.
revoke insert, update, delete on table public.products from anon, authenticated;
