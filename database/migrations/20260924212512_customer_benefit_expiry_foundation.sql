-- ============================================================
-- LIHEN CUSTOMER BENEFIT — EXPIRY FOUNDATION
--
-- PHASE F3
--
-- Frozen rule:
--   - ACTIVE benefits remain usable through valid_until.
--   - Once clock_timestamp() is strictly greater than valid_until,
--     the benefit is no longer usable.
--   - Expiry is materialized by a controlled RPC:
--       ACTIVE -> EXPIRED
--   - expired_at records the effective expiry boundary
--     (the stored valid_until), not the later processing time.
--   - ledger created_at remains the processing/audit time.
--
-- Current scope:
--   - controlled single-benefit expiry only.
--
-- Explicit non-goals:
--   - no cron/background scheduler;
--   - no automatic RETURN_AFTER_EXPIRED issuance;
--   - no redemption;
--   - no WhatsApp;
--   - no Orders/Sales/Inventory/Finance mutation;
--   - no PROD apply.
-- ============================================================


-- ============================================================
-- 1. EXPLICIT EXPIRY TIMESTAMP
-- ============================================================

alter table public.customer_benefits
  add column if not exists
  expired_at timestamptz null;


alter table public.customer_benefits
  drop constraint if exists
  customer_benefits_expired_state;


alter table public.customer_benefits
  add constraint
  customer_benefits_expired_state
  check (
    (
      status = 'EXPIRED'
      and expired_at is not null
      and valid_until is not null
      and expired_at = valid_until
    )
    or
    (
      status <> 'EXPIRED'
      and expired_at is null
    )
  );


alter table public.customer_benefits
  drop constraint if exists
  customer_benefits_terminal_state_exclusive;


alter table public.customer_benefits
  add constraint
  customer_benefits_terminal_state_exclusive
  check (
    (
      case when redeemed_at is not null then 1 else 0 end
      +
      case when cancelled_at is not null then 1 else 0 end
      +
      case when expired_at is not null then 1 else 0 end
    ) <= 1
  );


comment on column
public.customer_benefits.expired_at
is
  'Effective expiry boundary. For EXPIRED benefits this equals valid_until; processing time is recorded separately by the idempotency ledger.';


-- ============================================================
-- 2. CONTROLLED EXPIRY RPC
-- ============================================================

create or replace function
public.expire_customer_benefit_controlled(
  p_operation_key text,
  p_benefit_id uuid
)
returns table(
  benefit_id uuid,
  customer_id uuid,
  benefit_code text,
  business_line text,
  benefit_type text,
  discount_percent numeric,
  status text,
  issued_at timestamptz,
  valid_from timestamptz,
  valid_until timestamptz,
  expired_at timestamptz
)
language plpgsql
security definer
set search_path = pg_catalog, public, lihen_private
as $function$
declare
  v_actor uuid := auth.uid();

  v_operation_key text;
  v_fingerprint text;

  v_existing
    lihen_private.customer_write_operations%rowtype;

  v_benefit public.customer_benefits%rowtype;
  v_processed_at timestamptz;
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
          'LIHEN_CUSTOMER_BENEFIT_EXPIRE_FORBIDDEN';
  end if;


  -- ----------------------------------------------------------
  -- Input / idempotency
  -- ----------------------------------------------------------

  v_operation_key :=
    btrim(
      coalesce(
        p_operation_key,
        ''
      )
    );


  if v_operation_key = ''
     or p_benefit_id is null then
    raise exception
      using
        errcode = '22023',
        message =
          'LIHEN_CUSTOMER_BENEFIT_EXPIRE_FIELDS_REQUIRED';
  end if;


  v_fingerprint :=
    md5(
      concat_ws(
        '|',
        p_benefit_id::text,
        'EXPIRE_CUSTOMER_BENEFIT',
        'ACTIVE_AFTER_VALID_UNTIL',
        'EFFECTIVE_EXPIRY_EQUALS_VALID_UNTIL'
      )
    );


  select *
  into v_existing
  from lihen_private.customer_write_operations o
  where o.operation_key = v_operation_key;


  if found then

    if v_existing.operation_type <>
         'EXPIRE_CUSTOMER_BENEFIT'
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
      b.issued_at,
      b.valid_from,
      b.valid_until,
      b.expired_at
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
         'EXPIRE_CUSTOMER_BENEFIT'
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
      b.issued_at,
      b.valid_from,
      b.valid_until,
      b.expired_at
    from public.customer_benefits b
    where b.id = p_benefit_id;

    return;
  end if;


  -- ----------------------------------------------------------
  -- Lock / validate canonical benefit
  -- ----------------------------------------------------------

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


  if v_benefit.valid_until is null then
    raise exception
      using
        errcode = '22023',
        message =
          'LIHEN_CUSTOMER_BENEFIT_VALID_UNTIL_REQUIRED';
  end if;


  v_processed_at := clock_timestamp();


  -- The benefit remains valid through valid_until itself.
  if v_processed_at <= v_benefit.valid_until then
    raise exception
      using
        errcode = '22023',
        message =
          'LIHEN_CUSTOMER_BENEFIT_NOT_YET_EXPIRED';
  end if;


  -- ----------------------------------------------------------
  -- Expire
  -- ----------------------------------------------------------

  update public.customer_benefits b
  set
    status = 'EXPIRED',
    expired_at = b.valid_until,
    metadata =
      coalesce(
        b.metadata,
        '{}'::jsonb
      )
      ||
      jsonb_build_object(
        'expiryProcessedAt',
        v_processed_at,
        'expiryRule',
        'ACTIVE_AFTER_VALID_UNTIL',
        'effectiveExpiryEqualsValidUntil',
        true
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
    request_fingerprint,
    result_snapshot
  )
  values(
    v_operation_key,
    'EXPIRE_CUSTOMER_BENEFIT',
    v_actor,
    v_benefit.customer_id,
    v_fingerprint,
    jsonb_build_object(
      'benefit_id',
      v_benefit.id,
      'benefit_code',
      v_benefit.benefit_code,
      'status',
      v_benefit.status,
      'valid_until',
      v_benefit.valid_until,
      'expired_at',
      v_benefit.expired_at,
      'processed_at',
      v_processed_at
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
    v_benefit.issued_at,
    v_benefit.valid_from,
    v_benefit.valid_until,
    v_benefit.expired_at;

end;
$function$;


revoke all
on function
public.expire_customer_benefit_controlled(
  text,
  uuid
)
from public, anon, authenticated, service_role;


grant execute
on function
public.expire_customer_benefit_controlled(
  text,
  uuid
)
to authenticated;


comment on function
public.expire_customer_benefit_controlled(
  text,
  uuid
)
is
  'Controlled LIHEN Customer Benefit F3 expiry. ACTIVE -> EXPIRED only when processing time is strictly greater than valid_until. The benefit remains usable through valid_until; expired_at equals valid_until while ledger time records when expiry was materialized.';


-- ============================================================
-- EXPLICIT NON-GOALS
-- ============================================================

-- NO:
-- - cron/background expiry scheduler;
-- - automatic RETURN_AFTER_EXPIRED;
-- - automatic benefit issuance;
-- - redemption;
-- - WhatsApp;
-- - Orders mutation;
-- - Sales mutation;
-- - Inventory mutation;
-- - Finance mutation;
-- - PROD apply.
