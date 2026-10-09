-- ============================================================
-- LIHEN CUSTOMER BENEFIT — RETURN AFTER EXPIRED FOUNDATION
--
-- PHASE F4
--
-- Frozen rule:
--
--   EXPIRED benefit
--   + later COMPLETED sale
--   + same canonical customer
--   + at least one sold product in same business_line
--   + source sale strictly after expired_at
--   + no GENERATED/ACTIVE benefit already open for customer+line
--   + source sale is the earliest qualifying later sale
--   =>
--   one new RETURN_AFTER_EXPIRED benefit in GENERATED state.
--
-- Mixed-line sale rule:
--   The same sale may independently qualify once for BEAUTY_CARE
--   and once for STYLE, but never twice for the same line.
--
-- Lineage:
--   predecessor_benefit_id identifies the EXPIRED benefit that
--   unlocked this RETURN_AFTER_EXPIRED issuance.
--
-- Explicit non-goals:
--   - no automatic activation;
--   - no automatic WhatsApp;
--   - no redemption;
--   - no PURCHASE_THRESHOLD rule;
--   - no order/sale/inventory/finance mutation;
--   - no PROD apply.
-- ============================================================


-- ============================================================
-- 1. RELATIONAL LINEAGE
-- ============================================================

alter table public.customer_benefits
  add column if not exists
  predecessor_benefit_id uuid null
  references public.customer_benefits(id)
  on delete restrict;


create index if not exists
customer_benefits_predecessor_idx
on public.customer_benefits(
  predecessor_benefit_id
)
where predecessor_benefit_id is not null;


create unique index if not exists
customer_benefits_return_predecessor_uidx
on public.customer_benefits(
  predecessor_benefit_id
)
where
  benefit_type = 'RETURN_AFTER_EXPIRED'
  and predecessor_benefit_id is not null;


create unique index if not exists
customer_benefits_return_source_sale_line_uidx
on public.customer_benefits(
  source_sale_id,
  business_line
)
where
  benefit_type = 'RETURN_AFTER_EXPIRED'
  and source_sale_id is not null;


alter table public.customer_benefits
  drop constraint if exists
  customer_benefits_return_lineage_state;


alter table public.customer_benefits
  add constraint
  customer_benefits_return_lineage_state
  check (
    benefit_type <> 'RETURN_AFTER_EXPIRED'
    or predecessor_benefit_id is not null
  );


comment on column
public.customer_benefits.predecessor_benefit_id
is
  'For RETURN_AFTER_EXPIRED, points to the EXPIRED benefit whose unused expiry unlocked the new benefit.';


-- ============================================================
-- 2. CONTROLLED RETURN-AFTER-EXPIRED ISSUE RPC
-- ============================================================

create or replace function
public.issue_customer_return_after_expired_benefit_controlled(
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
  predecessor_benefit_id uuid,
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
  v_predecessor public.customer_benefits%rowtype;

  v_benefit public.customer_benefits%rowtype;
  v_code text;

  v_attempt integer := 0;
  v_prior_qualifying_sale_count integer;
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
          'LIHEN_CUSTOMER_BENEFIT_RETURN_ISSUE_FORBIDDEN';
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
          'LIHEN_CUSTOMER_BENEFIT_RETURN_FIELDS_REQUIRED';
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
        'RETURN_AFTER_EXPIRED'
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
      b.predecessor_benefit_id,
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
  -- Resolve source sale -> order -> canonical customer
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
  -- Serialize issuance for customer + line.
  --
  -- This is stronger than locking only the source sale:
  -- concurrent later purchases cannot both consume the same
  -- expired lineage or create two open benefits for one line.
  -- ----------------------------------------------------------

  perform pg_advisory_xact_lock(
    hashtextextended(
      concat_ws(
        '|',
        v_customer.id::text,
        v_business_line,
        'RETURN_AFTER_EXPIRED'
      ),
      0
    )
  );


  -- Re-check operation after lock.
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
      b.predecessor_benefit_id,
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
  -- Sale must contain the requested business line.
  --
  -- Evidence path:
  --   sale_items -> products.business_line
  --
  -- Mixed-line sales are intentionally evaluated per line.
  -- ----------------------------------------------------------

  if not exists (
    select 1
    from public.sale_items si
    join public.products p
      on p.id = si.product_id
    where si.sale_id = v_sale.id
      and p.business_line = v_business_line
  ) then
    raise exception
      using
        errcode = '22023',
        message =
          'LIHEN_CUSTOMER_BENEFIT_SOURCE_SALE_LINE_NOT_PRESENT';
  end if;


  -- ----------------------------------------------------------
  -- No currently open benefit for same customer + line.
  -- ----------------------------------------------------------

  if exists (
    select 1
    from public.customer_benefits b
    where b.customer_id = v_customer.id
      and b.business_line = v_business_line
      and b.status in (
        'GENERATED',
        'ACTIVE'
      )
  ) then
    raise exception
      using
        errcode = '23505',
        message =
          'LIHEN_CUSTOMER_BENEFIT_OPEN_BENEFIT_EXISTS';
  end if;


  -- ----------------------------------------------------------
  -- Select latest eligible EXPIRED predecessor for same line
  -- that has not already produced a RETURN_AFTER_EXPIRED child.
  -- ----------------------------------------------------------

  select b.*
  into v_predecessor
  from public.customer_benefits b
  where b.customer_id = v_customer.id
    and b.business_line = v_business_line
    and b.status = 'EXPIRED'
    and b.expired_at is not null
    and v_sale.occurred_at > b.expired_at
    and not exists (
      select 1
      from public.customer_benefits child
      where child.benefit_type =
            'RETURN_AFTER_EXPIRED'
        and child.predecessor_benefit_id = b.id
    )
  order by
    b.expired_at desc,
    b.created_at desc,
    b.id desc
  limit 1
  for update;


  if not found then
    raise exception
      using
        errcode = '22023',
        message =
          'LIHEN_CUSTOMER_BENEFIT_NO_ELIGIBLE_EXPIRED_PREDECESSOR';
  end if;


  -- ----------------------------------------------------------
  -- Source sale must be the earliest qualifying COMPLETED
  -- same-line sale after this predecessor expired.
  --
  -- Stable ordering:
  --   occurred_at, created_at, id
  -- ----------------------------------------------------------

  select count(*)
  into v_prior_qualifying_sale_count
  from public.sales s
  join public.orders o
    on o.id = s.order_id
  where o.customer_id = v_customer.id
    and s.status = 'COMPLETED'
    and s.order_id is not null
    and s.occurred_at > v_predecessor.expired_at
    and (
      s.occurred_at,
      s.created_at,
      s.id
    ) < (
      v_sale.occurred_at,
      v_sale.created_at,
      v_sale.id
    )
    and exists (
      select 1
      from public.sale_items si
      join public.products p
        on p.id = si.product_id
      where si.sale_id = s.id
        and p.business_line = v_business_line
    );


  if v_prior_qualifying_sale_count <> 0 then
    raise exception
      using
        errcode = '22023',
        message =
          'LIHEN_CUSTOMER_BENEFIT_NOT_FIRST_POST_EXPIRY_PURCHASE';
  end if;


  -- ----------------------------------------------------------
  -- Defensive source-sale + line uniqueness check.
  -- Unique index remains final concurrency authority.
  -- ----------------------------------------------------------

  if exists (
    select 1
    from public.customer_benefits b
    where b.benefit_type =
          'RETURN_AFTER_EXPIRED'
      and b.source_sale_id = v_sale.id
      and b.business_line = v_business_line
  ) then
    raise exception
      using
        errcode = '23505',
        message =
          'LIHEN_CUSTOMER_RETURN_BENEFIT_SOURCE_SALE_LINE_ALREADY_USED';
  end if;


  -- ----------------------------------------------------------
  -- Generate + insert.
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
        predecessor_benefit_id,
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
        'RETURN_AFTER_EXPIRED',
        p_discount_percent,
        'GENERATED',
        'ELIGIBLE_FIRST_PURCHASE_AFTER_UNUSED_EXPIRY',
        v_predecessor.id,
        v_order.id,
        v_sale.id,
        v_actor,
        jsonb_build_object(
          'singleUse',
          true,
          'businessLine',
          v_business_line,
          'requiresExpiredPredecessor',
          true,
          'requiresFirstPostExpiryCompletedPurchase',
          true,
          'sameLinePurchaseRequired',
          true,
          'discountPercent',
          p_discount_percent
        ),
        jsonb_build_object(
          'issuer',
          'CONTROLLED_RETURN_AFTER_EXPIRED_ISSUE_V1',
          'predecessorBenefitId',
          v_predecessor.id,
          'predecessorExpiredAt',
          v_predecessor.expired_at,
          'sourceSaleOccurredAt',
          v_sale.occurred_at
        )
      )
      returning *
      into v_benefit;

      exit;

    exception
      when unique_violation then
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
  -- Existing Customer Master idempotency ledger.
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
      'predecessor_benefit_id',
      v_benefit.predecessor_benefit_id,
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
    v_benefit.predecessor_benefit_id,
    v_benefit.source_order_id,
    v_benefit.source_sale_id,
    v_benefit.created_at;

end;
$function$;


revoke all
on function
public.issue_customer_return_after_expired_benefit_controlled(
  text,
  uuid,
  text,
  numeric
)
from public, anon, authenticated, service_role;


grant execute
on function
public.issue_customer_return_after_expired_benefit_controlled(
  text,
  uuid,
  text,
  numeric
)
to authenticated;


comment on function
public.issue_customer_return_after_expired_benefit_controlled(
  text,
  uuid,
  text,
  numeric
)
is
  'Controlled LIHEN F4 RETURN_AFTER_EXPIRED issuance. Requires an unused EXPIRED predecessor plus the first later COMPLETED same-customer same-line purchase. Creates one new GENERATED benefit; mixed-line sales may qualify independently per line.';


-- ============================================================
-- EXPLICIT NON-GOALS
-- ============================================================

-- NO:
-- - automatic activation;
-- - automatic WhatsApp/send;
-- - redemption;
-- - PURCHASE_THRESHOLD;
-- - Orders mutation;
-- - Sales mutation;
-- - Inventory mutation;
-- - Finance mutation;
-- - PROD apply.
