-- FASE 2.4A — Inventory operational foundation (DEV)
-- Exposes read-only inventory to ACTIVE OWNER/ADMIN and one controlled ON_HAND adjustment RPC.
-- RESERVED and PENDING_IN remain owned by future Orders/Procurement flows.

create table if not exists lihen_private.inventory_write_operations (
  operation_key text primary key,
  operation_type text not null check (operation_type in ('ADJUST_ON_HAND')),
  actor_id uuid not null references auth.users(id) on delete restrict,
  product_id uuid not null references public.products(id) on delete restrict,
  movement_id uuid not null references public.inventory_movements(id) on delete restrict,
  request_fingerprint text not null,
  result_snapshot jsonb not null,
  created_at timestamptz not null default now(),
  check (length(btrim(operation_key)) > 0)
);

revoke all on table lihen_private.inventory_write_operations from public, anon, authenticated;
grant select, insert on table lihen_private.inventory_write_operations to service_role;

drop policy if exists inventory_movements_admin_read on public.inventory_movements;
create policy inventory_movements_admin_read
on public.inventory_movements
for select
to authenticated
using (
  exists (
    select 1
    from public.profiles p
    where p.id = (select auth.uid())
      and p.authorization_status = 'ACTIVE'
      and p.role_code in ('OWNER', 'ADMIN')
  )
);

grant select on table public.inventory_movements to authenticated;
grant select on public.inventory_stock to authenticated;

create or replace function public.record_inventory_adjustment_controlled(
  p_operation_key text,
  p_movement_id uuid,
  p_product_id uuid,
  p_quantity_delta integer,
  p_reason text,
  p_occurred_at timestamptz,
  p_notes text default null
)
returns table (
  movement_id uuid,
  product_id uuid,
  bucket text,
  quantity_delta integer,
  reason text,
  occurred_at timestamptz,
  stock_on_hand bigint,
  stock_reserved bigint,
  stock_pending bigint,
  stock_available bigint
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor_id uuid := auth.uid();
  v_fingerprint text;
  v_existing lihen_private.inventory_write_operations%rowtype;
  v_on_hand bigint;
  v_reserved bigint;
  v_pending bigint;
  v_available bigint;
begin
  if v_actor_id is null then
    raise exception using errcode='42501', message='LIHEN_AUTH_REQUIRED';
  end if;

  if not exists (
    select 1 from public.profiles p
    where p.id = v_actor_id
      and p.authorization_status = 'ACTIVE'
      and p.role_code in ('OWNER','ADMIN')
  ) then
    raise exception using errcode='42501', message='LIHEN_INVENTORY_ADJUST_FORBIDDEN';
  end if;

  if p_operation_key is null or length(btrim(p_operation_key)) = 0 then
    raise exception using errcode='22023', message='LIHEN_OPERATION_KEY_REQUIRED';
  end if;
  if p_movement_id is null then
    raise exception using errcode='22023', message='LIHEN_INVENTORY_MOVEMENT_ID_REQUIRED';
  end if;
  if p_product_id is null or not exists(select 1 from public.products p where p.id=p_product_id) then
    raise exception using errcode='P0002', message='LIHEN_PRODUCT_NOT_FOUND';
  end if;
  if p_quantity_delta is null or p_quantity_delta = 0 then
    raise exception using errcode='22023', message='LIHEN_INVENTORY_QUANTITY_DELTA_INVALID';
  end if;
  if p_reason not in (
    'PHYSICAL_COUNT_INCREASE',
    'PHYSICAL_COUNT_DECREASE',
    'DAMAGE_WRITE_OFF',
    'LOSS_WRITE_OFF',
    'RETURN_TO_STOCK',
    'MANUAL_CORRECTION'
  ) then
    raise exception using errcode='22023', message='LIHEN_INVENTORY_ADJUSTMENT_REASON_INVALID';
  end if;
  if p_occurred_at is null or p_occurred_at > now() + interval '5 minutes' then
    raise exception using errcode='22023', message='LIHEN_INVENTORY_OCCURRED_AT_INVALID';
  end if;

  v_fingerprint := md5(concat_ws('|',
    p_movement_id::text,
    p_product_id::text,
    p_quantity_delta::text,
    p_reason,
    p_occurred_at::text,
    coalesce(btrim(p_notes), '<NULL>')
  ));

  select o.* into v_existing
  from lihen_private.inventory_write_operations o
  where o.operation_key = btrim(p_operation_key);

  if found then
    if v_existing.operation_type <> 'ADJUST_ON_HAND'
       or v_existing.actor_id <> v_actor_id
       or v_existing.product_id <> p_product_id
       or v_existing.movement_id <> p_movement_id
       or v_existing.request_fingerprint is distinct from v_fingerprint then
      raise exception using errcode='23505', message='LIHEN_INVENTORY_WRITE_OPERATION_CONFLICT';
    end if;

    return query select
      (v_existing.result_snapshot->>'movement_id')::uuid,
      (v_existing.result_snapshot->>'product_id')::uuid,
      v_existing.result_snapshot->>'bucket',
      (v_existing.result_snapshot->>'quantity_delta')::integer,
      v_existing.result_snapshot->>'reason',
      (v_existing.result_snapshot->>'occurred_at')::timestamptz,
      (v_existing.result_snapshot->>'stock_on_hand')::bigint,
      (v_existing.result_snapshot->>'stock_reserved')::bigint,
      (v_existing.result_snapshot->>'stock_pending')::bigint,
      (v_existing.result_snapshot->>'stock_available')::bigint;
    return;
  end if;

  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_product_id::text, 2404));

  select s.stock_on_hand, s.stock_reserved, s.stock_pending, s.stock_available
    into v_on_hand, v_reserved, v_pending, v_available
  from public.inventory_stock s
  where s.product_id = p_product_id;

  v_on_hand := coalesce(v_on_hand, 0) + p_quantity_delta;
  v_reserved := coalesce(v_reserved, 0);
  v_pending := coalesce(v_pending, 0);
  v_available := v_on_hand - v_reserved;

  if v_on_hand < 0 then
    raise exception using errcode='23514', message='LIHEN_INVENTORY_ON_HAND_NEGATIVE';
  end if;
  if v_available < 0 then
    raise exception using errcode='23514', message='LIHEN_INVENTORY_AVAILABLE_NEGATIVE';
  end if;

  insert into public.inventory_movements(
    id, product_id, bucket, quantity_delta, reason, occurred_at, notes
  ) values (
    p_movement_id, p_product_id, 'ON_HAND', p_quantity_delta, p_reason,
    p_occurred_at, nullif(btrim(p_notes), '')
  );

  insert into lihen_private.inventory_write_operations(
    operation_key, operation_type, actor_id, product_id, movement_id,
    request_fingerprint, result_snapshot
  ) values (
    btrim(p_operation_key), 'ADJUST_ON_HAND', v_actor_id, p_product_id, p_movement_id,
    v_fingerprint,
    jsonb_build_object(
      'movement_id', p_movement_id,
      'product_id', p_product_id,
      'bucket', 'ON_HAND',
      'quantity_delta', p_quantity_delta,
      'reason', p_reason,
      'occurred_at', p_occurred_at,
      'stock_on_hand', v_on_hand,
      'stock_reserved', v_reserved,
      'stock_pending', v_pending,
      'stock_available', v_available
    )
  );

  return query select p_movement_id, p_product_id, 'ON_HAND'::text, p_quantity_delta,
    p_reason, p_occurred_at, v_on_hand, v_reserved, v_pending, v_available;
end;
$$;

revoke all on function public.record_inventory_adjustment_controlled(text,uuid,uuid,integer,text,timestamptz,text)
  from public, anon, authenticated;
grant execute on function public.record_inventory_adjustment_controlled(text,uuid,uuid,integer,text,timestamptz,text)
  to authenticated;
grant execute on function public.record_inventory_adjustment_controlled(text,uuid,uuid,integer,text,timestamptz,text)
  to service_role;

revoke insert, update, delete on table public.inventory_movements from anon, authenticated;
