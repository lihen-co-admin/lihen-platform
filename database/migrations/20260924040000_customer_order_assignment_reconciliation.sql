-- ============================================================
-- LIHEN CUSTOMER ↔ ORDERS
-- Canonical assignment reconciliation
--
-- Reuses:
--   public.orders.customer_id
--   public.assign_order_customer_controlled(...)
--
-- Canonical Customer Master is the source of identity.
-- Order customer fields remain transaction snapshots.
--
-- No Sales, Inventory or Finance mutation.
-- ============================================================


-- ============================================================
-- 1. DELIVERY ADDRESS SNAPSHOT
-- ============================================================

alter table public.orders
  add column if not exists
    delivery_address_snapshot text;


comment on column
public.orders.delivery_address_snapshot
is
  'Historical delivery address captured from Customer Master when a registered customer is assigned to the order. It is a transaction snapshot and does not follow later customer edits.';


-- ============================================================
-- 2. ENSURE CANONICAL CUSTOMER FK REMAINS RESTRICTED
-- ============================================================

do $fk$
declare
  v_delete_action "char";
begin

  if not exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'orders'
      and column_name = 'customer_id'
  ) then
    raise exception
      using
        errcode = '55000',
        message = 'LIHEN_ORDERS_CUSTOMER_ID_REQUIRED';
  end if;


  select c.confdeltype
  into v_delete_action
  from pg_constraint c
  where c.conrelid = 'public.orders'::regclass
    and c.conname = 'orders_customer_id_fkey'
    and c.contype = 'f';


  if v_delete_action is null then

    alter table public.orders
      add constraint orders_customer_id_fkey
      foreign key(customer_id)
      references public.customers(id)
      on delete restrict;

  elsif v_delete_action <> 'r' then

    alter table public.orders
      drop constraint orders_customer_id_fkey;

    alter table public.orders
      add constraint orders_customer_id_fkey
      foreign key(customer_id)
      references public.customers(id)
      on delete restrict;

  end if;

end;
$fk$;


create index if not exists
orders_customer_id_idx
on public.orders(customer_id);


-- ============================================================
-- 3. RECONCILE EXISTING ASSIGN RPC
-- ============================================================

create or replace function
public.assign_order_customer_controlled(
  p_operation_key text,
  p_order_id uuid,
  p_customer_id uuid
)
returns table(
  order_id uuid,
  customer_id uuid,
  customer_name text,
  customer_phone text
)
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_actor_id uuid := auth.uid();

  v_fingerprint text;

  v_existing
    lihen_private.customer_write_operations%rowtype;

  v_customer
    public.customers%rowtype;

  v_order
    public.orders%rowtype;

  v_phone_snapshot text;

  v_address_snapshot text;
begin

  -- ----------------------------------------------------------
  -- Authorization
  -- ----------------------------------------------------------

  if v_actor_id is null then
    raise exception
      using
        errcode = '42501',
        message = 'LIHEN_AUTH_REQUIRED';
  end if;


  if not exists (
    select 1
    from public.profiles p
    where p.id = v_actor_id
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
          'LIHEN_ORDER_CUSTOMER_ASSIGN_FORBIDDEN';
  end if;


  -- ----------------------------------------------------------
  -- Input contract
  -- ----------------------------------------------------------

  if p_operation_key is null
     or length(btrim(p_operation_key)) = 0 then
    raise exception
      using
        errcode = '22023',
        message = 'LIHEN_OPERATION_KEY_REQUIRED';
  end if;


  if p_order_id is null then
    raise exception
      using
        errcode = '22023',
        message = 'LIHEN_ORDER_ID_REQUIRED';
  end if;


  if p_customer_id is null then
    raise exception
      using
        errcode = '22023',
        message = 'LIHEN_CUSTOMER_ID_REQUIRED';
  end if;


  select o.*
  into v_order
  from public.orders o
  where o.id = p_order_id;


  if not found then
    raise exception
      using
        errcode = '23503',
        message = 'LIHEN_ORDER_NOT_FOUND';
  end if;


  -- Customer assignment belongs to the editable draft stage.
  if v_order.status <> 'DRAFT' then
    raise exception
      using
        errcode = '23514',
        message =
          'LIHEN_ORDER_CUSTOMER_ASSIGN_REQUIRES_DRAFT';
  end if;


  select c.*
  into v_customer
  from public.customers c
  where c.id = p_customer_id
    and c.status = 'ACTIVE';


  if not found then
    raise exception
      using
        errcode = '23503',
        message = 'LIHEN_ACTIVE_CUSTOMER_REQUIRED';
  end if;


  -- ----------------------------------------------------------
  -- Canonical snapshot values
  -- ----------------------------------------------------------

  v_phone_snapshot :=
    coalesce(
      nullif(
        btrim(v_customer.whatsapp_phone),
        ''
      ),
      nullif(
        btrim(v_customer.phone_normalized),
        ''
      ),
      nullif(
        btrim(v_customer.phone),
        ''
      )
    );


  v_address_snapshot :=
    nullif(
      concat_ws(
        ', ',
        nullif(
          btrim(v_customer.address),
          ''
        ),
        nullif(
          btrim(v_customer.neighborhood),
          ''
        ),
        nullif(
          btrim(v_customer.city),
          ''
        )
      ),
      ''
    );


  v_fingerprint :=
    md5(
      concat_ws(
        '|',
        p_order_id::text,
        p_customer_id::text,
        v_customer.full_name,
        coalesce(
          v_phone_snapshot,
          ''
        ),
        coalesce(
          v_address_snapshot,
          ''
        )
      )
    );


  -- ----------------------------------------------------------
  -- Idempotency
  -- ----------------------------------------------------------

  select o.*
  into v_existing
  from lihen_private.customer_write_operations o
  where o.operation_key =
    btrim(p_operation_key);


  if found then

    if v_existing.operation_type <>
         'ASSIGN_ORDER_CUSTOMER'
       or v_existing.actor_id <>
         v_actor_id
       or v_existing.customer_id <>
         p_customer_id
       or v_existing.order_id <>
         p_order_id
       or v_existing.request_fingerprint
          is distinct from
          v_fingerprint
       or v_existing.result_snapshot
          is null then

      raise exception
        using
          errcode = '23505',
          message =
            'LIHEN_CUSTOMER_WRITE_OPERATION_CONFLICT';

    end if;


    return query
    select
      o.id,
      o.customer_id,
      o.customer_name,
      o.customer_phone
    from public.orders o
    where o.id = p_order_id;

    return;

  end if;


  -- ----------------------------------------------------------
  -- Snapshot registered customer into order
  -- ----------------------------------------------------------

  update public.orders o
  set
    customer_id =
      p_customer_id,

    customer_name =
      v_customer.full_name,

    customer_phone =
      v_phone_snapshot,

    delivery_address_snapshot =
      v_address_snapshot,

    updated_at =
      now()

  where o.id = p_order_id

  returning o.*
  into v_order;


  -- ----------------------------------------------------------
  -- Institutional controlled-write evidence
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
    btrim(p_operation_key),
    'ASSIGN_ORDER_CUSTOMER',
    v_actor_id,
    p_customer_id,
    p_order_id,
    v_fingerprint,
    jsonb_build_object(
      'order_id',
        v_order.id,

      'customer_id',
        v_customer.id,

      'customer_code',
        v_customer.customer_code,

      'customer_name',
        v_order.customer_name,

      'customer_phone',
        v_order.customer_phone,

      'delivery_address_snapshot',
        v_order.delivery_address_snapshot
    )
  );


  return query
  select
    v_order.id,
    v_order.customer_id,
    v_order.customer_name,
    v_order.customer_phone;

end;
$function$;


revoke all
on function
public.assign_order_customer_controlled(
  text,
  uuid,
  uuid
)
from public, anon;


grant execute
on function
public.assign_order_customer_controlled(
  text,
  uuid,
  uuid
)
to authenticated;


comment on function
public.assign_order_customer_controlled(
  text,
  uuid,
  uuid
)
is
  'Assigns an ACTIVE canonical Customer Master record to a DRAFT order and captures immutable customer name, contact and delivery-address snapshots. Idempotent and OWNER/ADMIN controlled.';


-- ============================================================
-- EXPLICIT BOUNDARY
-- ============================================================

comment on table
public.orders
is
  'LIHEN order workflow. customer_id references Customer Master while customer_name, customer_phone and delivery_address_snapshot preserve the transactional customer snapshot.';
