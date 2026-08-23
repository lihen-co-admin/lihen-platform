-- FASE 2.6A: pedidos en borrador. Un DRAFT no reserva inventario ni mueve caja.
create table if not exists public.orders (
  id uuid primary key default gen_random_uuid(),
  order_number text not null unique check (length(btrim(order_number)) > 0),
  status text not null default 'DRAFT' check (status in ('DRAFT','CONFIRMED','PREPARING','READY','COMPLETED','CANCELLED')),
  channel text not null default 'OTHER' check (channel in ('WHATSAPP','INSTAGRAM','FACEBOOK','TIKTOK','WEB','IN_PERSON','OTHER')),
  customer_name text null,
  customer_phone text null,
  notes text null,
  requested_at timestamptz null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create table if not exists public.order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete restrict,
  product_id uuid not null references public.products(id) on delete restrict,
  quantity integer not null check (quantity > 0),
  unit_price numeric(14,2) not null check (unit_price >= 0),
  notes text null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(order_id, product_id)
);
create table if not exists lihen_private.order_write_operations (
  operation_key text primary key,
  operation_type text not null,
  actor_id uuid not null,
  order_id uuid not null,
  request_fingerprint text not null,
  result_snapshot jsonb null,
  created_at timestamptz not null default now()
);

alter table public.orders enable row level security;
alter table public.order_items enable row level security;
revoke all on table public.orders, public.order_items from anon, authenticated;
grant select on table public.orders, public.order_items to authenticated;

drop policy if exists orders_admin_read on public.orders;
create policy orders_admin_read on public.orders for select to authenticated using (
  exists(select 1 from public.profiles p where p.id=(select auth.uid()) and p.authorization_status='ACTIVE' and p.role_code in ('OWNER','ADMIN'))
);
drop policy if exists order_items_admin_read on public.order_items;
create policy order_items_admin_read on public.order_items for select to authenticated using (
  exists(select 1 from public.profiles p where p.id=(select auth.uid()) and p.authorization_status='ACTIVE' and p.role_code in ('OWNER','ADMIN'))
);

create or replace function public.create_order_draft_controlled(
  p_operation_key text,
  p_order_id uuid,
  p_order_number text,
  p_channel text,
  p_customer_name text,
  p_customer_phone text,
  p_notes text,
  p_requested_at timestamptz,
  p_items jsonb
)
returns table(id uuid,order_number text,status text,channel text,item_count integer)
language plpgsql security definer set search_path=''
as $function$
declare
  v_actor_id uuid:=auth.uid(); v_fingerprint text; v_existing lihen_private.order_write_operations%rowtype; v_order public.orders%rowtype; v_item jsonb; v_count integer:=0;
begin
  if v_actor_id is null then raise exception using errcode='42501',message='LIHEN_AUTH_REQUIRED'; end if;
  if not exists(select 1 from public.profiles p where p.id=v_actor_id and p.authorization_status='ACTIVE' and p.role_code in('OWNER','ADMIN')) then raise exception using errcode='42501',message='LIHEN_ORDER_CREATE_FORBIDDEN'; end if;
  if p_operation_key is null or length(btrim(p_operation_key))=0 then raise exception using errcode='22023',message='LIHEN_OPERATION_KEY_REQUIRED'; end if;
  if p_order_id is null then raise exception using errcode='22023',message='LIHEN_ORDER_ID_REQUIRED'; end if;
  if p_order_number is null or length(btrim(p_order_number))=0 then raise exception using errcode='22023',message='LIHEN_ORDER_NUMBER_REQUIRED'; end if;
  if p_channel not in ('WHATSAPP','INSTAGRAM','FACEBOOK','TIKTOK','WEB','IN_PERSON','OTHER') then raise exception using errcode='22023',message='LIHEN_ORDER_CHANNEL_INVALID'; end if;
  if p_items is null or jsonb_typeof(p_items)<>'array' or jsonb_array_length(p_items)=0 then raise exception using errcode='22023',message='LIHEN_ORDER_ITEMS_REQUIRED'; end if;
  v_fingerprint:=md5(concat_ws('|',p_order_id::text,btrim(p_order_number),p_channel,coalesce(p_customer_name,''),coalesce(p_customer_phone,''),coalesce(p_notes,''),coalesce(p_requested_at::text,''),p_items::text));
  select o.* into v_existing from lihen_private.order_write_operations o where o.operation_key=btrim(p_operation_key);
  if found then
    if v_existing.operation_type<>'CREATE_ORDER_DRAFT' or v_existing.actor_id<>v_actor_id or v_existing.order_id<>p_order_id or v_existing.request_fingerprint is distinct from v_fingerprint or v_existing.result_snapshot is null then raise exception using errcode='23505',message='LIHEN_ORDER_WRITE_OPERATION_CONFLICT'; end if;
    return query select (v_existing.result_snapshot->>'id')::uuid,v_existing.result_snapshot->>'order_number',v_existing.result_snapshot->>'status',v_existing.result_snapshot->>'channel',(v_existing.result_snapshot->>'item_count')::integer; return;
  end if;
  insert into public.orders(id,order_number,status,channel,customer_name,customer_phone,notes,requested_at)
  values(p_order_id,btrim(p_order_number),'DRAFT',p_channel,nullif(btrim(coalesce(p_customer_name,'')),''),nullif(btrim(coalesce(p_customer_phone,'')),''),nullif(btrim(coalesce(p_notes,'')),''),p_requested_at)
  returning * into v_order;
  for v_item in select value from jsonb_array_elements(p_items) loop
    if not (v_item ? 'id' and v_item ? 'product_id' and v_item ? 'quantity' and v_item ? 'unit_price') then raise exception using errcode='22023',message='LIHEN_ORDER_ITEM_INVALID'; end if;
    if (v_item->>'quantity')::integer <= 0 or (v_item->>'unit_price')::numeric < 0 then raise exception using errcode='22023',message='LIHEN_ORDER_ITEM_VALUES_INVALID'; end if;
    if not exists(select 1 from public.products p where p.id=(v_item->>'product_id')::uuid) then raise exception using errcode='23503',message='LIHEN_ORDER_PRODUCT_NOT_FOUND'; end if;
    insert into public.order_items(id,order_id,product_id,quantity,unit_price,notes)
    values((v_item->>'id')::uuid,p_order_id,(v_item->>'product_id')::uuid,(v_item->>'quantity')::integer,(v_item->>'unit_price')::numeric,nullif(btrim(coalesce(v_item->>'notes','')),''));
    v_count:=v_count+1;
  end loop;
  insert into lihen_private.order_write_operations(operation_key,operation_type,actor_id,order_id,request_fingerprint,result_snapshot)
  values(btrim(p_operation_key),'CREATE_ORDER_DRAFT',v_actor_id,p_order_id,v_fingerprint,jsonb_build_object('id',v_order.id,'order_number',v_order.order_number,'status',v_order.status,'channel',v_order.channel,'item_count',v_count));
  return query select v_order.id,v_order.order_number,v_order.status,v_order.channel,v_count;
end;$function$;
revoke all on function public.create_order_draft_controlled(text,uuid,text,text,text,text,text,timestamptz,jsonb) from public,anon;
grant execute on function public.create_order_draft_controlled(text,uuid,text,text,text,text,text,timestamptz,jsonb) to authenticated;
