-- FASE 3 — Fundación CRM canónica requerida por la reconciliación de clientes.
-- Repo-sync de la migración ya aplicada en DEV.

create table if not exists public.customers (
  id uuid primary key,
  full_name text not null check (length(btrim(full_name))>0),
  whatsapp text,
  email text,
  document_number text,
  notes text,
  status text not null default 'ACTIVE' check (status in ('ACTIVE','INACTIVE')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.customers enable row level security;

drop policy if exists customers_active_admin_select on public.customers;
create policy customers_active_admin_select on public.customers for select to authenticated
using (exists(select 1 from public.profiles p where p.id=auth.uid() and p.authorization_status='ACTIVE' and p.role_code in ('OWNER','ADMIN')));

alter table public.orders add column if not exists customer_id uuid;
do $$ begin
  if not exists(select 1 from pg_constraint where conname='orders_customer_id_fkey' and conrelid='public.orders'::regclass) then
    alter table public.orders add constraint orders_customer_id_fkey foreign key(customer_id) references public.customers(id);
  end if;
end $$;
create index if not exists orders_customer_id_idx on public.orders(customer_id);

alter table lihen_private.cutover_items drop constraint if exists cutover_items_domain_check;
alter table lihen_private.cutover_items add constraint cutover_items_domain_check
check (domain in ('PRODUCT','INVENTORY','SUPPLIER','PURCHASE','ORDER','SALE','FINANCE','CUSTOMER'));

create table if not exists lihen_private.customer_write_operations (
  operation_key text primary key check(length(btrim(operation_key))>0),
  operation_type text not null check(operation_type in ('CREATE_CUSTOMER','ASSIGN_ORDER_CUSTOMER')),
  actor_id uuid not null,
  customer_id uuid not null,
  order_id uuid,
  request_fingerprint text not null,
  result_snapshot jsonb not null,
  created_at timestamptz not null default now()
);
alter table lihen_private.customer_write_operations enable row level security;
revoke all on lihen_private.customer_write_operations from anon,authenticated;

create or replace function public.create_customer_controlled(
  p_operation_key text,p_customer_id uuid,p_full_name text,p_whatsapp text,p_email text,p_document_number text,p_notes text,p_status text
) returns table(id uuid,full_name text,whatsapp text,email text,document_number text,notes text,status text)
language plpgsql security definer set search_path=''
as $function$
declare v_actor_id uuid:=auth.uid(); v_fingerprint text; v_existing lihen_private.customer_write_operations%rowtype;
begin
  if v_actor_id is null then raise exception using errcode='42501',message='LIHEN_AUTH_REQUIRED'; end if;
  if not exists(select 1 from public.profiles p where p.id=v_actor_id and p.authorization_status='ACTIVE' and p.role_code in ('OWNER','ADMIN')) then raise exception using errcode='42501',message='LIHEN_CUSTOMER_CREATE_FORBIDDEN'; end if;
  if p_operation_key is null or length(btrim(p_operation_key))=0 then raise exception using errcode='22023',message='LIHEN_OPERATION_KEY_REQUIRED'; end if;
  if p_customer_id is null then raise exception using errcode='22023',message='LIHEN_CUSTOMER_ID_REQUIRED'; end if;
  if p_full_name is null or length(btrim(p_full_name))=0 then raise exception using errcode='22023',message='LIHEN_CUSTOMER_NAME_REQUIRED'; end if;
  if p_status not in ('ACTIVE','INACTIVE') then raise exception using errcode='22023',message='LIHEN_CUSTOMER_STATUS_INVALID'; end if;
  v_fingerprint:=md5(concat_ws('|',p_customer_id::text,btrim(p_full_name),coalesce(nullif(btrim(p_whatsapp),''),'<NULL>'),coalesce(nullif(btrim(p_email),''),'<NULL>'),coalesce(nullif(btrim(p_document_number),''),'<NULL>'),coalesce(nullif(btrim(p_notes),''),'<NULL>'),p_status));
  select o.* into v_existing from lihen_private.customer_write_operations o where o.operation_key=btrim(p_operation_key);
  if found then
    if v_existing.operation_type<>'CREATE_CUSTOMER' or v_existing.actor_id<>v_actor_id or v_existing.customer_id<>p_customer_id or v_existing.request_fingerprint is distinct from v_fingerprint then raise exception using errcode='23505',message='LIHEN_CUSTOMER_WRITE_OPERATION_CONFLICT'; end if;
    return query select c.id,c.full_name,c.whatsapp,c.email,c.document_number,c.notes,c.status from public.customers c where c.id=p_customer_id; return;
  end if;
  if exists(select 1 from public.customers c where c.id=p_customer_id) then raise exception using errcode='23505',message='LIHEN_CUSTOMER_ALREADY_EXISTS'; end if;
  insert into public.customers(id,full_name,whatsapp,email,document_number,notes,status) values(p_customer_id,btrim(p_full_name),nullif(btrim(coalesce(p_whatsapp,'')),''),nullif(btrim(coalesce(p_email,'')),''),nullif(btrim(coalesce(p_document_number,'')),''),nullif(btrim(coalesce(p_notes,'')),''),p_status);
  insert into lihen_private.customer_write_operations(operation_key,operation_type,actor_id,customer_id,order_id,request_fingerprint,result_snapshot) values(btrim(p_operation_key),'CREATE_CUSTOMER',v_actor_id,p_customer_id,null,v_fingerprint,jsonb_build_object('id',p_customer_id,'full_name',btrim(p_full_name),'status',p_status));
  return query select c.id,c.full_name,c.whatsapp,c.email,c.document_number,c.notes,c.status from public.customers c where c.id=p_customer_id;
end;$function$;

create or replace function public.assign_order_customer_controlled(p_operation_key text,p_order_id uuid,p_customer_id uuid)
returns table(order_id uuid,customer_id uuid,customer_name text,customer_phone text)
language plpgsql security definer set search_path=''
as $function$
declare v_actor_id uuid:=auth.uid(); v_fingerprint text; v_existing lihen_private.customer_write_operations%rowtype; v_customer public.customers%rowtype;
begin
  if v_actor_id is null then raise exception using errcode='42501',message='LIHEN_AUTH_REQUIRED'; end if;
  if not exists(select 1 from public.profiles p where p.id=v_actor_id and p.authorization_status='ACTIVE' and p.role_code in ('OWNER','ADMIN')) then raise exception using errcode='42501',message='LIHEN_ORDER_CUSTOMER_ASSIGN_FORBIDDEN'; end if;
  if p_operation_key is null or length(btrim(p_operation_key))=0 then raise exception using errcode='22023',message='LIHEN_OPERATION_KEY_REQUIRED'; end if;
  if p_order_id is null or not exists(select 1 from public.orders o where o.id=p_order_id) then raise exception using errcode='23503',message='LIHEN_ORDER_NOT_FOUND'; end if;
  select c.* into v_customer from public.customers c where c.id=p_customer_id and c.status='ACTIVE'; if not found then raise exception using errcode='23503',message='LIHEN_ACTIVE_CUSTOMER_REQUIRED'; end if;
  v_fingerprint:=md5(concat_ws('|',p_order_id::text,p_customer_id::text));
  select o.* into v_existing from lihen_private.customer_write_operations o where o.operation_key=btrim(p_operation_key);
  if found then
    if v_existing.operation_type<>'ASSIGN_ORDER_CUSTOMER' or v_existing.actor_id<>v_actor_id or v_existing.customer_id<>p_customer_id or v_existing.order_id<>p_order_id or v_existing.request_fingerprint is distinct from v_fingerprint then raise exception using errcode='23505',message='LIHEN_CUSTOMER_WRITE_OPERATION_CONFLICT'; end if;
    return query select o.id,o.customer_id,o.customer_name,o.customer_phone from public.orders o where o.id=p_order_id; return;
  end if;
  update public.orders o set customer_id=p_customer_id,customer_name=v_customer.full_name,customer_phone=v_customer.whatsapp,updated_at=now() where o.id=p_order_id;
  insert into lihen_private.customer_write_operations(operation_key,operation_type,actor_id,customer_id,order_id,request_fingerprint,result_snapshot) values(btrim(p_operation_key),'ASSIGN_ORDER_CUSTOMER',v_actor_id,p_customer_id,p_order_id,v_fingerprint,jsonb_build_object('order_id',p_order_id,'customer_id',p_customer_id));
  return query select o.id,o.customer_id,o.customer_name,o.customer_phone from public.orders o where o.id=p_order_id;
end;$function$;
revoke all on function public.create_customer_controlled(text,uuid,text,text,text,text,text,text) from public,anon;
revoke all on function public.assign_order_customer_controlled(text,uuid,uuid) from public,anon;
grant execute on function public.create_customer_controlled(text,uuid,text,text,text,text,text,text) to authenticated;
grant execute on function public.assign_order_customer_controlled(text,uuid,uuid) to authenticated;
