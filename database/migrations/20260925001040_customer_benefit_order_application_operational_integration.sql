-- ============================================================
-- LIHEN CUSTOMER BENEFITS — OPERATIONAL INTEGRATION CANDIDATE
-- Local candidate only. Do not apply remotely without explicit
-- authorization after local + ephemeral gates pass.
--
-- Frozen policy:
-- - no manual/generic discount stacks with Customer Benefits;
-- - max one APPLIED BEAUTY_CARE and one APPLIED STYLE per order;
-- - each benefit discounts only its own business_line subtotal;
-- - delivery is excluded;
-- - Orders stores aggregate benefit discount as FIXED money;
-- - provenance is stored per applied benefit;
-- - sale completion atomically redeems APPLIED benefits.
-- ============================================================

create table if not exists public.order_customer_benefit_applications (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null
    references public.orders(id)
    on delete restrict,
  benefit_id uuid not null
    references public.customer_benefits(id)
    on delete restrict,
  customer_id uuid not null
    references public.customers(id)
    on delete restrict,
  business_line text not null
    check (business_line in ('BEAUTY_CARE','STYLE')),
  benefit_code_snapshot text not null,
  benefit_type_snapshot text not null,
  discount_percent_snapshot numeric not null
    check (
      discount_percent_snapshot > 0
      and discount_percent_snapshot <= 100
    ),
  eligible_subtotal numeric not null
    check (eligible_subtotal >= 0),
  applied_discount_amount numeric not null
    check (
      applied_discount_amount >= 0
      and applied_discount_amount <= eligible_subtotal
    ),
  status text not null default 'APPLIED'
    check (status in ('APPLIED','REMOVED','REDEEMED')),
  applied_at timestamptz not null,
  applied_by uuid not null,
  removed_at timestamptz,
  removed_by uuid,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint order_customer_benefit_applications_removed_state
  check (
    (
      status = 'REMOVED'
      and removed_at is not null
      and removed_by is not null
    )
    or
    (
      status <> 'REMOVED'
      and removed_at is null
      and removed_by is null
    )
  )
);

comment on table public.order_customer_benefit_applications is
  'Auditable LIHEN attestation of Customer Benefits intentionally applied to Orders before sale completion. Does not replace the Customer Benefit lifecycle.';

create unique index if not exists
order_customer_benefit_applications_active_order_line_uidx
on public.order_customer_benefit_applications(order_id,business_line)
where status='APPLIED';

create unique index if not exists
order_customer_benefit_applications_active_benefit_uidx
on public.order_customer_benefit_applications(benefit_id)
where status='APPLIED';

create index if not exists
order_customer_benefit_applications_order_idx
on public.order_customer_benefit_applications(order_id,status);

create index if not exists
order_customer_benefit_applications_customer_idx
on public.order_customer_benefit_applications(customer_id,status);

alter table public.order_customer_benefit_applications
enable row level security;

drop policy if exists
order_customer_benefit_applications_owner_admin_read
on public.order_customer_benefit_applications;

create policy
order_customer_benefit_applications_owner_admin_read
on public.order_customer_benefit_applications
for select
to authenticated
using (
  exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.authorization_status = 'ACTIVE'
      and p.role_code in ('OWNER','ADMIN')
  )
);

revoke all
on public.order_customer_benefit_applications
from public, anon, authenticated;

grant select
on public.order_customer_benefit_applications
to authenticated;

create table if not exists lihen_private.customer_benefit_order_operations (
  operation_key text primary key,
  operation_type text not null
    check (
      operation_type in (
        'APPLY_CUSTOMER_BENEFIT_TO_ORDER',
        'REMOVE_CUSTOMER_BENEFIT_FROM_ORDER'
      )
    ),
  actor_id uuid not null,
  order_id uuid not null,
  benefit_id uuid not null,
  request_fingerprint text not null,
  result_snapshot jsonb not null,
  created_at timestamptz not null default now()
);

revoke all
on lihen_private.customer_benefit_order_operations
from public, anon, authenticated;

-- ------------------------------------------------------------
-- APPLY BENEFIT TO ORDER
-- ------------------------------------------------------------

create or replace function
public.apply_customer_benefit_to_order_controlled(
  p_operation_key text,
  p_order_id uuid,
  p_benefit_id uuid
)
returns table(
  application_id uuid,
  order_id uuid,
  benefit_id uuid,
  business_line text,
  eligible_subtotal numeric,
  applied_discount_amount numeric,
  aggregate_benefit_discount numeric,
  order_total numeric,
  status text
)
language plpgsql
security definer
set search_path = pg_catalog, public, lihen_private, extensions
as $function$
declare
  v_actor uuid := auth.uid();
  v_operation_key text;
  v_fp text;
  v_existing lihen_private.customer_benefit_order_operations%rowtype;
  v_order public.orders%rowtype;
  v_benefit public.customer_benefits%rowtype;
  v_application public.order_customer_benefit_applications%rowtype;
  v_current_benefit_discount numeric := 0;
  v_eligible_subtotal numeric := 0;
  v_applied_discount numeric := 0;
  v_aggregate_discount numeric := 0;
  v_expected_total numeric := 0;
  v_terms record;
begin
  if v_actor is null then
    raise exception using
      errcode='42501',
      message='LIHEN_AUTH_REQUIRED';
  end if;

  if not exists (
    select 1
    from public.profiles p
    where p.id=v_actor
      and p.authorization_status='ACTIVE'
      and p.role_code in ('OWNER','ADMIN')
  ) then
    raise exception using
      errcode='42501',
      message='LIHEN_CUSTOMER_BENEFIT_ORDER_APPLY_FORBIDDEN';
  end if;

  v_operation_key := btrim(coalesce(p_operation_key,''));

  if v_operation_key=''
     or p_order_id is null
     or p_benefit_id is null then
    raise exception using
      errcode='22023',
      message='LIHEN_CUSTOMER_BENEFIT_ORDER_APPLY_FIELDS_REQUIRED';
  end if;

  v_fp := md5(
    concat_ws(
      '|',
      p_order_id::text,
      p_benefit_id::text,
      'APPLY_CUSTOMER_BENEFIT_TO_ORDER'
    )
  );

  select *
  into v_existing
  from lihen_private.customer_benefit_order_operations o
  where o.operation_key=v_operation_key;

  if found then
    if v_existing.operation_type <> 'APPLY_CUSTOMER_BENEFIT_TO_ORDER'
       or v_existing.actor_id <> v_actor
       or v_existing.order_id <> p_order_id
       or v_existing.benefit_id <> p_benefit_id
       or v_existing.request_fingerprint is distinct from v_fp then
      raise exception using
        errcode='23505',
        message='LIHEN_CUSTOMER_BENEFIT_ORDER_OPERATION_CONFLICT';
    end if;

    return query
    select
      a.id,
      a.order_id,
      a.benefit_id,
      a.business_line,
      a.eligible_subtotal,
      a.applied_discount_amount,
      coalesce((
        select sum(a2.applied_discount_amount)
        from public.order_customer_benefit_applications a2
        where a2.order_id=a.order_id
          and a2.status='APPLIED'
      ),0),
      o.total,
      a.status
    from public.order_customer_benefit_applications a
    join public.orders o on o.id=a.order_id
    where a.id=(v_existing.result_snapshot->>'application_id')::uuid;

    return;
  end if;

  perform pg_advisory_xact_lock(
    hashtextextended(p_order_id::text,0)
  );

  perform pg_advisory_xact_lock(
    hashtextextended(p_benefit_id::text,0)
  );

  select *
  into v_order
  from public.orders o
  where o.id=p_order_id
  for update;

  if not found then
    raise exception using
      errcode='P0002',
      message='LIHEN_ORDER_NOT_FOUND';
  end if;

  if v_order.status not in ('DRAFT','CONFIRMED','PREPARING','READY') then
    raise exception using
      errcode='22023',
      message='LIHEN_CUSTOMER_BENEFIT_ORDER_NOT_EDITABLE';
  end if;

  if v_order.customer_id is null then
    raise exception using
      errcode='22023',
      message='LIHEN_CUSTOMER_BENEFIT_ORDER_CUSTOMER_REQUIRED';
  end if;

  select *
  into v_benefit
  from public.customer_benefits b
  where b.id=p_benefit_id
  for update;

  if not found then
    raise exception using
      errcode='P0002',
      message='LIHEN_CUSTOMER_BENEFIT_NOT_FOUND';
  end if;

  if v_benefit.status <> 'ACTIVE' then
    raise exception using
      errcode='22023',
      message='LIHEN_CUSTOMER_BENEFIT_NOT_ACTIVE';
  end if;

  if v_benefit.customer_id <> v_order.customer_id then
    raise exception using
      errcode='22023',
      message='LIHEN_CUSTOMER_BENEFIT_ORDER_CUSTOMER_MISMATCH';
  end if;

  if v_benefit.valid_from is null
     or v_benefit.valid_until is null
     or clock_timestamp() < v_benefit.valid_from
     or clock_timestamp() > v_benefit.valid_until then
    raise exception using
      errcode='22023',
      message='LIHEN_CUSTOMER_BENEFIT_OUTSIDE_VALIDITY_WINDOW';
  end if;

  if exists (
    select 1
    from public.order_customer_benefit_applications a
    where a.order_id=p_order_id
      and a.business_line=v_benefit.business_line
      and a.status='APPLIED'
  ) then
    raise exception using
      errcode='23505',
      message='LIHEN_CUSTOMER_BENEFIT_ORDER_LINE_ALREADY_APPLIED';
  end if;

  if exists (
    select 1
    from public.order_customer_benefit_applications a
    where a.benefit_id=p_benefit_id
      and a.status='APPLIED'
  ) then
    raise exception using
      errcode='23505',
      message='LIHEN_CUSTOMER_BENEFIT_ALREADY_APPLIED_TO_ORDER';
  end if;

  select
    coalesce(sum(a.applied_discount_amount),0)
  into v_current_benefit_discount
  from public.order_customer_benefit_applications a
  where a.order_id=p_order_id
    and a.status='APPLIED';

  if v_current_benefit_discount=0 then
    if v_order.discount_type <> 'NONE'
       or v_order.discount_value <> 0
       or v_order.discount_amount <> 0 then
      raise exception using
        errcode='22023',
        message='LIHEN_CUSTOMER_BENEFIT_MANUAL_DISCOUNT_CONFLICT';
    end if;
  else
    if v_order.discount_type <> 'FIXED'
       or round(v_order.discount_value::numeric,2)
          <> round(v_current_benefit_discount::numeric,2)
       or round(v_order.discount_amount::numeric,2)
          <> round(v_current_benefit_discount::numeric,2) then
      raise exception using
        errcode='23514',
        message='LIHEN_CUSTOMER_BENEFIT_ORDER_DISCOUNT_PROVENANCE_MISMATCH';
    end if;
  end if;

  select
    coalesce(sum(oi.quantity * oi.unit_price),0)
  into v_eligible_subtotal
  from public.order_items oi
  join public.products p
    on p.id=oi.product_id
  where oi.order_id=p_order_id
    and p.business_line=v_benefit.business_line;

  if v_eligible_subtotal <= 0 then
    raise exception using
      errcode='22023',
      message='LIHEN_CUSTOMER_BENEFIT_ORDER_LINE_NOT_PRESENT';
  end if;

  v_applied_discount :=
    round(
      (
        v_eligible_subtotal
        * v_benefit.discount_percent
        / 100.0
      )::numeric,
      2
    );

  insert into public.order_customer_benefit_applications(
    order_id,
    benefit_id,
    customer_id,
    business_line,
    benefit_code_snapshot,
    benefit_type_snapshot,
    discount_percent_snapshot,
    eligible_subtotal,
    applied_discount_amount,
    status,
    applied_at,
    applied_by,
    metadata
  )
  values(
    p_order_id,
    p_benefit_id,
    v_benefit.customer_id,
    v_benefit.business_line,
    v_benefit.benefit_code,
    v_benefit.benefit_type,
    v_benefit.discount_percent,
    v_eligible_subtotal,
    v_applied_discount,
    'APPLIED',
    clock_timestamp(),
    v_actor,
    jsonb_build_object(
      'rule',
      'SAME_LINE_SUBTOTAL_PERCENT_DELIVERY_EXCLUDED',
      'manualDiscountStacking',
      false
    )
  )
  returning *
  into v_application;

  select
    coalesce(sum(a.applied_discount_amount),0)
  into v_aggregate_discount
  from public.order_customer_benefit_applications a
  where a.order_id=p_order_id
    and a.status='APPLIED';

  v_expected_total :=
    v_order.subtotal
    - v_aggregate_discount
    + v_order.delivery_cost;

  select *
  into v_terms
  from public.set_order_commercial_terms_controlled(
    v_operation_key || ':commercial',
    p_order_id,
    v_order.subtotal,
    'FIXED',
    v_aggregate_discount,
    v_aggregate_discount,
    v_order.delivery_cost,
    v_expected_total,
    v_order.payment_status
  );

  insert into lihen_private.customer_benefit_order_operations(
    operation_key,
    operation_type,
    actor_id,
    order_id,
    benefit_id,
    request_fingerprint,
    result_snapshot
  )
  values(
    v_operation_key,
    'APPLY_CUSTOMER_BENEFIT_TO_ORDER',
    v_actor,
    p_order_id,
    p_benefit_id,
    v_fp,
    jsonb_build_object(
      'application_id',v_application.id,
      'business_line',v_application.business_line,
      'eligible_subtotal',v_application.eligible_subtotal,
      'applied_discount_amount',v_application.applied_discount_amount,
      'aggregate_benefit_discount',v_aggregate_discount,
      'order_total',v_expected_total
    )
  );

  return query
  select
    v_application.id,
    v_application.order_id,
    v_application.benefit_id,
    v_application.business_line,
    v_application.eligible_subtotal,
    v_application.applied_discount_amount,
    v_aggregate_discount,
    v_expected_total,
    v_application.status;
end;
$function$;

revoke all
on function public.apply_customer_benefit_to_order_controlled(text,uuid,uuid)
from public, anon, authenticated, service_role;

grant execute
on function public.apply_customer_benefit_to_order_controlled(text,uuid,uuid)
to authenticated;

comment on function
public.apply_customer_benefit_to_order_controlled(text,uuid,uuid)
is
  'Controlled LIHEN Customer Benefit application to an Order. Enforces same customer, ACTIVE/current benefit, same-line merchandise, no manual discount stacking, and line-scoped discount provenance. No sale/inventory/finance mutation.';

-- ------------------------------------------------------------
-- REMOVE BENEFIT FROM ORDER
-- ------------------------------------------------------------

create or replace function
public.remove_customer_benefit_from_order_controlled(
  p_operation_key text,
  p_order_id uuid,
  p_benefit_id uuid
)
returns table(
  application_id uuid,
  order_id uuid,
  benefit_id uuid,
  business_line text,
  aggregate_benefit_discount numeric,
  order_total numeric,
  status text
)
language plpgsql
security definer
set search_path = pg_catalog, public, lihen_private, extensions
as $function$
declare
  v_actor uuid := auth.uid();
  v_operation_key text;
  v_fp text;
  v_existing lihen_private.customer_benefit_order_operations%rowtype;
  v_order public.orders%rowtype;
  v_application public.order_customer_benefit_applications%rowtype;
  v_current_benefit_discount numeric := 0;
  v_remaining_discount numeric := 0;
  v_expected_total numeric := 0;
  v_terms record;
begin
  if v_actor is null then
    raise exception using
      errcode='42501',
      message='LIHEN_AUTH_REQUIRED';
  end if;

  if not exists (
    select 1
    from public.profiles p
    where p.id=v_actor
      and p.authorization_status='ACTIVE'
      and p.role_code in ('OWNER','ADMIN')
  ) then
    raise exception using
      errcode='42501',
      message='LIHEN_CUSTOMER_BENEFIT_ORDER_REMOVE_FORBIDDEN';
  end if;

  v_operation_key := btrim(coalesce(p_operation_key,''));

  if v_operation_key=''
     or p_order_id is null
     or p_benefit_id is null then
    raise exception using
      errcode='22023',
      message='LIHEN_CUSTOMER_BENEFIT_ORDER_REMOVE_FIELDS_REQUIRED';
  end if;

  v_fp := md5(
    concat_ws(
      '|',
      p_order_id::text,
      p_benefit_id::text,
      'REMOVE_CUSTOMER_BENEFIT_FROM_ORDER'
    )
  );

  select *
  into v_existing
  from lihen_private.customer_benefit_order_operations o
  where o.operation_key=v_operation_key;

  if found then
    if v_existing.operation_type <> 'REMOVE_CUSTOMER_BENEFIT_FROM_ORDER'
       or v_existing.actor_id <> v_actor
       or v_existing.order_id <> p_order_id
       or v_existing.benefit_id <> p_benefit_id
       or v_existing.request_fingerprint is distinct from v_fp then
      raise exception using
        errcode='23505',
        message='LIHEN_CUSTOMER_BENEFIT_ORDER_OPERATION_CONFLICT';
    end if;

    return query
    select
      a.id,
      a.order_id,
      a.benefit_id,
      a.business_line,
      coalesce((
        select sum(a2.applied_discount_amount)
        from public.order_customer_benefit_applications a2
        where a2.order_id=a.order_id
          and a2.status='APPLIED'
      ),0),
      o.total,
      a.status
    from public.order_customer_benefit_applications a
    join public.orders o on o.id=a.order_id
    where a.id=(v_existing.result_snapshot->>'application_id')::uuid;

    return;
  end if;

  perform pg_advisory_xact_lock(
    hashtextextended(p_order_id::text,0)
  );

  perform pg_advisory_xact_lock(
    hashtextextended(p_benefit_id::text,0)
  );

  select *
  into v_order
  from public.orders o
  where o.id=p_order_id
  for update;

  if not found then
    raise exception using
      errcode='P0002',
      message='LIHEN_ORDER_NOT_FOUND';
  end if;

  if v_order.status not in ('DRAFT','CONFIRMED','PREPARING','READY') then
    raise exception using
      errcode='22023',
      message='LIHEN_CUSTOMER_BENEFIT_ORDER_NOT_EDITABLE';
  end if;

  select *
  into v_application
  from public.order_customer_benefit_applications a
  where a.order_id=p_order_id
    and a.benefit_id=p_benefit_id
    and a.status='APPLIED'
  for update;

  if not found then
    raise exception using
      errcode='P0002',
      message='LIHEN_CUSTOMER_BENEFIT_ORDER_APPLICATION_NOT_FOUND';
  end if;

  select
    coalesce(sum(a.applied_discount_amount),0)
  into v_current_benefit_discount
  from public.order_customer_benefit_applications a
  where a.order_id=p_order_id
    and a.status='APPLIED';

  if v_order.discount_type <> 'FIXED'
     or round(v_order.discount_value::numeric,2)
        <> round(v_current_benefit_discount::numeric,2)
     or round(v_order.discount_amount::numeric,2)
        <> round(v_current_benefit_discount::numeric,2) then
    raise exception using
      errcode='23514',
      message='LIHEN_CUSTOMER_BENEFIT_ORDER_DISCOUNT_PROVENANCE_MISMATCH';
  end if;

  update public.order_customer_benefit_applications a
  set
    status='REMOVED',
    removed_at=clock_timestamp(),
    removed_by=v_actor,
    updated_at=now()
  where a.id=v_application.id
  returning *
  into v_application;

  select
    coalesce(sum(a.applied_discount_amount),0)
  into v_remaining_discount
  from public.order_customer_benefit_applications a
  where a.order_id=p_order_id
    and a.status='APPLIED';

  v_expected_total :=
    v_order.subtotal
    - v_remaining_discount
    + v_order.delivery_cost;

  if v_remaining_discount=0 then
    select *
    into v_terms
    from public.set_order_commercial_terms_controlled(
      v_operation_key || ':commercial',
      p_order_id,
      v_order.subtotal,
      'NONE',
      0,
      0,
      v_order.delivery_cost,
      v_expected_total,
      v_order.payment_status
    );
  else
    select *
    into v_terms
    from public.set_order_commercial_terms_controlled(
      v_operation_key || ':commercial',
      p_order_id,
      v_order.subtotal,
      'FIXED',
      v_remaining_discount,
      v_remaining_discount,
      v_order.delivery_cost,
      v_expected_total,
      v_order.payment_status
    );
  end if;

  insert into lihen_private.customer_benefit_order_operations(
    operation_key,
    operation_type,
    actor_id,
    order_id,
    benefit_id,
    request_fingerprint,
    result_snapshot
  )
  values(
    v_operation_key,
    'REMOVE_CUSTOMER_BENEFIT_FROM_ORDER',
    v_actor,
    p_order_id,
    p_benefit_id,
    v_fp,
    jsonb_build_object(
      'application_id',v_application.id,
      'business_line',v_application.business_line,
      'aggregate_benefit_discount',v_remaining_discount,
      'order_total',v_expected_total
    )
  );

  return query
  select
    v_application.id,
    v_application.order_id,
    v_application.benefit_id,
    v_application.business_line,
    v_remaining_discount,
    v_expected_total,
    v_application.status;
end;
$function$;

revoke all
on function public.remove_customer_benefit_from_order_controlled(text,uuid,uuid)
from public, anon, authenticated, service_role;

grant execute
on function public.remove_customer_benefit_from_order_controlled(text,uuid,uuid)
to authenticated;

comment on function
public.remove_customer_benefit_from_order_controlled(text,uuid,uuid)
is
  'Controlled LIHEN removal of an APPLIED Customer Benefit from an editable Order. Recomputes aggregate Customer Benefit discount and leaves the Customer Benefit lifecycle ACTIVE.';

-- ------------------------------------------------------------
-- ATOMIC SALE COMPLETION + BENEFIT REDEMPTION
-- Existing commerce authority is preserved and extended.
-- ------------------------------------------------------------

create or replace function
public.complete_order_sale_controlled(
  p_operation_key text,
  p_sale_id uuid,
  p_sale_number text,
  p_order_id uuid,
  p_financial_account_id uuid,
  p_occurred_at timestamptz,
  p_notes text
)
returns table(
  sale_id uuid,
  sale_number text,
  order_id uuid,
  total_amount numeric,
  status text
)
language plpgsql
security definer
set search_path to ''
as $function$
declare
  v_actor uuid := auth.uid();
  v_fp text;
  v_existing lihen_private.sale_write_operations%rowtype;
  v_order public.orders%rowtype;
  v_items_subtotal numeric := 0;
  v_total numeric := 0;
  v_item record;
  v_balance record;
  v_movement_id uuid := gen_random_uuid();
  v_application public.order_customer_benefit_applications%rowtype;
  v_applied_discount numeric := 0;
  v_redemption record;
begin
  if v_actor is null then
    raise exception using
      errcode='42501',
      message='LIHEN_AUTH_REQUIRED';
  end if;

  if not exists(
    select 1
    from public.profiles p
    where p.id=v_actor
      and p.authorization_status='ACTIVE'
      and p.role_code in ('OWNER','ADMIN')
  ) then
    raise exception using
      errcode='42501',
      message='LIHEN_SALE_FORBIDDEN';
  end if;

  if p_operation_key is null
     or btrim(p_operation_key)=''
     or p_sale_id is null
     or p_order_id is null
     or p_financial_account_id is null
     or p_sale_number is null
     or btrim(p_sale_number)='' then
    raise exception using
      errcode='22023',
      message='LIHEN_SALE_FIELDS_REQUIRED';
  end if;

  if not exists(
    select 1
    from public.financial_accounts a
    where a.id=p_financial_account_id
      and a.status='ACTIVE'
  ) then
    raise exception using
      errcode='23503',
      message='LIHEN_FINANCIAL_ACCOUNT_NOT_ACTIVE';
  end if;

  select o.*
  into v_order
  from public.orders o
  where o.id=p_order_id
  for update;

  if not found then
    raise exception using
      errcode='P0002',
      message='LIHEN_ORDER_NOT_FOUND';
  end if;

  if v_order.status not in ('CONFIRMED','PREPARING','READY') then
    raise exception using
      errcode='22023',
      message='LIHEN_ORDER_NOT_SELLABLE';
  end if;

  if not exists(
    select 1
    from public.order_items oi0
    where oi0.order_id=p_order_id
  ) then
    raise exception using
      errcode='22023',
      message='LIHEN_ORDER_EMPTY';
  end if;

  v_fp := md5(concat_ws(
    '|',
    p_sale_id::text,
    btrim(p_sale_number),
    p_order_id::text,
    p_financial_account_id::text,
    p_occurred_at::text,
    coalesce(p_notes,'')
  ));

  select swo.*
  into v_existing
  from lihen_private.sale_write_operations swo
  where swo.operation_key=btrim(p_operation_key);

  if found then
    if v_existing.operation_type <> 'COMPLETE_ORDER_SALE'
       or v_existing.actor_id <> v_actor
       or v_existing.request_fingerprint is distinct from v_fp then
      raise exception using
        errcode='23505',
        message='LIHEN_SALE_OPERATION_CONFLICT';
    end if;

    return query
      select s.id,s.sale_number,s.order_id,s.total_amount,s.status
      from public.sales s
      where s.id=v_existing.sale_id;

    return;
  end if;

  if exists(
    select 1
    from public.sales sx
    where sx.order_id=p_order_id
  ) then
    raise exception using
      errcode='23505',
      message='LIHEN_ORDER_ALREADY_SOLD';
  end if;

  for v_item in
    select oi.*
    from public.order_items oi
    where oi.order_id=p_order_id
    order by oi.product_id,oi.id
  loop
    perform pg_advisory_xact_lock(
      hashtextextended(v_item.product_id::text,0)
    );

    select ist.*
    into v_balance
    from public.inventory_stock ist
    where ist.product_id=v_item.product_id;

    if coalesce(v_balance.stock_reserved,0) < v_item.quantity
       or coalesce(v_balance.stock_on_hand,0) < v_item.quantity then
      raise exception using
        errcode='22023',
        message='LIHEN_RESERVED_STOCK_INSUFFICIENT';
    end if;

    v_items_subtotal :=
      v_items_subtotal
      + (v_item.quantity * v_item.unit_price);
  end loop;

  if round(coalesce(v_order.subtotal,0)::numeric,2)
     <> round(v_items_subtotal::numeric,2) then
    raise exception using
      errcode='23514',
      message='LIHEN_ORDER_SUBTOTAL_STALE';
  end if;

  if round(coalesce(v_order.total,0)::numeric,2)
     <> round((
       coalesce(v_order.subtotal,0)
       - coalesce(v_order.discount_amount,0)
       + coalesce(v_order.delivery_cost,0)
     )::numeric,2) then
    raise exception using
      errcode='23514',
      message='LIHEN_ORDER_TOTAL_INVALID';
  end if;

  select
    coalesce(sum(a.applied_discount_amount),0)
  into v_applied_discount
  from public.order_customer_benefit_applications a
  where a.order_id=p_order_id
    and a.status='APPLIED';

  if v_applied_discount > 0 then
    if v_order.discount_type <> 'FIXED'
       or round(v_order.discount_value::numeric,2)
          <> round(v_applied_discount::numeric,2)
       or round(v_order.discount_amount::numeric,2)
          <> round(v_applied_discount::numeric,2) then
      raise exception using
        errcode='23514',
        message='LIHEN_CUSTOMER_BENEFIT_ORDER_DISCOUNT_PROVENANCE_MISMATCH';
    end if;
  end if;

  v_total := v_order.total;

  insert into public.sales(
    id,
    sale_number,
    order_id,
    channel,
    status,
    customer_name,
    customer_phone,
    occurred_at,
    total_amount,
    financial_account_id,
    notes
  )
  values(
    p_sale_id,
    btrim(p_sale_number),
    p_order_id,
    v_order.channel,
    'COMPLETED',
    v_order.customer_name,
    v_order.customer_phone,
    coalesce(p_occurred_at,now()),
    v_total,
    p_financial_account_id,
    nullif(btrim(coalesce(p_notes,'')),'')
  );

  for v_item in
    select oi.*
    from public.order_items oi
    where oi.order_id=p_order_id
    order by oi.product_id,oi.id
  loop
    insert into public.sale_items(
      sale_id,
      product_id,
      quantity,
      unit_price
    )
    values(
      p_sale_id,
      v_item.product_id,
      v_item.quantity,
      v_item.unit_price
    );

    insert into public.inventory_movements(
      product_id,
      bucket,
      quantity_delta,
      reason,
      occurred_at,
      external_reference,
      notes
    )
    values(
      v_item.product_id,
      'RESERVED',
      -v_item.quantity,
      'SALE_COMPLETED',
      coalesce(p_occurred_at,now()),
      p_sale_id::text,
      'Liberación de reserva por venta completada'
    );

    insert into public.inventory_movements(
      product_id,
      bucket,
      quantity_delta,
      reason,
      occurred_at,
      external_reference,
      notes
    )
    values(
      v_item.product_id,
      'ON_HAND',
      -v_item.quantity,
      'SALE_COMPLETED',
      coalesce(p_occurred_at,now()),
      p_sale_id::text,
      'Salida física por venta completada'
    );
  end loop;

  -- Atomic Customer Benefit redemption. Any error here aborts the
  -- surrounding sale/inventory/finance/order transaction.
  for v_application in
    select a.*
    from public.order_customer_benefit_applications a
    where a.order_id=p_order_id
      and a.status='APPLIED'
    order by a.business_line,a.id
    for update
  loop
    select *
    into v_redemption
    from public.redeem_customer_benefit_controlled(
      btrim(p_operation_key)
        || ':benefit:'
        || v_application.benefit_id::text,
      v_application.benefit_id,
      p_sale_id
    );

    update public.order_customer_benefit_applications a
    set
      status='REDEEMED',
      updated_at=now(),
      metadata=
        coalesce(a.metadata,'{}'::jsonb)
        ||
        jsonb_build_object(
          'redeemedSaleId',p_sale_id,
          'redeemedAt',clock_timestamp(),
          'atomicWithSaleCompletion',true
        )
    where a.id=v_application.id;
  end loop;

  insert into public.financial_movements(
    id,
    account_id,
    movement_type,
    amount_signed,
    occurred_at,
    description,
    reference_type,
    reference_id
  )
  values(
    v_movement_id,
    p_financial_account_id,
    'SALE_INCOME',
    v_total,
    coalesce(p_occurred_at,now()),
    'Ingreso por venta '||btrim(p_sale_number),
    'SALE',
    p_sale_id
  );

  update public.orders o
  set
    status='COMPLETED',
    payment_status='PAID',
    updated_at=now()
  where o.id=p_order_id;

  insert into lihen_private.sale_write_operations(
    operation_key,
    operation_type,
    actor_id,
    sale_id,
    request_fingerprint,
    result_snapshot
  )
  values(
    btrim(p_operation_key),
    'COMPLETE_ORDER_SALE',
    v_actor,
    p_sale_id,
    v_fp,
    jsonb_build_object(
      'sale_id',p_sale_id,
      'items_subtotal',v_items_subtotal,
      'discount_amount',v_order.discount_amount,
      'customer_benefit_discount',v_applied_discount,
      'delivery_cost',v_order.delivery_cost,
      'total_amount',v_total,
      'financial_movement_id',v_movement_id
    )
  );

  return query
    select s.id,s.sale_number,s.order_id,s.total_amount,s.status
    from public.sales s
    where s.id=p_sale_id;
end;
$function$;

comment on function
public.complete_order_sale_controlled(
  text,uuid,text,uuid,uuid,timestamptz,text
)
is
  'Controlled LIHEN order sale completion. Preserves canonical Sale/Inventory/Finance behavior and atomically redeems any APPLIED Customer Benefits before commit.';
