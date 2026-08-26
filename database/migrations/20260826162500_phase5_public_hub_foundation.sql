create table if not exists lihen_private.public_hub_blocks (
  id uuid primary key default gen_random_uuid(),
  block_type text not null,
  status text not null default 'DRAFT',
  sort_order integer not null default 0,
  product_id uuid references public.products(id) on delete restrict,
  collection_key text,
  title text,
  subtitle text,
  body text,
  cta_label text,
  target_url text,
  image_url text,
  starts_at timestamptz,
  ends_at timestamptz,
  created_by uuid references auth.users(id) on delete set null,
  updated_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  archived_at timestamptz,
  constraint public_hub_blocks_type_check check (block_type in ('LINK','SOCIAL','PRODUCT','PRODUCT_COLLECTION','BANNER','TEXT','HEADING','CTA')),
  constraint public_hub_blocks_status_check check (status in ('DRAFT','PUBLISHED','HIDDEN','ARCHIVED')),
  constraint public_hub_blocks_sort_order_check check (sort_order >= 0),
  constraint public_hub_blocks_schedule_check check (starts_at is null or ends_at is null or starts_at < ends_at),
  constraint public_hub_blocks_product_check check (block_type <> 'PRODUCT' or product_id is not null),
  constraint public_hub_blocks_collection_check check (block_type <> 'PRODUCT_COLLECTION' or length(btrim(coalesce(collection_key,''))) > 0),
  constraint public_hub_blocks_target_check check (block_type not in ('LINK','SOCIAL','CTA') or length(btrim(coalesce(target_url,''))) > 0),
  constraint public_hub_blocks_heading_check check (block_type <> 'HEADING' or length(btrim(coalesce(title,''))) > 0),
  constraint public_hub_blocks_text_check check (block_type <> 'TEXT' or length(btrim(coalesce(body,''))) > 0),
  constraint public_hub_blocks_banner_check check (block_type <> 'BANNER' or length(btrim(coalesce(title,''))) > 0 or length(btrim(coalesce(image_url,''))) > 0)
);

create index if not exists public_hub_blocks_public_order_idx
  on lihen_private.public_hub_blocks(status, sort_order, starts_at, ends_at);
create index if not exists public_hub_blocks_product_idx
  on lihen_private.public_hub_blocks(product_id)
  where product_id is not null;

alter table lihen_private.public_hub_blocks enable row level security;
revoke all on lihen_private.public_hub_blocks from public, anon, authenticated;

create or replace function public.get_public_hub_blocks_admin_controlled()
returns table(
  id uuid,
  block_type text,
  status text,
  sort_order integer,
  product_id uuid,
  collection_key text,
  title text,
  subtitle text,
  body text,
  cta_label text,
  target_url text,
  image_url text,
  starts_at timestamptz,
  ends_at timestamptz,
  created_at timestamptz,
  updated_at timestamptz
)
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_actor uuid := auth.uid();
begin
  if v_actor is null then
    raise exception using errcode='42501', message='LIHEN_AUTH_REQUIRED';
  end if;
  if not exists (
    select 1 from public.profiles p
    where p.id=v_actor and p.authorization_status='ACTIVE' and p.role_code in ('OWNER','ADMIN')
  ) then
    raise exception using errcode='42501', message='LIHEN_PUBLIC_HUB_READ_FORBIDDEN';
  end if;

  return query
  select b.id,b.block_type,b.status,b.sort_order,b.product_id,b.collection_key,b.title,b.subtitle,b.body,
    b.cta_label,b.target_url,b.image_url,b.starts_at,b.ends_at,b.created_at,b.updated_at
  from lihen_private.public_hub_blocks b
  order by case when b.status='ARCHIVED' then 1 else 0 end, b.sort_order, b.created_at, b.id;
end;
$function$;

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
begin
  if v_actor is null then raise exception using errcode='42501',message='LIHEN_AUTH_REQUIRED'; end if;
  if not exists(select 1 from public.profiles p where p.id=v_actor and p.authorization_status='ACTIVE' and p.role_code in ('OWNER','ADMIN')) then
    raise exception using errcode='42501',message='LIHEN_PUBLIC_HUB_WRITE_FORBIDDEN';
  end if;
  if p_status not in ('DRAFT','PUBLISHED','HIDDEN','ARCHIVED') then raise exception using errcode='22023',message='LIHEN_PUBLIC_HUB_STATUS_INVALID'; end if;
  if exists(select 1 from public.operational_audit_log a where a.module='PUBLIC_HUB' and a.operation_key=p_operation_key) then return; end if;

  update lihen_private.public_hub_blocks b
  set status=p_status,updated_by=v_actor,updated_at=now(),archived_at=case when p_status='ARCHIVED' then coalesce(b.archived_at,now()) else null end
  where b.id=p_block_id;
  if not found then raise exception using errcode='P0002',message='LIHEN_PUBLIC_HUB_BLOCK_NOT_FOUND'; end if;

  insert into public.operational_audit_log(module,operation_type,operation_key,actor_id,entity_type,entity_id,metadata)
  values('PUBLIC_HUB','SET_STATUS',p_operation_key,v_actor,'PUBLIC_HUB_BLOCK',p_block_id,jsonb_build_object('status',p_status));
end;
$function$;

create or replace function public.reorder_public_hub_blocks_controlled(
  p_operation_key text,
  p_ordered_ids uuid[]
) returns void
language plpgsql
security definer
set search_path=''
as $function$
declare
  v_actor uuid := auth.uid();
  v_expected integer;
  v_received integer;
begin
  if v_actor is null then raise exception using errcode='42501',message='LIHEN_AUTH_REQUIRED'; end if;
  if not exists(select 1 from public.profiles p where p.id=v_actor and p.authorization_status='ACTIVE' and p.role_code in ('OWNER','ADMIN')) then
    raise exception using errcode='42501',message='LIHEN_PUBLIC_HUB_WRITE_FORBIDDEN';
  end if;
  if exists(select 1 from public.operational_audit_log a where a.module='PUBLIC_HUB' and a.operation_key=p_operation_key) then return; end if;
  v_received := coalesce(array_length(p_ordered_ids,1),0);
  if v_received < 1 then raise exception using errcode='22023',message='LIHEN_PUBLIC_HUB_ORDER_REQUIRED'; end if;
  if (select count(distinct x) from unnest(p_ordered_ids) x) <> v_received then raise exception using errcode='22023',message='LIHEN_PUBLIC_HUB_ORDER_DUPLICATE'; end if;
  select count(*) into v_expected from lihen_private.public_hub_blocks b where b.status <> 'ARCHIVED';
  if v_expected <> v_received then raise exception using errcode='22023',message='LIHEN_PUBLIC_HUB_ORDER_INCOMPLETE'; end if;
  if exists(select 1 from unnest(p_ordered_ids) x where not exists(select 1 from lihen_private.public_hub_blocks b where b.id=x and b.status <> 'ARCHIVED')) then
    raise exception using errcode='22023',message='LIHEN_PUBLIC_HUB_ORDER_UNKNOWN_BLOCK';
  end if;

  update lihen_private.public_hub_blocks b
  set sort_order=o.ordinality*10,updated_by=v_actor,updated_at=now()
  from unnest(p_ordered_ids) with ordinality o(id,ordinality)
  where b.id=o.id;

  insert into public.operational_audit_log(module,operation_type,operation_key,actor_id,entity_type,entity_id,metadata)
  values('PUBLIC_HUB','REORDER',p_operation_key,v_actor,'PUBLIC_HUB',null,jsonb_build_object('ordered_ids',to_jsonb(p_ordered_ids)));
end;
$function$;

create or replace function public.get_public_hub_controlled()
returns table(
  block_id uuid,
  block_type text,
  sort_order integer,
  title text,
  subtitle text,
  body text,
  cta_label text,
  target_url text,
  image_url text,
  product_id uuid,
  product_slug text,
  product_name text,
  product_brand text,
  product_sale_price numeric,
  product_availability text,
  collection_key text
)
language plpgsql
security definer
set search_path=''
as $function$
begin
  if not exists(select 1 from lihen_private.phase_exit_gate_results g where g.phase_code='4' and g.status='PASS') then
    raise exception using errcode='55000',message='LIHEN_PHASE4_NOT_CLOSED';
  end if;

  return query
  select
    b.id,
    b.block_type,
    b.sort_order,
    coalesce(b.title,case when b.block_type='PRODUCT' then p.name else null end),
    coalesce(b.subtitle,case when b.block_type='PRODUCT' then coalesce(br.name,p.brand) else null end),
    b.body,
    coalesce(b.cta_label,case when b.block_type='PRODUCT' then 'Ver producto' when b.block_type='PRODUCT_COLLECTION' then 'Descubrir productos' else null end),
    case
      when b.block_type='PRODUCT' then '#producto/'||coalesce(p.slug,p.id::text)
      when b.block_type='PRODUCT_COLLECTION' then '#catalogo?collection='||b.collection_key
      else b.target_url
    end,
    case when b.block_type='PRODUCT' then card.public_url else b.image_url end,
    p.id,
    p.slug,
    p.name,
    coalesce(br.name,p.brand),
    p.sale_price,
    case when p.id is null then null
      when coalesce(s.stock_available,0)>5 then 'AVAILABLE'
      when coalesce(s.stock_available,0)>0 then 'LOW_STOCK'
      when coalesce(s.stock_pending,0)>0 then 'COMING_SOON'
      else 'OUT_OF_STOCK' end,
    b.collection_key
  from lihen_private.public_hub_blocks b
  left join public.products p
    on b.block_type='PRODUCT' and p.id=b.product_id and p.status='ACTIVE' and p.visible_on_website=true and p.sale_price is not null and p.sale_price>=0
  left join public.brands br on br.id=p.brand_id
  left join public.inventory_stock s on s.product_id=p.id
  left join lateral (
    select pi.public_url
    from public.product_images pi
    join lihen_private.product_image_storage_assets a on a.product_image_id=pi.id and a.status='ACTIVE' and a.rendition_profile='WEB_CARD'
    where pi.product_id=p.id and pi.status='ACTIVE' and pi.derivative_profile='WEB_CARD' and btrim(pi.public_url)<>'' and a.width_px>0 and a.height_px>0
    order by pi.is_main desc,pi.sort_order asc,pi.created_at asc,pi.id asc limit 1
  ) card on true
  where b.status='PUBLISHED'
    and b.archived_at is null
    and (b.starts_at is null or b.starts_at<=now())
    and (b.ends_at is null or b.ends_at>now())
    and (b.block_type<>'PRODUCT' or (p.id is not null and card.public_url is not null))
  order by b.sort_order,b.created_at,b.id;
end;
$function$;

revoke all on function public.get_public_hub_blocks_admin_controlled() from public,anon;
revoke all on function public.save_public_hub_block_controlled(text,uuid,text,text,integer,uuid,text,text,text,text,text,text,text,timestamptz,timestamptz) from public,anon;
revoke all on function public.set_public_hub_block_status_controlled(text,uuid,text) from public,anon;
revoke all on function public.reorder_public_hub_blocks_controlled(text,uuid[]) from public,anon;
revoke all on function public.get_public_hub_controlled() from public;

grant execute on function public.get_public_hub_blocks_admin_controlled() to authenticated;
grant execute on function public.save_public_hub_block_controlled(text,uuid,text,text,integer,uuid,text,text,text,text,text,text,text,timestamptz,timestamptz) to authenticated;
grant execute on function public.set_public_hub_block_status_controlled(text,uuid,text) to authenticated;
grant execute on function public.reorder_public_hub_blocks_controlled(text,uuid[]) to authenticated;
grant execute on function public.get_public_hub_controlled() to anon,authenticated;

comment on table lihen_private.public_hub_blocks is 'FASE 5 Public Hub administrative block store. References canonical products; no Product Master duplication.';
comment on function public.get_public_hub_controlled() is 'Read-only public LIHEN Hub projection. Returns only published, currently effective blocks and canonical product data.';
