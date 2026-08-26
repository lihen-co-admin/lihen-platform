-- FASE 5 · Public Hub CUT 5
-- Prevents a PRODUCT block from entering PUBLISHED state unless its canonical
-- Product Master projection is actually publishable in the public Hub.
-- Forward-only and non-destructive. No Product Master mutation is performed.

create or replace function lihen_private.assert_public_hub_product_publishable(p_product_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $function$
begin
  if p_product_id is null then
    raise exception using errcode='22023', message='LIHEN_PUBLIC_HUB_PRODUCT_REQUIRED';
  end if;

  if not exists (
    select 1
    from public.products p
    where p.id = p_product_id
      and p.status = 'ACTIVE'
      and p.visible_on_website = true
      and p.sale_price is not null
      and p.sale_price >= 0
      and exists (
        select 1
        from public.product_images pi
        join lihen_private.product_image_storage_assets a
          on a.product_image_id = pi.id
         and a.status = 'ACTIVE'
         and a.rendition_profile = 'WEB_CARD'
        where pi.product_id = p.id
          and pi.status = 'ACTIVE'
          and pi.derivative_profile = 'WEB_CARD'
          and btrim(pi.public_url) <> ''
          and a.width_px > 0
          and a.height_px > 0
      )
  ) then
    raise exception using errcode='55000', message='LIHEN_PUBLIC_HUB_PRODUCT_NOT_PUBLISHABLE';
  end if;
end;
$function$;

revoke all on function lihen_private.assert_public_hub_product_publishable(uuid) from public, anon, authenticated;

create or replace function public.save_public_hub_block_controlled(
  p_operation_key text,
  p_block_id uuid default null,
  p_block_type text default 'LINK',
  p_status text default 'DRAFT',
  p_sort_order integer default null,
  p_product_id uuid default null,
  p_collection_key text default null,
  p_title text default null,
  p_subtitle text default null,
  p_body text default null,
  p_cta_label text default null,
  p_target_url text default null,
  p_image_url text default null,
  p_starts_at timestamptz default null,
  p_ends_at timestamptz default null
) returns uuid
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_actor uuid := auth.uid();
  v_id uuid;
  v_order integer;
  v_operation_type text;
begin
  if v_actor is null then raise exception using errcode='42501',message='LIHEN_AUTH_REQUIRED'; end if;
  if not exists(select 1 from public.profiles p where p.id=v_actor and p.authorization_status='ACTIVE' and p.role_code in ('OWNER','ADMIN')) then
    raise exception using errcode='42501',message='LIHEN_PUBLIC_HUB_WRITE_FORBIDDEN';
  end if;
  if nullif(btrim(p_operation_key),'') is null then raise exception using errcode='22023',message='LIHEN_PUBLIC_HUB_OPERATION_KEY_REQUIRED'; end if;

  select a.entity_id into v_id
  from public.operational_audit_log a
  where a.module='PUBLIC_HUB' and a.operation_key=p_operation_key
  limit 1;
  if v_id is not null then return v_id; end if;

  if p_block_type not in ('LINK','SOCIAL','PRODUCT','PRODUCT_COLLECTION','BANNER','TEXT','HEADING','CTA') then
    raise exception using errcode='22023',message='LIHEN_PUBLIC_HUB_BLOCK_TYPE_INVALID';
  end if;
  if p_status not in ('DRAFT','PUBLISHED','HIDDEN','ARCHIVED') then
    raise exception using errcode='22023',message='LIHEN_PUBLIC_HUB_STATUS_INVALID';
  end if;
  if p_sort_order is not null and p_sort_order < 0 then raise exception using errcode='22023',message='LIHEN_PUBLIC_HUB_SORT_INVALID'; end if;
  if p_starts_at is not null and p_ends_at is not null and p_starts_at >= p_ends_at then
    raise exception using errcode='22023',message='LIHEN_PUBLIC_HUB_SCHEDULE_INVALID';
  end if;
  if p_block_type='PRODUCT' and p_product_id is null then raise exception using errcode='22023',message='LIHEN_PUBLIC_HUB_PRODUCT_REQUIRED'; end if;
  if p_block_type='PRODUCT_COLLECTION' and nullif(btrim(p_collection_key),'') is null then raise exception using errcode='22023',message='LIHEN_PUBLIC_HUB_COLLECTION_REQUIRED'; end if;
  if p_block_type in ('LINK','SOCIAL','CTA') and nullif(btrim(p_target_url),'') is null then raise exception using errcode='22023',message='LIHEN_PUBLIC_HUB_TARGET_REQUIRED'; end if;
  if p_block_type='HEADING' and nullif(btrim(p_title),'') is null then raise exception using errcode='22023',message='LIHEN_PUBLIC_HUB_TITLE_REQUIRED'; end if;
  if p_block_type='TEXT' and nullif(btrim(p_body),'') is null then raise exception using errcode='22023',message='LIHEN_PUBLIC_HUB_BODY_REQUIRED'; end if;
  if p_block_type='BANNER' and nullif(btrim(p_title),'') is null and nullif(btrim(p_image_url),'') is null then raise exception using errcode='22023',message='LIHEN_PUBLIC_HUB_BANNER_CONTENT_REQUIRED'; end if;
  if p_product_id is not null and not exists(select 1 from public.products p where p.id=p_product_id) then raise exception using errcode='P0002',message='LIHEN_PUBLIC_HUB_PRODUCT_NOT_FOUND'; end if;

  if p_status='PUBLISHED' and p_block_type='PRODUCT' then
    perform lihen_private.assert_public_hub_product_publishable(p_product_id);
  end if;

  if p_sort_order is null then
    select coalesce(max(b.sort_order),-10)+10 into v_order
    from lihen_private.public_hub_blocks b
    where b.status <> 'ARCHIVED';
  else
    v_order := p_sort_order;
  end if;

  if p_block_id is null then
    insert into lihen_private.public_hub_blocks(
      block_type,status,sort_order,product_id,collection_key,title,subtitle,body,cta_label,target_url,image_url,
      starts_at,ends_at,created_by,updated_by,archived_at
    ) values (
      p_block_type,p_status,v_order,p_product_id,nullif(btrim(p_collection_key),''),nullif(btrim(p_title),''),
      nullif(btrim(p_subtitle),''),nullif(btrim(p_body),''),nullif(btrim(p_cta_label),''),nullif(btrim(p_target_url),''),
      nullif(btrim(p_image_url),''),p_starts_at,p_ends_at,v_actor,v_actor,case when p_status='ARCHIVED' then now() else null end
    ) returning id into v_id;
    v_operation_type := 'CREATE';
  else
    update lihen_private.public_hub_blocks b
    set block_type=p_block_type,status=p_status,sort_order=v_order,product_id=p_product_id,
      collection_key=nullif(btrim(p_collection_key),''),title=nullif(btrim(p_title),''),subtitle=nullif(btrim(p_subtitle),''),
      body=nullif(btrim(p_body),''),cta_label=nullif(btrim(p_cta_label),''),target_url=nullif(btrim(p_target_url),''),
      image_url=nullif(btrim(p_image_url),''),starts_at=p_starts_at,ends_at=p_ends_at,updated_by=v_actor,updated_at=now(),
      archived_at=case when p_status='ARCHIVED' then coalesce(b.archived_at,now()) else null end
    where b.id=p_block_id
    returning b.id into v_id;
    if v_id is null then raise exception using errcode='P0002',message='LIHEN_PUBLIC_HUB_BLOCK_NOT_FOUND'; end if;
    v_operation_type := 'UPDATE';
  end if;

  insert into public.operational_audit_log(module,operation_type,operation_key,actor_id,entity_type,entity_id,metadata)
  values('PUBLIC_HUB',v_operation_type,p_operation_key,v_actor,'PUBLIC_HUB_BLOCK',v_id,
    jsonb_build_object('block_type',p_block_type,'status',p_status))
  on conflict(module,operation_key) do nothing;

  return v_id;
end;
$function$;

create or replace function public.set_public_hub_block_status_controlled(
  p_operation_key text,
  p_block_id uuid,
  p_status text
) returns void
language plpgsql
security definer
set search_path=''
as $function$
declare
  v_actor uuid := auth.uid();
  v_block_type text;
  v_product_id uuid;
begin
  if v_actor is null then raise exception using errcode='42501',message='LIHEN_AUTH_REQUIRED'; end if;
  if not exists(select 1 from public.profiles p where p.id=v_actor and p.authorization_status='ACTIVE' and p.role_code in ('OWNER','ADMIN')) then
    raise exception using errcode='42501',message='LIHEN_PUBLIC_HUB_WRITE_FORBIDDEN';
  end if;
  if p_status not in ('DRAFT','PUBLISHED','HIDDEN','ARCHIVED') then raise exception using errcode='22023',message='LIHEN_PUBLIC_HUB_STATUS_INVALID'; end if;
  if exists(select 1 from public.operational_audit_log a where a.module='PUBLIC_HUB' and a.operation_key=p_operation_key) then return; end if;

  select b.block_type,b.product_id into v_block_type,v_product_id
  from lihen_private.public_hub_blocks b
  where b.id=p_block_id;
  if not found then raise exception using errcode='P0002',message='LIHEN_PUBLIC_HUB_BLOCK_NOT_FOUND'; end if;

  if p_status='PUBLISHED' and v_block_type='PRODUCT' then
    perform lihen_private.assert_public_hub_product_publishable(v_product_id);
  end if;

  update lihen_private.public_hub_blocks b
  set status=p_status,updated_by=v_actor,updated_at=now(),archived_at=case when p_status='ARCHIVED' then coalesce(b.archived_at,now()) else null end
  where b.id=p_block_id;

  insert into public.operational_audit_log(module,operation_type,operation_key,actor_id,entity_type,entity_id,metadata)
  values('PUBLIC_HUB','SET_STATUS',p_operation_key,v_actor,'PUBLIC_HUB_BLOCK',p_block_id,jsonb_build_object('status',p_status));
end;
$function$;

revoke all on function public.save_public_hub_block_controlled(text,uuid,text,text,integer,uuid,text,text,text,text,text,text,text,timestamptz,timestamptz) from public,anon;
revoke all on function public.set_public_hub_block_status_controlled(text,uuid,text) from public,anon;
grant execute on function public.save_public_hub_block_controlled(text,uuid,text,text,integer,uuid,text,text,text,text,text,text,text,timestamptz,timestamptz) to authenticated;
grant execute on function public.set_public_hub_block_status_controlled(text,uuid,text) to authenticated;

comment on function lihen_private.assert_public_hub_product_publishable(uuid)
  is 'FASE 5 Public Hub server-side publishability guard. Validates canonical product visibility, sale price and active WEB_CARD media without mutating Product Master.';
