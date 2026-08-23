-- FASE 3 — Términos comerciales canónicos de pedido requeridos por el cutover.
-- Repo-sync de la migración ya aplicada en DEV.

alter table public.orders add column if not exists subtotal numeric not null default 0;
alter table public.orders add column if not exists discount_type text not null default 'NONE';
alter table public.orders add column if not exists discount_value numeric not null default 0;
alter table public.orders add column if not exists discount_amount numeric not null default 0;
alter table public.orders add column if not exists delivery_cost numeric not null default 0;
alter table public.orders add column if not exists total numeric not null default 0;
alter table public.orders add column if not exists payment_status text not null default 'PENDING';

alter table public.orders drop constraint if exists orders_commercial_nonnegative_check;
alter table public.orders add constraint orders_commercial_nonnegative_check check (subtotal>=0 and discount_value>=0 and discount_amount>=0 and delivery_cost>=0 and total>=0);
alter table public.orders drop constraint if exists orders_discount_amount_not_over_subtotal_check;
alter table public.orders add constraint orders_discount_amount_not_over_subtotal_check check (discount_amount<=subtotal);
alter table public.orders drop constraint if exists orders_discount_type_check;
alter table public.orders add constraint orders_discount_type_check check (discount_type in ('NONE','FIXED','PERCENTAGE'));
alter table public.orders drop constraint if exists orders_payment_status_check;
alter table public.orders add constraint orders_payment_status_check check (payment_status in ('PENDING','PARTIAL','PAID','VOID'));

create table if not exists lihen_private.order_commercial_term_operations (
  operation_key text primary key check (length(btrim(operation_key))>0),
  actor_id uuid not null,
  order_id uuid not null references public.orders(id),
  request_fingerprint text not null,
  result_snapshot jsonb not null,
  created_at timestamptz not null default now()
);
alter table lihen_private.order_commercial_term_operations enable row level security;
revoke all on lihen_private.order_commercial_term_operations from anon, authenticated;

create or replace function public.set_order_commercial_terms_controlled(
  p_operation_key text,p_order_id uuid,p_subtotal numeric,p_discount_type text,p_discount_value numeric,
  p_discount_amount numeric,p_delivery_cost numeric,p_total numeric,p_payment_status text
) returns table(id uuid,subtotal numeric,discount_type text,discount_value numeric,discount_amount numeric,delivery_cost numeric,total numeric,payment_status text)
language plpgsql security definer set search_path=''
as $function$
declare
  v_actor_id uuid:=auth.uid(); v_item_subtotal numeric; v_expected_total numeric; v_fingerprint text; v_existing lihen_private.order_commercial_term_operations%rowtype;
begin
  if v_actor_id is null then raise exception using errcode='42501',message='LIHEN_AUTH_REQUIRED'; end if;
  if not exists(select 1 from public.profiles p where p.id=v_actor_id and p.authorization_status='ACTIVE' and p.role_code in ('OWNER','ADMIN')) then raise exception using errcode='42501',message='LIHEN_ORDER_COMMERCIAL_TERMS_FORBIDDEN'; end if;
  if p_operation_key is null or length(btrim(p_operation_key))=0 then raise exception using errcode='22023',message='LIHEN_OPERATION_KEY_REQUIRED'; end if;
  if p_order_id is null or not exists(select 1 from public.orders o where o.id=p_order_id) then raise exception using errcode='23503',message='LIHEN_ORDER_NOT_FOUND'; end if;
  if p_subtotal is null or p_subtotal<0 or p_discount_value is null or p_discount_value<0 or p_discount_amount is null or p_discount_amount<0 or p_delivery_cost is null or p_delivery_cost<0 or p_total is null or p_total<0 then raise exception using errcode='22023',message='LIHEN_ORDER_COMMERCIAL_VALUE_INVALID'; end if;
  if p_discount_type not in ('NONE','FIXED','PERCENTAGE') then raise exception using errcode='22023',message='LIHEN_ORDER_DISCOUNT_TYPE_INVALID'; end if;
  if p_payment_status not in ('PENDING','PARTIAL','PAID','VOID') then raise exception using errcode='22023',message='LIHEN_ORDER_PAYMENT_STATUS_INVALID'; end if;
  if p_discount_amount>p_subtotal then raise exception using errcode='22023',message='LIHEN_ORDER_DISCOUNT_EXCEEDS_SUBTOTAL'; end if;
  select coalesce(sum(oi.quantity*oi.unit_price),0) into v_item_subtotal from public.order_items oi where oi.order_id=p_order_id;
  if v_item_subtotal<>p_subtotal then raise exception using errcode='23514',message='LIHEN_ORDER_SUBTOTAL_ITEM_MISMATCH'; end if;
  v_expected_total:=p_subtotal-p_discount_amount+p_delivery_cost;
  if v_expected_total<>p_total then raise exception using errcode='23514',message='LIHEN_ORDER_TOTAL_FORMULA_MISMATCH'; end if;
  if p_discount_type='NONE' and (p_discount_value<>0 or p_discount_amount<>0) then raise exception using errcode='23514',message='LIHEN_ORDER_NONE_DISCOUNT_MISMATCH'; end if;
  if p_discount_type='FIXED' and p_discount_value<>p_discount_amount then raise exception using errcode='23514',message='LIHEN_ORDER_FIXED_DISCOUNT_MISMATCH'; end if;
  if p_discount_type='PERCENTAGE' and round((p_subtotal*p_discount_value/100.0)::numeric,2)<>p_discount_amount then raise exception using errcode='23514',message='LIHEN_ORDER_PERCENTAGE_DISCOUNT_MISMATCH'; end if;
  v_fingerprint:=md5(concat_ws('|',p_order_id::text,p_subtotal::text,p_discount_type,p_discount_value::text,p_discount_amount::text,p_delivery_cost::text,p_total::text,p_payment_status));
  select x.* into v_existing from lihen_private.order_commercial_term_operations x where x.operation_key=btrim(p_operation_key);
  if found then
    if v_existing.actor_id<>v_actor_id or v_existing.order_id<>p_order_id or v_existing.request_fingerprint is distinct from v_fingerprint then raise exception using errcode='23505',message='LIHEN_ORDER_COMMERCIAL_TERMS_OPERATION_CONFLICT'; end if;
    return query select o.id,o.subtotal,o.discount_type,o.discount_value,o.discount_amount,o.delivery_cost,o.total,o.payment_status from public.orders o where o.id=p_order_id; return;
  end if;
  update public.orders o set subtotal=p_subtotal,discount_type=p_discount_type,discount_value=p_discount_value,discount_amount=p_discount_amount,delivery_cost=p_delivery_cost,total=p_total,payment_status=p_payment_status,updated_at=now() where o.id=p_order_id;
  insert into lihen_private.order_commercial_term_operations(operation_key,actor_id,order_id,request_fingerprint,result_snapshot) values(btrim(p_operation_key),v_actor_id,p_order_id,v_fingerprint,jsonb_build_object('id',p_order_id,'subtotal',p_subtotal,'discount_type',p_discount_type,'discount_value',p_discount_value,'discount_amount',p_discount_amount,'delivery_cost',p_delivery_cost,'total',p_total,'payment_status',p_payment_status));
  return query select o.id,o.subtotal,o.discount_type,o.discount_value,o.discount_amount,o.delivery_cost,o.total,o.payment_status from public.orders o where o.id=p_order_id;
end;$function$;
revoke all on function public.set_order_commercial_terms_controlled(text,uuid,numeric,text,numeric,numeric,numeric,numeric,text) from public,anon;
grant execute on function public.set_order_commercial_terms_controlled(text,uuid,numeric,text,numeric,numeric,numeric,numeric,text) to authenticated;
