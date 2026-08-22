-- FASE 2.5C: confirmación y recepción controlada de compras.
-- Regla: confirmar crea PENDING_IN; recibir reduce PENDING_IN y aumenta ON_HAND.
-- No toca caja. Los pagos quedan para FASE 2.8.

create table if not exists public.product_cost_history (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products(id) on delete restrict,
  purchase_id uuid references public.purchases(id) on delete restrict,
  purchase_item_id uuid references public.purchase_items(id) on delete restrict,
  supplier_id uuid references public.suppliers(id) on delete restrict,
  unit_cost numeric(14,2) not null check (unit_cost >= 0),
  currency text not null default 'COP' check (currency = 'COP'),
  source text not null check (source in ('PURCHASE_RECEIPT','LEGACY_RECONCILIATION','MANUAL_REVIEW')),
  effective_at timestamptz not null,
  recorded_at timestamptz not null default now(),
  notes text null
);

create unique index if not exists product_cost_history_purchase_item_effective_unique
  on public.product_cost_history(purchase_item_id, effective_at)
  where purchase_item_id is not null;

alter table public.product_cost_history enable row level security;
revoke all on table public.product_cost_history from anon, authenticated;
grant select on table public.product_cost_history to authenticated;

drop policy if exists product_cost_history_admin_read on public.product_cost_history;
create policy product_cost_history_admin_read
on public.product_cost_history
for select
to authenticated
using (
  exists (
    select 1 from public.profiles p
    where p.id = (select auth.uid())
      and p.authorization_status = 'ACTIVE'
      and p.role_code in ('OWNER','ADMIN')
  )
);

create or replace function public.confirm_purchase_controlled(
  p_operation_key text,
  p_purchase_id uuid,
  p_occurred_at timestamptz default now()
)
returns table(
  id uuid,
  purchase_number text,
  status text,
  pending_units bigint
)
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_actor_id uuid := auth.uid();
  v_fingerprint text;
  v_existing lihen_private.purchase_write_operations%rowtype;
  v_purchase public.purchases%rowtype;
  v_pending bigint := 0;
  v_item public.purchase_items%rowtype;
begin
  if v_actor_id is null then raise exception using errcode='42501',message='LIHEN_AUTH_REQUIRED'; end if;
  if not exists(select 1 from public.profiles p where p.id=v_actor_id and p.authorization_status='ACTIVE' and p.role_code in('OWNER','ADMIN')) then
    raise exception using errcode='42501',message='LIHEN_PURCHASE_CONFIRM_FORBIDDEN';
  end if;
  if p_operation_key is null or length(btrim(p_operation_key))=0 then raise exception using errcode='22023',message='LIHEN_OPERATION_KEY_REQUIRED'; end if;
  if p_purchase_id is null then raise exception using errcode='22023',message='LIHEN_PURCHASE_ID_REQUIRED'; end if;
  if p_occurred_at is null then raise exception using errcode='22023',message='LIHEN_OCCURRED_AT_REQUIRED'; end if;

  v_fingerprint := md5(concat_ws('|',p_purchase_id::text,p_occurred_at::text));
  select o.* into v_existing from lihen_private.purchase_write_operations o where o.operation_key=btrim(p_operation_key);
  if found then
    if v_existing.operation_type<>'CONFIRM_PURCHASE' or v_existing.actor_id<>v_actor_id or v_existing.purchase_id<>p_purchase_id or v_existing.request_fingerprint is distinct from v_fingerprint or v_existing.result_snapshot is null then
      raise exception using errcode='23505',message='LIHEN_PURCHASE_WRITE_OPERATION_CONFLICT';
    end if;
    return query select
      (v_existing.result_snapshot->>'id')::uuid,
      v_existing.result_snapshot->>'purchase_number',
      v_existing.result_snapshot->>'status',
      (v_existing.result_snapshot->>'pending_units')::bigint;
    return;
  end if;

  select * into v_purchase from public.purchases where purchases.id=p_purchase_id for update;
  if not found then raise exception using errcode='P0002',message='LIHEN_PURCHASE_NOT_FOUND'; end if;
  if v_purchase.status <> 'DRAFT' then raise exception using errcode='22023',message='LIHEN_PURCHASE_CONFIRM_REQUIRES_DRAFT'; end if;
  if not exists(select 1 from public.purchase_items i where i.purchase_id=p_purchase_id) then raise exception using errcode='22023',message='LIHEN_PURCHASE_ITEMS_REQUIRED'; end if;

  for v_item in select * from public.purchase_items i where i.purchase_id=p_purchase_id order by i.id loop
    insert into public.inventory_movements(id,product_id,bucket,quantity_delta,reason,occurred_at,external_reference,notes)
    values(gen_random_uuid(),v_item.product_id,'PENDING_IN',v_item.quantity_requested,'PURCHASE_CONFIRMED',p_occurred_at,v_purchase.purchase_number,'Compra confirmada; unidades pendientes de recepción.');
    v_pending := v_pending + v_item.quantity_requested;
  end loop;

  update public.purchases set status='CONFIRMED', updated_at=now() where purchases.id=p_purchase_id returning * into v_purchase;

  insert into lihen_private.purchase_write_operations(operation_key,operation_type,actor_id,purchase_id,request_fingerprint,result_snapshot)
  values(btrim(p_operation_key),'CONFIRM_PURCHASE',v_actor_id,p_purchase_id,v_fingerprint,
    jsonb_build_object('id',v_purchase.id,'purchase_number',v_purchase.purchase_number,'status',v_purchase.status,'pending_units',v_pending));

  return query select v_purchase.id,v_purchase.purchase_number,v_purchase.status,v_pending;
end;
$function$;

create or replace function public.receive_purchase_controlled(
  p_operation_key text,
  p_purchase_id uuid,
  p_received_at timestamptz,
  p_lines jsonb,
  p_notes text default null
)
returns table(
  id uuid,
  purchase_number text,
  status text,
  received_units bigint,
  remaining_units bigint
)
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_actor_id uuid := auth.uid();
  v_fingerprint text;
  v_existing lihen_private.purchase_write_operations%rowtype;
  v_purchase public.purchases%rowtype;
  v_line jsonb;
  v_item public.purchase_items%rowtype;
  v_qty integer;
  v_cost numeric;
  v_received bigint := 0;
  v_remaining bigint := 0;
  v_new_status text;
begin
  if v_actor_id is null then raise exception using errcode='42501',message='LIHEN_AUTH_REQUIRED'; end if;
  if not exists(select 1 from public.profiles p where p.id=v_actor_id and p.authorization_status='ACTIVE' and p.role_code in('OWNER','ADMIN')) then
    raise exception using errcode='42501',message='LIHEN_PURCHASE_RECEIVE_FORBIDDEN';
  end if;
  if p_operation_key is null or length(btrim(p_operation_key))=0 then raise exception using errcode='22023',message='LIHEN_OPERATION_KEY_REQUIRED'; end if;
  if p_purchase_id is null then raise exception using errcode='22023',message='LIHEN_PURCHASE_ID_REQUIRED'; end if;
  if p_received_at is null then raise exception using errcode='22023',message='LIHEN_RECEIVED_AT_REQUIRED'; end if;
  if p_lines is null or jsonb_typeof(p_lines)<>'array' or jsonb_array_length(p_lines)=0 then raise exception using errcode='22023',message='LIHEN_PURCHASE_RECEIPT_LINES_REQUIRED'; end if;

  v_fingerprint := md5(concat_ws('|',p_purchase_id::text,p_received_at::text,p_lines::text,coalesce(p_notes,'')));
  select o.* into v_existing from lihen_private.purchase_write_operations o where o.operation_key=btrim(p_operation_key);
  if found then
    if v_existing.operation_type<>'RECEIVE_PURCHASE' or v_existing.actor_id<>v_actor_id or v_existing.purchase_id<>p_purchase_id or v_existing.request_fingerprint is distinct from v_fingerprint or v_existing.result_snapshot is null then
      raise exception using errcode='23505',message='LIHEN_PURCHASE_WRITE_OPERATION_CONFLICT';
    end if;
    return query select
      (v_existing.result_snapshot->>'id')::uuid,
      v_existing.result_snapshot->>'purchase_number',
      v_existing.result_snapshot->>'status',
      (v_existing.result_snapshot->>'received_units')::bigint,
      (v_existing.result_snapshot->>'remaining_units')::bigint;
    return;
  end if;

  select * into v_purchase from public.purchases where purchases.id=p_purchase_id for update;
  if not found then raise exception using errcode='P0002',message='LIHEN_PURCHASE_NOT_FOUND'; end if;
  if v_purchase.status not in ('CONFIRMED','PARTIALLY_RECEIVED') then raise exception using errcode='22023',message='LIHEN_PURCHASE_RECEIVE_REQUIRES_CONFIRMED'; end if;

  for v_line in select value from jsonb_array_elements(p_lines) loop
    if (v_line ? 'purchase_item_id') is false or (v_line ? 'quantity_received') is false or (v_line ? 'final_unit_cost') is false then
      raise exception using errcode='22023',message='LIHEN_PURCHASE_RECEIPT_LINE_INVALID';
    end if;
    v_qty := (v_line->>'quantity_received')::integer;
    v_cost := (v_line->>'final_unit_cost')::numeric;
    if v_qty <= 0 then raise exception using errcode='22023',message='LIHEN_RECEIVED_QUANTITY_MUST_BE_POSITIVE'; end if;
    if v_cost < 0 then raise exception using errcode='22023',message='LIHEN_FINAL_UNIT_COST_INVALID'; end if;

    select * into v_item from public.purchase_items i where i.id=(v_line->>'purchase_item_id')::uuid and i.purchase_id=p_purchase_id for update;
    if not found then raise exception using errcode='P0002',message='LIHEN_PURCHASE_ITEM_NOT_FOUND'; end if;
    if v_item.quantity_received + v_qty > v_item.quantity_requested then raise exception using errcode='22023',message='LIHEN_PURCHASE_OVER_RECEIPT'; end if;

    update public.purchase_items
      set quantity_received=quantity_received+v_qty, final_unit_cost=v_cost, updated_at=now()
      where purchase_items.id=v_item.id;

    insert into public.inventory_movements(id,product_id,bucket,quantity_delta,reason,occurred_at,external_reference,notes)
    values(gen_random_uuid(),v_item.product_id,'PENDING_IN',-v_qty,'PURCHASE_RECEIVED',p_received_at,v_purchase.purchase_number,'Recepción: salida de pendiente.');
    insert into public.inventory_movements(id,product_id,bucket,quantity_delta,reason,occurred_at,external_reference,notes)
    values(gen_random_uuid(),v_item.product_id,'ON_HAND',v_qty,'PURCHASE_RECEIVED',p_received_at,v_purchase.purchase_number,'Recepción: entrada física.');

    insert into public.product_cost_history(id,product_id,purchase_id,purchase_item_id,supplier_id,unit_cost,currency,source,effective_at,notes)
    values(gen_random_uuid(),v_item.product_id,p_purchase_id,v_item.id,v_purchase.supplier_id,v_cost,'COP','PURCHASE_RECEIPT',p_received_at,p_notes);

    v_received := v_received + v_qty;
  end loop;

  select coalesce(sum(quantity_requested-quantity_received),0) into v_remaining from public.purchase_items where purchase_id=p_purchase_id;
  v_new_status := case when v_remaining=0 then 'RECEIVED' else 'PARTIALLY_RECEIVED' end;
  update public.purchases set status=v_new_status, received_at=case when v_new_status='RECEIVED' then p_received_at else received_at end, updated_at=now() where purchases.id=p_purchase_id returning * into v_purchase;

  insert into lihen_private.purchase_write_operations(operation_key,operation_type,actor_id,purchase_id,request_fingerprint,result_snapshot)
  values(btrim(p_operation_key),'RECEIVE_PURCHASE',v_actor_id,p_purchase_id,v_fingerprint,
    jsonb_build_object('id',v_purchase.id,'purchase_number',v_purchase.purchase_number,'status',v_purchase.status,'received_units',v_received,'remaining_units',v_remaining));

  return query select v_purchase.id,v_purchase.purchase_number,v_purchase.status,v_received,v_remaining;
end;
$function$;

revoke all on function public.confirm_purchase_controlled(text,uuid,timestamptz) from public, anon;
revoke all on function public.receive_purchase_controlled(text,uuid,timestamptz,jsonb,text) from public, anon;
grant execute on function public.confirm_purchase_controlled(text,uuid,timestamptz) to authenticated;
grant execute on function public.receive_purchase_controlled(text,uuid,timestamptz,jsonb,text) to authenticated;
