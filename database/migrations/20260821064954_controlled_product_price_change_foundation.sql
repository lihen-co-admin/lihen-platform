-- FASE 1.12 — Controlled Product Price Change Foundation
-- Precio actual + historial append-only en una sola transacción. RPC físicamente OFF.

create table if not exists public.product_sale_price_history (
  id uuid primary key,
  product_id uuid not null references public.products(id) on delete restrict,
  previous_price numeric(14,2) not null,
  new_price numeric(14,2) not null,
  currency text not null default 'COP',
  reason text not null,
  actor_id uuid not null references auth.users(id) on delete restrict,
  changed_at timestamptz not null default now(),
  constraint product_sale_price_history_previous_nonnegative check (previous_price >= 0),
  constraint product_sale_price_history_new_nonnegative check (new_price >= 0),
  constraint product_sale_price_history_reason_not_blank check (length(btrim(reason)) > 0),
  constraint product_sale_price_history_currency_not_blank check (length(btrim(currency)) > 0),
  constraint product_sale_price_history_changed check (previous_price <> new_price)
);

create index if not exists product_sale_price_history_product_changed_idx
  on public.product_sale_price_history(product_id, changed_at desc);

alter table public.product_sale_price_history enable row level security;
revoke all on table public.product_sale_price_history from anon, authenticated;

-- Defense in depth: historical price rows are immutable even for accidental SQL UPDATE/DELETE.
create or replace function lihen_private.reject_product_sale_price_history_mutation()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  raise exception using errcode = '55000', message = 'LIHEN_PRICE_HISTORY_APPEND_ONLY';
end;
$$;

revoke execute on function lihen_private.reject_product_sale_price_history_mutation() from public, anon, authenticated;

drop trigger if exists product_sale_price_history_append_only on public.product_sale_price_history;
create trigger product_sale_price_history_append_only
before update or delete on public.product_sale_price_history
for each row execute function lihen_private.reject_product_sale_price_history_mutation();

alter table lihen_private.product_write_operations
  drop constraint if exists product_write_operations_type_check;

alter table lihen_private.product_write_operations
  add constraint product_write_operations_type_check
  check (operation_type in ('CREATE_PRODUCT', 'UPDATE_PRODUCT', 'CHANGE_PRODUCT_SALE_PRICE'));

create or replace function public.change_product_sale_price_controlled(
  p_operation_key text,
  p_history_id uuid,
  p_product_id uuid,
  p_new_price numeric,
  p_currency text,
  p_reason text
)
returns table (
  id uuid,
  sku text,
  catalog_code text,
  name text,
  brand_id uuid,
  category_id uuid,
  status text,
  sale_price numeric,
  history_id uuid,
  previous_price numeric,
  currency text,
  reason text,
  actor_id uuid,
  changed_at timestamptz
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor_id uuid;
  v_fingerprint text;
  v_existing lihen_private.product_write_operations%rowtype;
  v_product public.products%rowtype;
  v_history public.product_sale_price_history%rowtype;
begin
  v_actor_id := (select auth.uid());

  if v_actor_id is null then
    raise exception using errcode = '42501', message = 'LIHEN_AUTH_REQUIRED';
  end if;

  if not exists (
    select 1 from public.profiles p
    where p.id = v_actor_id
      and p.authorization_status = 'ACTIVE'
      and p.role_code in ('OWNER', 'ADMIN')
  ) then
    raise exception using errcode = '42501', message = 'LIHEN_PRODUCT_PRICE_CHANGE_FORBIDDEN';
  end if;

  if p_operation_key is null or length(btrim(p_operation_key)) = 0 then
    raise exception using errcode = '22023', message = 'LIHEN_OPERATION_KEY_REQUIRED';
  end if;
  if p_history_id is null then
    raise exception using errcode = '22023', message = 'LIHEN_PRICE_HISTORY_ID_REQUIRED';
  end if;
  if p_product_id is null then
    raise exception using errcode = '22023', message = 'LIHEN_PRODUCT_ID_REQUIRED';
  end if;
  if p_new_price is null or p_new_price < 0 then
    raise exception using errcode = '22023', message = 'LIHEN_PRODUCT_PRICE_INVALID';
  end if;
  if p_currency is null or length(btrim(p_currency)) = 0 then
    raise exception using errcode = '22023', message = 'LIHEN_CURRENCY_REQUIRED';
  end if;
  if p_reason is null or length(btrim(p_reason)) < 3 then
    raise exception using errcode = '22023', message = 'LIHEN_PRICE_CHANGE_REASON_REQUIRED';
  end if;

  v_fingerprint := md5(concat_ws('|',
    p_product_id::text,
    p_history_id::text,
    p_new_price::text,
    upper(btrim(p_currency)),
    btrim(p_reason)
  ));

  select o.* into v_existing
  from lihen_private.product_write_operations o
  where o.operation_key = btrim(p_operation_key);

  if found then
    if v_existing.operation_type <> 'CHANGE_PRODUCT_SALE_PRICE'
      or v_existing.actor_id <> v_actor_id
      or v_existing.product_id <> p_product_id
      or v_existing.request_fingerprint is distinct from v_fingerprint
      or v_existing.result_snapshot is null then
      raise exception using errcode = '23505', message = 'LIHEN_PRODUCT_WRITE_OPERATION_CONFLICT';
    end if;

    return query select
      (v_existing.result_snapshot->>'id')::uuid,
      nullif(v_existing.result_snapshot->>'sku', ''),
      nullif(v_existing.result_snapshot->>'catalog_code', ''),
      v_existing.result_snapshot->>'name',
      nullif(v_existing.result_snapshot->>'brand_id', '')::uuid,
      nullif(v_existing.result_snapshot->>'category_id', '')::uuid,
      v_existing.result_snapshot->>'status',
      (v_existing.result_snapshot->>'sale_price')::numeric,
      (v_existing.result_snapshot->>'history_id')::uuid,
      (v_existing.result_snapshot->>'previous_price')::numeric,
      v_existing.result_snapshot->>'currency',
      v_existing.result_snapshot->>'reason',
      (v_existing.result_snapshot->>'actor_id')::uuid,
      (v_existing.result_snapshot->>'changed_at')::timestamptz;
    return;
  end if;

  -- Lock the current product so the previous price is authoritative and race-safe.
  select p.* into v_product
  from public.products p
  where p.id = p_product_id
  for update;

  if not found then
    raise exception using errcode = 'P0002', message = 'LIHEN_PRODUCT_NOT_FOUND';
  end if;

  if v_product.sale_price = p_new_price then
    raise exception using errcode = '22000', message = 'LIHEN_PRODUCT_SALE_PRICE_UNCHANGED';
  end if;

  insert into public.product_sale_price_history (
    id, product_id, previous_price, new_price, currency, reason, actor_id
  ) values (
    p_history_id,
    p_product_id,
    v_product.sale_price,
    p_new_price,
    upper(btrim(p_currency)),
    btrim(p_reason),
    v_actor_id
  ) returning * into v_history;

  update public.products p
  set sale_price = p_new_price, updated_at = now()
  where p.id = p_product_id
  returning p.* into v_product;

  insert into lihen_private.product_write_operations (
    operation_key, operation_type, actor_id, product_id, request_fingerprint, result_snapshot
  ) values (
    btrim(p_operation_key),
    'CHANGE_PRODUCT_SALE_PRICE',
    v_actor_id,
    p_product_id,
    v_fingerprint,
    jsonb_build_object(
      'id', v_product.id,
      'sku', v_product.sku,
      'catalog_code', v_product.catalog_code,
      'name', v_product.name,
      'brand_id', v_product.brand_id,
      'category_id', v_product.category_id,
      'status', v_product.status,
      'sale_price', v_product.sale_price,
      'history_id', v_history.id,
      'previous_price', v_history.previous_price,
      'currency', v_history.currency,
      'reason', v_history.reason,
      'actor_id', v_history.actor_id,
      'changed_at', v_history.changed_at
    )
  );

  return query select
    v_product.id,
    v_product.sku,
    v_product.catalog_code,
    v_product.name,
    v_product.brand_id,
    v_product.category_id,
    v_product.status,
    v_product.sale_price,
    v_history.id,
    v_history.previous_price,
    v_history.currency,
    v_history.reason,
    v_history.actor_id,
    v_history.changed_at;
end;
$$;

-- Keep RPC physically OFF until the explicit cutover gate.
revoke execute on function public.change_product_sale_price_controlled(text, uuid, uuid, numeric, text, text) from public;
revoke execute on function public.change_product_sale_price_controlled(text, uuid, uuid, numeric, text, text) from anon;
revoke execute on function public.change_product_sale_price_controlled(text, uuid, uuid, numeric, text, text) from authenticated;

-- Direct writes remain blocked; price must never be changed with direct table UPDATE.
revoke insert, update, delete on table public.products from anon, authenticated;
