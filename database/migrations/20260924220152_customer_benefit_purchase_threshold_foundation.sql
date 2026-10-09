-- ============================================================
-- LIHEN CUSTOMER BENEFIT — PURCHASE THRESHOLD FOUNDATION
--
-- PHASE F5
--
-- Frozen commercial rule:
--
--   REDEEMED benefit
--   + later COMPLETED sale
--   + same canonical customer
--   + sale contains at least one product in same business_line
--   + merchandise net strictly greater than COP 100,000
--   + no GENERATED/ACTIVE benefit already open for customer+line
--   + source sale is the first qualifying later purchase
--   =>
--   one new PURCHASE_THRESHOLD benefit in GENERATED state.
--
-- Threshold basis:
--   order.subtotal - order.discount_amount
--
-- Rationale:
--   public.sales.total_amount mirrors order.total, and order.total
--   includes delivery_cost. Delivery is excluded from the threshold
--   because it is not merchandise value.
--
-- IMPORTANT:
--   The current schema does not allocate order-level discounts per
--   business line. Therefore the >100,000 threshold is evaluated on
--   the whole purchase's net merchandise amount, while the target
--   line still requires actual sale-item evidence.
--
-- Mixed-line rule:
--   If the purchase net merchandise is >100,000 and the sale contains
--   both lines, each line may qualify independently only if it has its
--   own eligible REDEEMED predecessor and no open benefit.
--
-- Explicit non-goals:
--   - no automatic activation;
--   - no automatic WhatsApp/send;
--   - no redemption implementation;
--   - no automatic scheduling;
--   - no Orders/Sales/Inventory/Finance mutation;
--   - no PROD apply.
-- ============================================================


-- ============================================================
-- 1. PURCHASE_THRESHOLD LINEAGE CONSTRAINTS
-- ============================================================

create unique index if not exists
customer_benefits_threshold_predecessor_uidx
on public.customer_benefits(
  predecessor_benefit_id
)
where
  benefit_type = 'PURCHASE_THRESHOLD'
  and predecessor_benefit_id is not null;


create unique index if not exists
customer_benefits_threshold_source_sale_line_uidx
on public.customer_benefits(
  source_sale_id,
  business_line
)
where
  benefit_type = 'PURCHASE_THRESHOLD'
  and source_sale_id is not null;


alter table public.customer_benefits
  drop constraint if exists
  customer_benefits_threshold_lineage_state;


alter table public.customer_benefits
  add constraint
  customer_benefits_threshold_lineage_state
  check (
    benefit_type <> 'PURCHASE_THRESHOLD'
    or predecessor_benefit_id is not null
  );


-- ============================================================
-- 2. CONTROLLED PURCHASE_THRESHOLD ISSUE RPC
-- ============================================================

create or replace function
public.issue_customer_purchase_threshold_benefit_controlled(
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
  qualifying_merchandise_net numeric,
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

  v_merchandise_net numeric;
  v_prior_qualifying_sale_count integer;

  v_benefit public.customer_benefits%rowtype;
  v_code text;
  v_attempt integer := 0;
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
      and p.role_code in ('OWNER','ADMIN')
  ) then
    raise exception
      using
        errcode = '42501',
        message =
          'LIHEN_CUSTOMER_BENEFIT_THRESHOLD_ISSUE_FORBIDDEN';
  end if;


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
          'LIHEN_CUSTOMER_BENEFIT_THRESHOLD_FIELDS_REQUIRED';
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


  v_fingerprint :=
    md5(
      concat_ws(
        '|',
        p_source_sale_id::text,
        v_business_line,
        p_discount_percent::text,
        'PURCHASE_THRESHOLD',
        'MERCHANDISE_NET_GT_100000',
        'EXCLUDE_DELIVERY'
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
      (
        o.subtotal
        - o.discount_amount
      )::numeric,
      b.created_at
    from public.customer_benefits b
    join public.orders o
      on o.id = b.source_order_id
    where b.id =
      nullif(
        v_existing.result_snapshot
          ->> 'benefit_id',
        ''
      )::uuid;

    return;
  end if;


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


  perform pg_advisory_xact_lock(
    hashtextextended(
      concat_ws(
        '|',
        v_customer.id::text,
        v_business_line,
        'PURCHASE_THRESHOLD'
      ),
      0
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
      (
        o.subtotal
        - o.discount_amount
      )::numeric,
      b.created_at
    from public.customer_benefits b
    join public.orders o
      on o.id = b.source_order_id
    where b.id =
      nullif(
        v_existing.result_snapshot
          ->> 'benefit_id',
        ''
      )::uuid;

    return;
  end if;


  -- ----------------------------------------------------------
  -- Same-line purchase evidence.
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
  -- Threshold basis:
  -- merchandise net = subtotal - discount_amount.
  -- Delivery does not count.
  -- Strictly greater than 100,000 COP.
  -- ----------------------------------------------------------

  v_merchandise_net :=
    coalesce(
      v_order.subtotal,
      0
    )
    -
    coalesce(
      v_order.discount_amount,
      0
    );


  if v_merchandise_net <= 100000 then
    raise exception
      using
        errcode = '22023',
        message =
          'LIHEN_CUSTOMER_BENEFIT_PURCHASE_THRESHOLD_NOT_MET';
  end if;


  -- ----------------------------------------------------------
  -- No open benefit for the same customer + line.
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
  -- Latest eligible REDEEMED predecessor in the same line.
  -- It must have been redeemed strictly before this sale.
  -- It must not already have produced a PURCHASE_THRESHOLD child.
  -- ----------------------------------------------------------

  select b.*
  into v_predecessor
  from public.customer_benefits b
  where b.customer_id = v_customer.id
    and b.business_line = v_business_line
    and b.status = 'REDEEMED'
    and b.redeemed_at is not null
    and v_sale.occurred_at > b.redeemed_at
    and not exists (
      select 1
      from public.customer_benefits child
      where child.benefit_type =
            'PURCHASE_THRESHOLD'
        and child.predecessor_benefit_id = b.id
    )
  order by
    b.redeemed_at desc,
    b.created_at desc,
    b.id desc
  limit 1
  for update;


  if not found then
    raise exception
      using
        errcode = '22023',
        message =
          'LIHEN_CUSTOMER_BENEFIT_NO_ELIGIBLE_REDEEMED_PREDECESSOR';
  end if;


  -- ----------------------------------------------------------
  -- The source sale must be the first qualifying later purchase
  -- after redemption for this customer + line.
  -- ----------------------------------------------------------

  select count(*)
  into v_prior_qualifying_sale_count
  from public.sales s
  join public.orders o
    on o.id = s.order_id
  where o.customer_id = v_customer.id
    and s.status = 'COMPLETED'
    and s.order_id is not null
    and s.occurred_at > v_predecessor.redeemed_at
    and (
      s.occurred_at,
      s.created_at,
      s.id
    ) < (
      v_sale.occurred_at,
      v_sale.created_at,
      v_sale.id
    )
    and (
      coalesce(
        o.subtotal,
        0
      )
      -
      coalesce(
        o.discount_amount,
        0
      )
    ) > 100000
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
          'LIHEN_CUSTOMER_BENEFIT_NOT_FIRST_POST_REDEMPTION_THRESHOLD_PURCHASE';
  end if;


  if exists (
    select 1
    from public.customer_benefits b
    where b.benefit_type =
          'PURCHASE_THRESHOLD'
      and b.source_sale_id = v_sale.id
      and b.business_line = v_business_line
  ) then
    raise exception
      using
        errcode = '23505',
        message =
          'LIHEN_CUSTOMER_THRESHOLD_BENEFIT_SOURCE_SALE_LINE_ALREADY_USED';
  end if;


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
        'PURCHASE_THRESHOLD',
        p_discount_percent,
        'GENERATED',
        'ELIGIBLE_FIRST_POST_REDEMPTION_PURCHASE_GT_100000_NET_MERCHANDISE',
        v_predecessor.id,
        v_order.id,
        v_sale.id,
        v_actor,
        jsonb_build_object(
          'singleUse',
          true,
          'businessLine',
          v_business_line,
          'requiresRedeemedPredecessor',
          true,
          'thresholdComparison',
          'GREATER_THAN',
          'thresholdCop',
          100000,
          'thresholdBasis',
          'ORDER_SUBTOTAL_MINUS_DISCOUNT_AMOUNT',
          'deliveryIncluded',
          false,
          'requiresFirstQualifyingPostRedemptionPurchase',
          true,
          'sameLinePurchaseRequired',
          true,
          'discountPercent',
          p_discount_percent
        ),
        jsonb_build_object(
          'issuer',
          'CONTROLLED_PURCHASE_THRESHOLD_ISSUE_V1',
          'predecessorBenefitId',
          v_predecessor.id,
          'predecessorRedeemedAt',
          v_predecessor.redeemed_at,
          'sourceSaleOccurredAt',
          v_sale.occurred_at,
          'qualifyingMerchandiseNet',
          v_merchandise_net
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
      v_benefit.source_sale_id,
      'qualifying_merchandise_net',
      v_merchandise_net
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
    v_merchandise_net,
    v_benefit.created_at;

end;
$function$;


revoke all
on function
public.issue_customer_purchase_threshold_benefit_controlled(
  text,
  uuid,
  text,
  numeric
)
from public, anon, authenticated, service_role;


grant execute
on function
public.issue_customer_purchase_threshold_benefit_controlled(
  text,
  uuid,
  text,
  numeric
)
to authenticated;


comment on function
public.issue_customer_purchase_threshold_benefit_controlled(
  text,
  uuid,
  text,
  numeric
)
is
  'Controlled LIHEN F5 PURCHASE_THRESHOLD issuance. Requires a REDEEMED predecessor and the first later COMPLETED same-customer sale with same-line item evidence and net merchandise value (order.subtotal - order.discount_amount) strictly greater than COP 100,000. Delivery does not count. Creates one GENERATED benefit.';


-- ============================================================
-- EXPLICIT NON-GOALS
-- ============================================================

-- NO:
-- - automatic activation;
-- - automatic send/WhatsApp;
-- - redemption implementation;
-- - automatic scheduler;
-- - Orders mutation;
-- - Sales mutation;
-- - Inventory mutation;
-- - Finance mutation;
-- - PROD apply.
