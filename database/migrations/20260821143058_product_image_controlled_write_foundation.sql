-- FASE 1.16 — Product Image Controlled Write Foundation
-- Prepares AddProductImage and SetMainProductImage as transactional/idempotent RPCs.
-- IMPORTANT: both RPCs remain physically OFF for authenticated in this phase.
-- Supabase Storage is intentionally untouched.

create table if not exists lihen_private.product_image_write_operations (
  operation_key text primary key,
  operation_type text not null,
  actor_id uuid not null references auth.users(id) on delete restrict,
  product_id uuid not null references public.products(id) on delete restrict,
  image_id uuid not null references public.product_images(id) on delete restrict,
  request_fingerprint text not null,
  result_snapshot jsonb not null,
  created_at timestamptz not null default now(),
  constraint product_image_write_operations_key_not_blank
    check (length(btrim(operation_key)) > 0),
  constraint product_image_write_operations_type_check
    check (operation_type in ('ADD_PRODUCT_IMAGE', 'SET_MAIN_PRODUCT_IMAGE')),
  constraint product_image_write_operations_fingerprint_not_blank
    check (length(btrim(request_fingerprint)) > 0)
);

revoke all on table lihen_private.product_image_write_operations
  from public, anon, authenticated;

create or replace function public.add_product_image_controlled(
  p_operation_key text,
  p_image_id uuid,
  p_product_id uuid,
  p_public_url text,
  p_alt_text text,
  p_make_main boolean
)
returns table (
  id uuid,
  product_id uuid,
  public_url text,
  storage_bucket text,
  storage_path text,
  alt_text text,
  is_main boolean,
  sort_order integer,
  source_type text,
  status text,
  created_at timestamptz,
  updated_at timestamptz
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor_id uuid := auth.uid();
  v_fingerprint text;
  v_existing lihen_private.product_image_write_operations%rowtype;
  v_result public.product_images%rowtype;
  v_make_main boolean;
  v_next_sort_order integer;
begin
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
    raise exception using errcode = '42501', message = 'LIHEN_PRODUCT_IMAGE_WRITE_FORBIDDEN';
  end if;

  if p_operation_key is null or length(btrim(p_operation_key)) = 0 then
    raise exception using errcode = '22023', message = 'LIHEN_OPERATION_KEY_REQUIRED';
  end if;

  if p_image_id is null then
    raise exception using errcode = '22023', message = 'LIHEN_PRODUCT_IMAGE_ID_REQUIRED';
  end if;

  if p_product_id is null then
    raise exception using errcode = '22023', message = 'LIHEN_PRODUCT_ID_REQUIRED';
  end if;

  if p_public_url is null or length(btrim(p_public_url)) = 0 then
    raise exception using errcode = '22023', message = 'LIHEN_PRODUCT_IMAGE_URL_REQUIRED';
  end if;

  v_fingerprint := md5(concat_ws('|',
    p_image_id::text,
    p_product_id::text,
    btrim(p_public_url),
    coalesce(nullif(btrim(p_alt_text), ''), '<NULL>'),
    coalesce(p_make_main, false)::text
  ));

  select o.*
    into v_existing
  from lihen_private.product_image_write_operations o
  where o.operation_key = btrim(p_operation_key);

  if found then
    if v_existing.operation_type <> 'ADD_PRODUCT_IMAGE'
      or v_existing.actor_id <> v_actor_id
      or v_existing.product_id <> p_product_id
      or v_existing.image_id <> p_image_id
      or v_existing.request_fingerprint is distinct from v_fingerprint
      or v_existing.result_snapshot is null then
      raise exception using errcode = '23505', message = 'LIHEN_PRODUCT_IMAGE_WRITE_OPERATION_CONFLICT';
    end if;

    return query
    select
      (v_existing.result_snapshot->>'id')::uuid,
      (v_existing.result_snapshot->>'product_id')::uuid,
      v_existing.result_snapshot->>'public_url',
      nullif(v_existing.result_snapshot->>'storage_bucket', ''),
      nullif(v_existing.result_snapshot->>'storage_path', ''),
      nullif(v_existing.result_snapshot->>'alt_text', ''),
      (v_existing.result_snapshot->>'is_main')::boolean,
      (v_existing.result_snapshot->>'sort_order')::integer,
      v_existing.result_snapshot->>'source_type',
      v_existing.result_snapshot->>'status',
      (v_existing.result_snapshot->>'created_at')::timestamptz,
      (v_existing.result_snapshot->>'updated_at')::timestamptz;
    return;
  end if;

  -- Serialize all image mutations for one product.
  perform 1
  from public.products p
  where p.id = p_product_id
  for update;

  if not found then
    raise exception using errcode = 'P0002', message = 'LIHEN_PRODUCT_NOT_FOUND';
  end if;

  if exists (select 1 from public.product_images i where i.id = p_image_id) then
    raise exception using errcode = '23505', message = 'LIHEN_PRODUCT_IMAGE_ID_CONFLICT';
  end if;

  select coalesce(max(i.sort_order), -1) + 1
    into v_next_sort_order
  from public.product_images i
  where i.product_id = p_product_id
    and i.status = 'ACTIVE';

  v_make_main := coalesce(p_make_main, false)
    or not exists (
      select 1
      from public.product_images i
      where i.product_id = p_product_id
        and i.status = 'ACTIVE'
    );

  if v_make_main then
    update public.product_images i
    set is_main = false,
        updated_at = now()
    where i.product_id = p_product_id
      and i.status = 'ACTIVE'
      and i.is_main = true;
  end if;

  insert into public.product_images (
    id,
    product_id,
    public_url,
    storage_bucket,
    storage_path,
    alt_text,
    is_main,
    sort_order,
    source_type,
    status
  ) values (
    p_image_id,
    p_product_id,
    btrim(p_public_url),
    null,
    null,
    nullif(btrim(p_alt_text), ''),
    v_make_main,
    v_next_sort_order,
    'MANUAL',
    'ACTIVE'
  )
  returning * into v_result;

  insert into lihen_private.product_image_write_operations (
    operation_key,
    operation_type,
    actor_id,
    product_id,
    image_id,
    request_fingerprint,
    result_snapshot
  ) values (
    btrim(p_operation_key),
    'ADD_PRODUCT_IMAGE',
    v_actor_id,
    p_product_id,
    p_image_id,
    v_fingerprint,
    jsonb_build_object(
      'id', v_result.id,
      'product_id', v_result.product_id,
      'public_url', v_result.public_url,
      'storage_bucket', v_result.storage_bucket,
      'storage_path', v_result.storage_path,
      'alt_text', v_result.alt_text,
      'is_main', v_result.is_main,
      'sort_order', v_result.sort_order,
      'source_type', v_result.source_type,
      'status', v_result.status,
      'created_at', v_result.created_at,
      'updated_at', v_result.updated_at
    )
  );

  return query
  select
    v_result.id,
    v_result.product_id,
    v_result.public_url,
    v_result.storage_bucket,
    v_result.storage_path,
    v_result.alt_text,
    v_result.is_main,
    v_result.sort_order,
    v_result.source_type,
    v_result.status,
    v_result.created_at,
    v_result.updated_at;
end;
$$;

create or replace function public.set_main_product_image_controlled(
  p_operation_key text,
  p_product_id uuid,
  p_image_id uuid
)
returns table (
  id uuid,
  product_id uuid,
  public_url text,
  storage_bucket text,
  storage_path text,
  alt_text text,
  is_main boolean,
  sort_order integer,
  source_type text,
  status text,
  created_at timestamptz,
  updated_at timestamptz
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor_id uuid := auth.uid();
  v_fingerprint text;
  v_existing lihen_private.product_image_write_operations%rowtype;
  v_snapshot jsonb;
begin
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
    raise exception using errcode = '42501', message = 'LIHEN_PRODUCT_IMAGE_WRITE_FORBIDDEN';
  end if;

  if p_operation_key is null or length(btrim(p_operation_key)) = 0 then
    raise exception using errcode = '22023', message = 'LIHEN_OPERATION_KEY_REQUIRED';
  end if;

  if p_product_id is null then
    raise exception using errcode = '22023', message = 'LIHEN_PRODUCT_ID_REQUIRED';
  end if;

  if p_image_id is null then
    raise exception using errcode = '22023', message = 'LIHEN_PRODUCT_IMAGE_ID_REQUIRED';
  end if;

  v_fingerprint := md5(concat_ws('|', p_product_id::text, p_image_id::text));

  select o.*
    into v_existing
  from lihen_private.product_image_write_operations o
  where o.operation_key = btrim(p_operation_key);

  if found then
    if v_existing.operation_type <> 'SET_MAIN_PRODUCT_IMAGE'
      or v_existing.actor_id <> v_actor_id
      or v_existing.product_id <> p_product_id
      or v_existing.image_id <> p_image_id
      or v_existing.request_fingerprint is distinct from v_fingerprint
      or v_existing.result_snapshot is null then
      raise exception using errcode = '23505', message = 'LIHEN_PRODUCT_IMAGE_WRITE_OPERATION_CONFLICT';
    end if;

    return query
    select
      x.id,
      x.product_id,
      x.public_url,
      x.storage_bucket,
      x.storage_path,
      x.alt_text,
      x.is_main,
      x.sort_order,
      x.source_type,
      x.status,
      x.created_at,
      x.updated_at
    from jsonb_to_recordset(v_existing.result_snapshot) as x(
      id uuid,
      product_id uuid,
      public_url text,
      storage_bucket text,
      storage_path text,
      alt_text text,
      is_main boolean,
      sort_order integer,
      source_type text,
      status text,
      created_at timestamptz,
      updated_at timestamptz
    )
    order by x.is_main desc, x.sort_order asc, x.id asc;
    return;
  end if;

  perform 1
  from public.products p
  where p.id = p_product_id
  for update;

  if not found then
    raise exception using errcode = 'P0002', message = 'LIHEN_PRODUCT_NOT_FOUND';
  end if;

  if not exists (
    select 1
    from public.product_images i
    where i.id = p_image_id
      and i.product_id = p_product_id
      and i.status = 'ACTIVE'
  ) then
    raise exception using errcode = 'P0002', message = 'LIHEN_PRODUCT_IMAGE_NOT_FOUND';
  end if;

  -- Two statements avoid transient violation of the one-active-main unique index.
  update public.product_images i
  set is_main = false,
      updated_at = now()
  where i.product_id = p_product_id
    and i.status = 'ACTIVE'
    and i.is_main = true
    and i.id <> p_image_id;

  update public.product_images i
  set is_main = true,
      updated_at = now()
  where i.id = p_image_id
    and i.product_id = p_product_id
    and i.status = 'ACTIVE';

  select coalesce(
    jsonb_agg(to_jsonb(x) order by x.is_main desc, x.sort_order asc, x.id asc),
    '[]'::jsonb
  )
  into v_snapshot
  from (
    select
      i.id,
      i.product_id,
      i.public_url,
      i.storage_bucket,
      i.storage_path,
      i.alt_text,
      i.is_main,
      i.sort_order,
      i.source_type,
      i.status,
      i.created_at,
      i.updated_at
    from public.product_images i
    where i.product_id = p_product_id
      and i.status = 'ACTIVE'
  ) x;

  insert into lihen_private.product_image_write_operations (
    operation_key,
    operation_type,
    actor_id,
    product_id,
    image_id,
    request_fingerprint,
    result_snapshot
  ) values (
    btrim(p_operation_key),
    'SET_MAIN_PRODUCT_IMAGE',
    v_actor_id,
    p_product_id,
    p_image_id,
    v_fingerprint,
    v_snapshot
  );

  return query
  select
    i.id,
    i.product_id,
    i.public_url,
    i.storage_bucket,
    i.storage_path,
    i.alt_text,
    i.is_main,
    i.sort_order,
    i.source_type,
    i.status,
    i.created_at,
    i.updated_at
  from public.product_images i
  where i.product_id = p_product_id
    and i.status = 'ACTIVE'
  order by i.is_main desc, i.sort_order asc, i.id asc;
end;
$$;

-- Keep both write RPCs physically OFF in FASE 1.16.
revoke execute on function public.add_product_image_controlled(text, uuid, uuid, text, text, boolean)
  from public, anon, authenticated;

revoke execute on function public.set_main_product_image_controlled(text, uuid, uuid)
  from public, anon, authenticated;

-- Defense in depth: direct metadata writes remain unavailable to browser roles.
revoke insert, update, delete on table public.product_images from anon, authenticated;

comment on function public.add_product_image_controlled(text, uuid, uuid, text, text, boolean)
  is 'FASE 1.16 controlled metadata write. Storage upload is intentionally out of scope and EXECUTE remains revoked.';
comment on function public.set_main_product_image_controlled(text, uuid, uuid)
  is 'FASE 1.16 controlled main-image switch. EXECUTE remains revoked until explicit cutover.';
