-- FASE 1.11 — Product Update Controlled Write Foundation
-- Prepara UpdateProduct transaccional e idempotente, pero NO lo habilita para authenticated.

alter table lihen_private.product_write_operations
  drop constraint if exists product_write_operations_type_check;

alter table lihen_private.product_write_operations
  add constraint product_write_operations_type_check
  check (operation_type in ('CREATE_PRODUCT', 'UPDATE_PRODUCT'));

alter table lihen_private.product_write_operations
  add column if not exists request_fingerprint text,
  add column if not exists result_snapshot jsonb;

create or replace function public.update_product_controlled(
  p_operation_key text,
  p_product_id uuid,
  p_sku text,
  p_catalog_code text,
  p_name text,
  p_brand_id uuid,
  p_category_id uuid,
  p_status text
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
  v_fingerprint text;
  v_existing lihen_private.product_write_operations%rowtype;
  v_result public.products%rowtype;
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
    raise exception using errcode = '42501', message = 'LIHEN_PRODUCT_UPDATE_FORBIDDEN';
  end if;

  if p_operation_key is null or length(btrim(p_operation_key)) = 0 then
    raise exception using errcode = '22023', message = 'LIHEN_OPERATION_KEY_REQUIRED';
  end if;

  if p_product_id is null then
    raise exception using errcode = '22023', message = 'LIHEN_PRODUCT_ID_REQUIRED';
  end if;

  if p_name is null or length(btrim(p_name)) = 0 then
    raise exception using errcode = '22023', message = 'LIHEN_PRODUCT_NAME_REQUIRED';
  end if;

  if p_status not in ('ACTIVE', 'INACTIVE', 'DISCONTINUED', 'ARCHIVED') then
    raise exception using errcode = '22023', message = 'LIHEN_PRODUCT_STATUS_INVALID';
  end if;

  if p_brand_id is not null and not exists (
    select 1 from public.brands b where b.id = p_brand_id
  ) then
    raise exception using errcode = '23503', message = 'LIHEN_BRAND_NOT_FOUND';
  end if;

  if p_category_id is not null and not exists (
    select 1 from public.categories c where c.id = p_category_id
  ) then
    raise exception using errcode = '23503', message = 'LIHEN_CATEGORY_NOT_FOUND';
  end if;

  v_fingerprint := md5(concat_ws('|',
    p_product_id::text,
    coalesce(nullif(btrim(p_sku), ''), '<NULL>'),
    coalesce(nullif(btrim(p_catalog_code), ''), '<NULL>'),
    btrim(p_name),
    coalesce(p_brand_id::text, '<NULL>'),
    coalesce(p_category_id::text, '<NULL>'),
    p_status
  ));

  select o.*
    into v_existing
  from lihen_private.product_write_operations o
  where o.operation_key = btrim(p_operation_key);

  if found then
    if v_existing.operation_type <> 'UPDATE_PRODUCT'
      or v_existing.actor_id <> v_actor_id
      or v_existing.product_id <> p_product_id
      or v_existing.request_fingerprint is distinct from v_fingerprint
      or v_existing.result_snapshot is null then
      raise exception using errcode = '23505', message = 'LIHEN_PRODUCT_WRITE_OPERATION_CONFLICT';
    end if;

    return query
    select
      (v_existing.result_snapshot->>'id')::uuid,
      nullif(v_existing.result_snapshot->>'sku', ''),
      nullif(v_existing.result_snapshot->>'catalog_code', ''),
      v_existing.result_snapshot->>'name',
      nullif(v_existing.result_snapshot->>'brand_id', '')::uuid,
      nullif(v_existing.result_snapshot->>'category_id', '')::uuid,
      v_existing.result_snapshot->>'status',
      (v_existing.result_snapshot->>'sale_price')::numeric;
    return;
  end if;

  if not exists (select 1 from public.products p where p.id = p_product_id) then
    raise exception using errcode = 'P0002', message = 'LIHEN_PRODUCT_NOT_FOUND';
  end if;

  update public.products p
  set
    sku = nullif(btrim(p_sku), ''),
    catalog_code = nullif(btrim(p_catalog_code), ''),
    name = btrim(p_name),
    brand_id = p_brand_id,
    category_id = p_category_id,
    status = p_status,
    updated_at = now()
  where p.id = p_product_id
  returning p.* into v_result;

  insert into lihen_private.product_write_operations (
    operation_key,
    operation_type,
    actor_id,
    product_id,
    request_fingerprint,
    result_snapshot
  ) values (
    btrim(p_operation_key),
    'UPDATE_PRODUCT',
    v_actor_id,
    p_product_id,
    v_fingerprint,
    jsonb_build_object(
      'id', v_result.id,
      'sku', v_result.sku,
      'catalog_code', v_result.catalog_code,
      'name', v_result.name,
      'brand_id', v_result.brand_id,
      'category_id', v_result.category_id,
      'status', v_result.status,
      'sale_price', v_result.sale_price
    )
  );

  return query
  select
    v_result.id,
    v_result.sku,
    v_result.catalog_code,
    v_result.name,
    v_result.brand_id,
    v_result.category_id,
    v_result.status,
    v_result.sale_price;
end;
$$;

-- Keep the RPC physically OFF until JWT + profile promotion + explicit cutover approval.
revoke execute on function public.update_product_controlled(text, uuid, text, text, text, uuid, uuid, text) from public;
revoke execute on function public.update_product_controlled(text, uuid, text, text, text, uuid, uuid, text) from anon;
revoke execute on function public.update_product_controlled(text, uuid, text, text, text, uuid, uuid, text) from authenticated;

-- Direct table writes remain blocked.
revoke insert, update, delete on table public.products from anon, authenticated;
