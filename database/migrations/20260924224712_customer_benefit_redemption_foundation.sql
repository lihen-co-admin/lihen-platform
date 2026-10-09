-- ============================================================
-- LIHEN CUSTOMER BENEFIT — CONTROLLED REDEMPTION FOUNDATION
--
-- PHASE F6
--
-- Controlled lifecycle only:
--
--   ACTIVE benefit
--   + valid now
--   + later COMPLETED sale
--   + same canonical customer
--   + same business-line item evidence
--   -> REDEEMED
--
-- Redemption records:
--   redeemed_at
--   redeemed_order_id
--   redeemed_sale_id
--
-- The redemption sale must be later than the source sale that
-- generated the benefit when source_sale_id is present.
--
-- IMPORTANT:
--   This phase records/validates benefit consumption only.
--   It DOES NOT alter order/sale totals, discounts, inventory,
--   finance, payment, or WhatsApp/send behavior.
--
-- Validity rule:
--   current processing time must be within
--   [valid_from, valid_until], inclusive.
--
-- Sale occurrence rule:
--   sale.occurred_at must also be within
--   [valid_from, valid_until], inclusive.
--
-- PROD remains HOLD.
-- ============================================================


-- ============================================================
-- 1. HARDEN REDEEMED TERMINAL STATE
-- ============================================================

alter table public.customer_benefits
  drop constraint if exists
  customer_benefits_redeemed_state;


alter table public.customer_benefits
  add constraint
  customer_benefits_redeemed_state
  check (
    (
      status = 'REDEEMED'
      and redeemed_at is not null
      and redeemed_order_id is not null
      and redeemed_sale_id is not null
    )
    or
    (
      status <> 'REDEEMED'
      and redeemed_at is null
      and redeemed_order_id is null
      and redeemed_sale_id is null
    )
  );


comment on constraint
customer_benefits_redeemed_state
on public.customer_benefits
is
  'REDEEMED requires redeemed_at, redeemed_order_id and redeemed_sale_id. Non-REDEEMED states must not retain redemption terminal fields.';


-- ============================================================
-- 2. CONTROLLED REDEMPTION RPC
-- ============================================================

create or replace function
public.redeem_customer_benefit_controlled(
  p_operation_key text,
  p_benefit_id uuid,
  p_redeemed_sale_id uuid
)
returns table(
  benefit_id uuid,
  customer_id uuid,
  benefit_code text,
  business_line text,
  benefit_type text,
  discount_percent numeric,
  status text,
  redeemed_at timestamptz,
  redeemed_order_id uuid,
  redeemed_sale_id uuid
)
language plpgsql
security definer
set search_path = pg_catalog, public, lihen_private, extensions
as $function$
declare
  v_actor uuid := auth.uid();

  v_operation_key text;
  v_fingerprint text;

  v_existing
    lihen_private.customer_write_operations%rowtype;

  v_benefit public.customer_benefits%rowtype;
  v_sale public.sales%rowtype;
  v_order public.orders%rowtype;
  v_source_sale public.sales%rowtype;

  v_redeemed_at timestamptz;
begin

  if v_actor is null then
    raise exception
      using
        errcode = '42501',
        message = 'LIHEN_AUTH_REQUIRED';
  end if;


  if not exists (
    select 1
    from public.profiles p
    where p.id = v_actor
      and p.authorization_status = 'ACTIVE'
      and p.role_code in (
        'OWNER',
        'ADMIN'
      )
  ) then
    raise exception
      using
        errcode = '42501',
        message =
          'LIHEN_CUSTOMER_BENEFIT_REDEEM_FORBIDDEN';
  end if;


  v_operation_key :=
    btrim(
      coalesce(
        p_operation_key,
        ''
      )
    );


  if v_operation_key = ''
     or p_benefit_id is null
     or p_redeemed_sale_id is null then
    raise exception
      using
        errcode = '22023',
        message =
          'LIHEN_CUSTOMER_BENEFIT_REDEEM_FIELDS_REQUIRED';
  end if;


  v_fingerprint :=
    md5(
      concat_ws(
        '|',
        p_benefit_id::text,
        p_redeemed_sale_id::text,
        'REDEEM_CUSTOMER_BENEFIT',
        'ACTIVE_VALID_NOW',
        'COMPLETED_SALE',
        'SAME_CUSTOMER',
        'SAME_LINE',
        'NO_COMMERCIAL_MUTATION'
      )
    );


  select *
  into v_existing
  from lihen_private.customer_write_operations o
  where o.operation_key = v_operation_key;


  if found then

    if v_existing.operation_type <>
         'REDEEM_CUSTOMER_BENEFIT'
       or v_existing.actor_id <> v_actor
       or v_existing.request_fingerprint
          is distinct from v_fingerprint then
      raise exception
        using
          errcode = '23505',
          message =
            'LIHEN_CUSTOMER_BENEFIT_OPERATION_CONFLICT';
    end if;


    return query
    select
      b.id,
      b.customer_id,
      b.benefit_code,
      b.business_line,
      b.benefit_type,
      b.discount_percent,
      b.status,
      b.redeemed_at,
      b.redeemed_order_id,
      b.redeemed_sale_id
    from public.customer_benefits b
    where b.id = p_benefit_id;

    return;
  end if;


  perform pg_advisory_xact_lock(
    hashtextextended(
      p_benefit_id::text,
      0
    )
  );


  select *
  into v_existing
  from lihen_private.customer_write_operations o
  where o.operation_key = v_operation_key;


  if found then

    if v_existing.operation_type <>
         'REDEEM_CUSTOMER_BENEFIT'
       or v_existing.actor_id <> v_actor
       or v_existing.request_fingerprint
          is distinct from v_fingerprint then
      raise exception
        using
          errcode = '23505',
          message =
            'LIHEN_CUSTOMER_BENEFIT_OPERATION_CONFLICT';
    end if;


    return query
    select
      b.id,
      b.customer_id,
      b.benefit_code,
      b.business_line,
      b.benefit_type,
      b.discount_percent,
      b.status,
      b.redeemed_at,
      b.redeemed_order_id,
      b.redeemed_sale_id
    from public.customer_benefits b
    where b.id = p_benefit_id;

    return;
  end if;


  select *
  into v_benefit
  from public.customer_benefits b
  where b.id = p_benefit_id
  for update;


  if not found then
    raise exception
      using
        errcode = '22023',
        message =
          'LIHEN_CUSTOMER_BENEFIT_NOT_FOUND';
  end if;


  if v_benefit.status <> 'ACTIVE' then
    raise exception
      using
        errcode = '22023',
        message =
          'LIHEN_CUSTOMER_BENEFIT_NOT_ACTIVE';
  end if;


  if v_benefit.valid_from is null
     or v_benefit.valid_until is null then
    raise exception
      using
        errcode = '22023',
        message =
          'LIHEN_CUSTOMER_BENEFIT_VALIDITY_REQUIRED';
  end if;


  if not exists (
    select 1
    from public.customers c
    where c.id = v_benefit.customer_id
      and c.status = 'ACTIVE'
  ) then
    raise exception
      using
        errcode = '22023',
        message =
          'LIHEN_CUSTOMER_BENEFIT_CUSTOMER_INACTIVE';
  end if;


  v_redeemed_at := clock_timestamp();


  if v_redeemed_at < v_benefit.valid_from
     or v_redeemed_at > v_benefit.valid_until then
    raise exception
      using
        errcode = '22023',
        message =
          'LIHEN_CUSTOMER_BENEFIT_OUTSIDE_VALIDITY_WINDOW';
  end if;


  select *
  into v_sale
  from public.sales s
  where s.id = p_redeemed_sale_id
  for share;


  if not found
     or v_sale.status <> 'COMPLETED'
     or v_sale.order_id is null then
    raise exception
      using
        errcode = '22023',
        message =
          'LIHEN_CUSTOMER_BENEFIT_REDEMPTION_SALE_INVALID';
  end if;


  select *
  into v_order
  from public.orders o
  where o.id = v_sale.order_id
  for share;


  if not found
     or v_order.customer_id is null then
    raise exception
      using
        errcode = '22023',
        message =
          'LIHEN_CUSTOMER_BENEFIT_REDEMPTION_CUSTOMER_REQUIRED';
  end if;


  if v_order.customer_id <> v_benefit.customer_id then
    raise exception
      using
        errcode = '22023',
        message =
          'LIHEN_CUSTOMER_BENEFIT_REDEMPTION_CUSTOMER_MISMATCH';
  end if;


  if v_sale.occurred_at < v_benefit.valid_from
     or v_sale.occurred_at > v_benefit.valid_until then
    raise exception
      using
        errcode = '22023',
        message =
          'LIHEN_CUSTOMER_BENEFIT_REDEMPTION_SALE_OUTSIDE_VALIDITY_WINDOW';
  end if;


  if not exists (
    select 1
    from public.sale_items si
    join public.products p
      on p.id = si.product_id
    where si.sale_id = v_sale.id
      and p.business_line =
          v_benefit.business_line
  ) then
    raise exception
      using
        errcode = '22023',
        message =
          'LIHEN_CUSTOMER_BENEFIT_REDEMPTION_LINE_NOT_PRESENT';
  end if;


  if v_benefit.source_sale_id is not null then

    if v_benefit.source_sale_id = v_sale.id then
      raise exception
        using
          errcode = '22023',
          message =
            'LIHEN_CUSTOMER_BENEFIT_SOURCE_SALE_CANNOT_REDEEM';
    end if;


    select *
    into v_source_sale
    from public.sales s
    where s.id = v_benefit.source_sale_id;


    if found
       and v_sale.occurred_at <= v_source_sale.occurred_at then
      raise exception
        using
          errcode = '22023',
          message =
            'LIHEN_CUSTOMER_BENEFIT_REDEMPTION_SALE_NOT_LATER_THAN_SOURCE';
    end if;
  end if;


  update public.customer_benefits b
  set
    status = 'REDEEMED',
    redeemed_at = v_redeemed_at,
    redeemed_order_id = v_order.id,
    redeemed_sale_id = v_sale.id,
    metadata =
      coalesce(
        b.metadata,
        '{}'::jsonb
      )
      ||
      jsonb_build_object(
        'redemptionProcessedAt',
        v_redeemed_at,
        'redemptionRule',
        'ACTIVE_VALID_COMPLETED_SAME_CUSTOMER_SAME_LINE_SALE',
        'commercialMutation',
        false
      )
  where b.id = p_benefit_id
  returning *
  into v_benefit;


  insert into
  lihen_private.customer_write_operations(
    operation_key,
    operation_type,
    actor_id,
    customer_id,
    order_id,
    request_fingerprint,
    result_snapshot
  )
  values(
    v_operation_key,
    'REDEEM_CUSTOMER_BENEFIT',
    v_actor,
    v_benefit.customer_id,
    v_order.id,
    v_fingerprint,
    jsonb_build_object(
      'benefit_id',
      v_benefit.id,
      'benefit_code',
      v_benefit.benefit_code,
      'business_line',
      v_benefit.business_line,
      'benefit_type',
      v_benefit.benefit_type,
      'discount_percent',
      v_benefit.discount_percent,
      'status',
      v_benefit.status,
      'redeemed_at',
      v_benefit.redeemed_at,
      'redeemed_order_id',
      v_benefit.redeemed_order_id,
      'redeemed_sale_id',
      v_benefit.redeemed_sale_id,
      'commercial_mutation',
      false
    )
  );


  return query
  select
    v_benefit.id,
    v_benefit.customer_id,
    v_benefit.benefit_code,
    v_benefit.business_line,
    v_benefit.benefit_type,
    v_benefit.discount_percent,
    v_benefit.status,
    v_benefit.redeemed_at,
    v_benefit.redeemed_order_id,
    v_benefit.redeemed_sale_id;

end;
$function$;


revoke all
on function
public.redeem_customer_benefit_controlled(
  text,
  uuid,
  uuid
)
from public, anon, authenticated, service_role;


grant execute
on function
public.redeem_customer_benefit_controlled(
  text,
  uuid,
  uuid
)
to authenticated;


comment on function
public.redeem_customer_benefit_controlled(
  text,
  uuid,
  uuid
)
is
  'Controlled LIHEN F6 redemption. Transitions ACTIVE to REDEEMED only for a currently valid benefit and a later COMPLETED same-customer sale with same-line item evidence. Records redeemed_at/order/sale and audit ledger. Does not mutate commercial totals, inventory, finance or messaging.';


-- ============================================================
-- EXPLICIT NON-GOALS
-- ============================================================

-- NO:
-- - automatic order discount application;
-- - sale total mutation;
-- - order total mutation;
-- - inventory mutation;
-- - finance mutation;
-- - automatic WhatsApp/send;
-- - automatic PURCHASE_THRESHOLD issuance;
-- - PROD apply.
