-- ============================================================
-- LIHEN CUSTOMER BENEFIT — WELCOME ISSUE FOUNDATION
--
-- PHASE F1
--
-- Purpose:
--   - generate an exclusive DB-side code;
--   - issue the first-purchase WELCOME benefit only;
--   - keep the benefit in GENERATED state;
--   - reuse Customer Master idempotency ledger;
--   - do not activate, redeem, expire, send or apply discounts.
--
-- Explicitly deferred:
--   - RETURN_AFTER_EXPIRED issuance;
--   - PURCHASE_THRESHOLD issuance;
--   - Colombia business-day activation calendar;
--   - simultaneous ACTIVE benefit policy;
--   - automatic WhatsApp send;
--   - automatic Orders/Sales pricing mutation.
-- ============================================================


-- ============================================================
-- 1. PRIVATE CODE-CANDIDATE GENERATOR
--
-- Final uniqueness authority remains the UNIQUE index on
-- public.customer_benefits(benefit_code). The public issue RPC
-- retries on unique_violation.
-- ============================================================

create or replace function
lihen_private.generate_customer_benefit_code_candidate(
  p_business_line text
)
returns text
language plpgsql
volatile
security definer
set search_path = pg_catalog, public, extensions
as $function$
declare
  v_line text;
  v_prefix text;
  v_suffix text;
begin
  v_line :=
    upper(
      btrim(
        coalesce(
          p_business_line,
          ''
        )
      )
    );

  if v_line = 'BEAUTY_CARE' then
    v_prefix := 'LIHENBC';
  elsif v_line = 'STYLE' then
    v_prefix := 'LIHENST';
  else
    raise exception
      using
        errcode = '22023',
        message =
          'LIHEN_CUSTOMER_BENEFIT_LINE_INVALID';
  end if;

  v_suffix :=
    upper(
      substr(
        encode(
          extensions.gen_random_bytes(4),
          'hex'
        ),
        1,
        6
      )
    );

  return
    v_prefix || '-' || v_suffix;
end;
$function$;


revoke all
on function
lihen_private.generate_customer_benefit_code_candidate(text)
from public, anon, authenticated;


comment on function
lihen_private.generate_customer_benefit_code_candidate(text)
is
  'Private candidate generator for LIHEN customer benefit codes. Final uniqueness is enforced by the customer_benefits unique index during controlled issuance.';


-- ============================================================
-- 2. CONTROLLED WELCOME ISSUE RPC
--
-- Current Phase F scope:
--   WELCOME only.
--
-- The RPC derives canonical customer and order from source_sale_id.
-- The caller does NOT choose customer_id or source_order_id.
--
-- Discount percentage is explicit because the commercial
-- percentage has not been globally frozen yet. Only active
-- OWNER/ADMIN actors can execute this controlled operation.
-- ============================================================

create or replace function
public.issue_customer_welcome_benefit_controlled(
  p_operation_key text,
  p_source_sale_id uuid,
  p_business_line text,
  p_discount_percent numeric
)
returns table(
  benefit_id uuid,
  customer_id uuid,
  benefit_code text,
  business_line text,
  benefit_type text,
  discount_percent numeric,
  status text,
  source_order_id uuid,
  source_sale_id uuid,
  created_at timestamptz
)
language plpgsql
security definer
set search_path = pg_catalog, public, lihen_private, extensions
as $function$
declare
  v_actor uuid := auth.uid();

  v_operation_key text;
  v_business_line text;
  v_fingerprint text;

  v_existing
    lihen_private.customer_write_operations%rowtype;

  v_sale public.sales%rowtype;
  v_order public.orders%rowtype;
  v_customer public.customers%rowtype;

  v_prior_completed_count integer;
  v_existing_welcome_count integer;

  v_benefit public.customer_benefits%rowtype;
  v_code text;

  v_attempt integer := 0;
begin

  -- ----------------------------------------------------------
  -- Authentication / authorization
  -- ----------------------------------------------------------

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
          'LIHEN_CUSTOMER_BENEFIT_ISSUE_FORBIDDEN';
  end if;


  -- ----------------------------------------------------------
  -- Normalize / validate input
  -- ----------------------------------------------------------

  v_operation_key :=
    btrim(
      coalesce(
        p_operation_key,
        ''
      )
    );

  v_business_line :=
    upper(
      btrim(
        coalesce(
          p_business_line,
          ''
        )
      )
    );


  if v_operation_key = ''
     or p_source_sale_id is null then
    raise exception
      using
        errcode = '22023',
        message =
          'LIHEN_CUSTOMER_BENEFIT_FIELDS_REQUIRED';
  end if;


  if v_business_line not in (
    'BEAUTY_CARE',
    'STYLE'
  ) then
    raise exception
      using
        errcode = '22023',
        message =
          'LIHEN_CUSTOMER_BENEFIT_LINE_INVALID';
  end if;


  if p_discount_percent is null
     or p_discount_percent <= 0
     or p_discount_percent > 100 then
    raise exception
      using
        errcode = '22023',
        message =
          'LIHEN_CUSTOMER_BENEFIT_DISCOUNT_INVALID';
  end if;


  -- ----------------------------------------------------------
  -- Idempotency fingerprint
  -- ----------------------------------------------------------

  v_fingerprint :=
    md5(
      concat_ws(
        '|',
        p_source_sale_id::text,
        v_business_line,
        p_discount_percent::text,
        'WELCOME'
      )
    );


  select *
  into v_existing
  from lihen_private.customer_write_operations o
  where o.operation_key = v_operation_key;


  if found then

    if v_existing.operation_type <>
         'ISSUE_CUSTOMER_BENEFIT'
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
      b.source_order_id,
      b.source_sale_id,
      b.created_at
    from public.customer_benefits b
    where b.id =
      nullif(
        v_existing.result_snapshot
          ->> 'benefit_id',
        ''
      )::uuid;

    return;
  end if;


  -- ----------------------------------------------------------
  -- Serialize issuance for this source sale
  -- ----------------------------------------------------------

  perform pg_advisory_xact_lock(
    hashtextextended(
      p_source_sale_id::text,
      0
    )
  );


  -- Re-check operation after lock
  select *
  into v_existing
  from lihen_private.customer_write_operations o
  where o.operation_key = v_operation_key;


  if found then

    if v_existing.operation_type <>
         'ISSUE_CUSTOMER_BENEFIT'
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
      b.source_order_id,
      b.source_sale_id,
      b.created_at
    from public.customer_benefits b
    where b.id =
      nullif(
        v_existing.result_snapshot
          ->> 'benefit_id',
        ''
      )::uuid;

    return;
  end if;


  -- ----------------------------------------------------------
  -- Resolve sale -> order -> canonical customer
  -- ----------------------------------------------------------

  select *
  into v_sale
  from public.sales s
  where s.id = p_source_sale_id
  for share;


  if not found
     or v_sale.status <> 'COMPLETED'
     or v_sale.order_id is null then
    raise exception
      using
        errcode = '22023',
        message =
          'LIHEN_CUSTOMER_BENEFIT_SOURCE_SALE_INVALID';
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
          'LIHEN_CUSTOMER_BENEFIT_CUSTOMER_REQUIRED';
  end if;


  select *
  into v_customer
  from public.customers c
  where c.id = v_order.customer_id
  for share;


  if not found
     or v_customer.status <> 'ACTIVE' then
    raise exception
      using
        errcode = '22023',
        message =
          'LIHEN_CUSTOMER_BENEFIT_CUSTOMER_INACTIVE';
  end if;


  -- ----------------------------------------------------------
  -- WELCOME eligibility
  --
  -- The source sale must be the customer's first COMPLETED sale.
  -- Stable ordering:
  --   occurred_at, created_at, id
  -- ----------------------------------------------------------

  select count(*)
  into v_prior_completed_count
  from public.sales s
  join public.orders o
    on o.id = s.order_id
  where o.customer_id = v_customer.id
    and s.status = 'COMPLETED'
    and (
      s.occurred_at,
      s.created_at,
      s.id
    ) < (
      v_sale.occurred_at,
      v_sale.created_at,
      v_sale.id
    );


  if v_prior_completed_count <> 0 then
    raise exception
      using
        errcode = '22023',
        message =
          'LIHEN_CUSTOMER_BENEFIT_NOT_FIRST_PURCHASE';
  end if;


  select count(*)
  into v_existing_welcome_count
  from public.customer_benefits b
  where b.customer_id = v_customer.id
    and b.benefit_type = 'WELCOME';


  if v_existing_welcome_count <> 0 then
    raise exception
      using
        errcode = '23505',
        message =
          'LIHEN_CUSTOMER_WELCOME_BENEFIT_ALREADY_EXISTS';
  end if;


  if exists (
    select 1
    from public.customer_benefits b
    where b.source_sale_id = v_sale.id
  ) then
    raise exception
      using
        errcode = '23505',
        message =
          'LIHEN_CUSTOMER_BENEFIT_SOURCE_SALE_ALREADY_USED';
  end if;


  -- ----------------------------------------------------------
  -- Generate + insert
  --
  -- Retry is bounded. The UNIQUE index on benefit_code is the
  -- final collision authority.
  -- ----------------------------------------------------------

  loop
    v_attempt := v_attempt + 1;

    if v_attempt > 20 then
      raise exception
        using
          errcode = '55000',
          message =
            'LIHEN_CUSTOMER_BENEFIT_CODE_GENERATION_EXHAUSTED';
    end if;


    v_code :=
      lihen_private
        .generate_customer_benefit_code_candidate(
          v_business_line
        );


    begin

      insert into public.customer_benefits(
        customer_id,
        benefit_code,
        business_line,
        benefit_type,
        discount_percent,
        status,
        eligibility_reason,
        source_order_id,
        source_sale_id,
        created_by,
        policy_snapshot,
        metadata
      )
      values(
        v_customer.id,
        v_code,
        v_business_line,
        'WELCOME',
        p_discount_percent,
        'GENERATED',
        'ELIGIBLE_FIRST_PURCHASE',
        v_order.id,
        v_sale.id,
        v_actor,
        jsonb_build_object(
          'singleUse',
          true,
          'welcomeValidityBusinessDays',
          20,
          'validityCalendar',
          'PENDING_COLOMBIA_BUSINESS_DAY_ACTIVATION',
          'discountPercent',
          p_discount_percent
        ),
        jsonb_build_object(
          'issuer',
          'CONTROLLED_WELCOME_ISSUE_V1'
        )
      )
      returning *
      into v_benefit;

      exit;

    exception
      when unique_violation then
        -- A benefit-code collision can retry.
        -- Any non-code uniqueness rule remains outside Phase F1.
        if exists (
          select 1
          from public.customer_benefits b
          where b.benefit_code = v_code
        ) then
          null;
        else
          raise;
        end if;
    end;

  end loop;


  -- ----------------------------------------------------------
  -- Existing Customer Master idempotency ledger
  -- ----------------------------------------------------------

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
    'ISSUE_CUSTOMER_BENEFIT',
    v_actor,
    v_customer.id,
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
      'source_order_id',
      v_benefit.source_order_id,
      'source_sale_id',
      v_benefit.source_sale_id
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
    v_benefit.source_order_id,
    v_benefit.source_sale_id,
    v_benefit.created_at;

end;
$function$;


revoke all
on function
public.issue_customer_welcome_benefit_controlled(
  text,
  uuid,
  text,
  numeric
)
from public, anon, authenticated, service_role;


grant execute
on function
public.issue_customer_welcome_benefit_controlled(
  text,
  uuid,
  text,
  numeric
)
to authenticated;


comment on function
public.issue_customer_welcome_benefit_controlled(
  text,
  uuid,
  text,
  numeric
)
is
  'Controlled Phase F1 WELCOME benefit issuance. Derives canonical customer from a completed source sale, requires first completed purchase, generates a unique LIHENBC/LIHENST code in the database, creates GENERATED only, and reuses Customer Master idempotency ledger.';


-- ============================================================
-- EXPLICIT NON-GOALS
-- ============================================================

-- NO:
-- - activation;
-- - redemption;
-- - expiry transition;
-- - RETURN_AFTER_EXPIRED issuance;
-- - PURCHASE_THRESHOLD issuance;
-- - automatic 20-business-day calculation;
-- - automatic WhatsApp send;
-- - update to Orders pricing;
-- - update to Sales;
-- - Inventory mutation;
-- - Finance mutation;
-- - PROD apply.
