-- ============================================================
-- LIHEN CUSTOMER MASTER
-- LEGACY CRM -> CANONICAL CUSTOMER MASTER UPGRADE BRIDGE
--
-- Runs BEFORE:
--   20260924030000_customer_master_foundation.sql
--
-- Goals:
--   - preserve legacy customer records
--   - add canonical Customer Master columns
--   - never invent missing customer phone data
--   - preserve legacy whatsapp/document_number columns for now
--   - reconcile the private customer ledger contract
--   - disable the legacy external create_customer_controlled overload
--
-- No Orders, Sales, Inventory or Finance mutation.
-- ============================================================


-- ============================================================
-- 1. CANONICAL CUSTOMER CODE SEQUENCE
-- ============================================================

create sequence if not exists
lihen_private.customer_code_seq;


revoke all
on sequence lihen_private.customer_code_seq
from public, anon, authenticated;


-- ============================================================
-- 2. PHONE NORMALIZATION NEEDED DURING UPGRADE
-- ============================================================

create or replace function
lihen_private.normalize_customer_phone(
  p_phone text
)
returns text
language plpgsql
immutable
set search_path = pg_catalog
as $function$
declare
  v_raw text;
  v_digits text;
begin

  v_raw :=
    btrim(
      coalesce(
        p_phone,
        ''
      )
    );


  if v_raw = '' then
    return null;
  end if;


  v_digits :=
    regexp_replace(
      v_raw,
      '[^0-9]',
      '',
      'g'
    );


  -- Colombian mobile:
  -- 3001234567 -> 573001234567
  if v_digits ~ '^3[0-9]{9}$' then
    return '57' || v_digits;
  end if;


  -- Already normalized Colombian mobile.
  if v_digits ~ '^573[0-9]{9}$' then
    return v_digits;
  end if;


  -- Explicit international number.
  if left(v_raw, 1) = '+'
     and v_digits ~ '^[0-9]{8,15}$' then
    return v_digits;
  end if;


  return null;

end;
$function$;


revoke all
on function
lihen_private.normalize_customer_phone(text)
from public, anon, authenticated;


-- ============================================================
-- 3. ONLY RECONCILE IF LEGACY CUSTOMERS TABLE ALREADY EXISTS
-- ============================================================

do $bridge$
begin

  if to_regclass(
    'public.customers'
  ) is null then
    return;
  end if;


  -- ----------------------------------------------------------
  -- Canonical columns missing from the legacy CRM.
  -- ----------------------------------------------------------

  alter table public.customers
    add column if not exists customer_code text;

  alter table public.customers
    add column if not exists phone text;

  alter table public.customers
    add column if not exists phone_normalized text;

  alter table public.customers
    add column if not exists whatsapp_phone text;

  alter table public.customers
    add column if not exists address text;

  alter table public.customers
    add column if not exists city text;

  alter table public.customers
    add column if not exists neighborhood text;

  alter table public.customers
    add column if not exists preferred_line text;


  -- ----------------------------------------------------------
  -- Never invent a telephone number.
  --
  -- Legacy rows can only upgrade automatically when the
  -- legacy whatsapp value is a valid normalized phone source.
  -- ----------------------------------------------------------

  if exists (
    select 1
    from public.customers c
    where c.phone_normalized is null
      and lihen_private.normalize_customer_phone(
        c.whatsapp
      ) is null
  ) then

    raise exception
      using
        errcode = '23514',
        message =
          'LIHEN_LEGACY_CUSTOMER_PHONE_REVIEW_REQUIRED';

  end if;


  -- ----------------------------------------------------------
  -- Backfill canonical phone fields from existing legacy data.
  -- ----------------------------------------------------------

  update public.customers c
  set
    phone =
      coalesce(
        nullif(
          btrim(c.phone),
          ''
        ),
        nullif(
          btrim(c.whatsapp),
          ''
        )
      ),

    phone_normalized =
      coalesce(
        c.phone_normalized,
        lihen_private.normalize_customer_phone(
          coalesce(
            nullif(
              btrim(c.phone),
              ''
            ),
            c.whatsapp
          )
        )
      ),

    whatsapp_phone =
      coalesce(
        c.whatsapp_phone,
        lihen_private.normalize_customer_phone(
          c.whatsapp
        )
      ),

    preferred_line =
      coalesce(
        nullif(
          btrim(c.preferred_line),
          ''
        ),
        'UNKNOWN'
      ),

    updated_at =
      coalesce(
        c.updated_at,
        now()
      );


  -- ----------------------------------------------------------
  -- Human code generation.
  -- ----------------------------------------------------------

  update public.customers c
  set customer_code =
    'CLI-' ||
    lpad(
      nextval(
        'lihen_private.customer_code_seq'
      )::text,
      6,
      '0'
    )
  where c.customer_code is null
     or btrim(c.customer_code) = '';


  -- ----------------------------------------------------------
  -- Canonical defaults.
  -- ----------------------------------------------------------

  alter table public.customers
    alter column customer_code
      set default (
        'CLI-' ||
        lpad(
          nextval(
            'lihen_private.customer_code_seq'
          )::text,
          6,
          '0'
        )
      );

  alter table public.customers
    alter column preferred_line
      set default 'UNKNOWN';


  -- ----------------------------------------------------------
  -- Canonical NOT NULL requirements.
  -- ----------------------------------------------------------

  alter table public.customers
    alter column customer_code set not null;

  alter table public.customers
    alter column phone set not null;

  alter table public.customers
    alter column phone_normalized set not null;

  alter table public.customers
    alter column preferred_line set not null;


  -- ----------------------------------------------------------
  -- Canonical constraints.
  -- ----------------------------------------------------------

  if not exists (
    select 1
    from pg_constraint
    where conname =
      'customers_customer_code_key'
      and conrelid =
        'public.customers'::regclass
  ) then

    alter table public.customers
      add constraint
        customers_customer_code_key
      unique(customer_code);

  end if;


  if not exists (
    select 1
    from pg_constraint
    where conname =
      'customers_customer_code_not_blank'
      and conrelid =
        'public.customers'::regclass
  ) then

    alter table public.customers
      add constraint
        customers_customer_code_not_blank
      check(
        length(
          btrim(customer_code)
        ) > 0
      );

  end if;


  if not exists (
    select 1
    from pg_constraint
    where conname =
      'customers_phone_not_blank'
      and conrelid =
        'public.customers'::regclass
  ) then

    alter table public.customers
      add constraint
        customers_phone_not_blank
      check(
        length(
          btrim(phone)
        ) > 0
      );

  end if;


  if not exists (
    select 1
    from pg_constraint
    where conname =
      'customers_phone_normalized_not_blank'
      and conrelid =
        'public.customers'::regclass
  ) then

    alter table public.customers
      add constraint
        customers_phone_normalized_not_blank
      check(
        length(
          btrim(phone_normalized)
        ) > 0
      );

  end if;


  if not exists (
    select 1
    from pg_constraint
    where conname =
      'customers_preferred_line_valid'
      and conrelid =
        'public.customers'::regclass
  ) then

    alter table public.customers
      add constraint
        customers_preferred_line_valid
      check(
        preferred_line in (
          'BEAUTY_CARE',
          'STYLE',
          'MIXED',
          'UNKNOWN'
        )
      );

  end if;

end;
$bridge$;


-- ============================================================
-- 4. RECONCILE LEGACY PRIVATE CUSTOMER LEDGER
-- ============================================================

do $ledger$
declare
  v_constraint_name text;
begin

  if to_regclass(
    'lihen_private.customer_write_operations'
  ) is null then
    return;
  end if;


  -- The legacy ledger includes order_id.
  -- Preserve it because ASSIGN_ORDER_CUSTOMER uses it.

  alter table
    lihen_private.customer_write_operations
  add column if not exists order_id uuid;


  -- Remove the old operation_type check regardless of its
  -- generated/internal name.

  select con.conname
  into v_constraint_name
  from pg_constraint con
  where con.conrelid =
      'lihen_private.customer_write_operations'::regclass
    and con.contype = 'c'
    and pg_get_constraintdef(
      con.oid
    ) ilike '%operation_type%'
  limit 1;


  if v_constraint_name is not null then

    execute format(
      'alter table lihen_private.customer_write_operations drop constraint %I',
      v_constraint_name
    );

  end if;


  alter table
    lihen_private.customer_write_operations
  add constraint
    customer_write_operations_type_valid
  check(
    operation_type in (
      'CREATE_CUSTOMER',
      'UPDATE_CUSTOMER',
      'ASSIGN_ORDER_CUSTOMER'
    )
  );

end;
$ledger$;


-- ============================================================
-- 5. DISABLE LEGACY EXTERNAL CUSTOMER CREATE OVERLOAD
-- ============================================================

do $legacy_rpc$
begin

  if to_regprocedure(
    'public.create_customer_controlled(text,uuid,text,text,text,text,text,text)'
  ) is not null then

    execute
      'revoke all on function public.create_customer_controlled(text,uuid,text,text,text,text,text,text) from public, anon, authenticated, service_role';

    comment on function
    public.create_customer_controlled(
      text,
      uuid,
      text,
      text,
      text,
      text,
      text,
      text
    )
    is
      'LEGACY CRM overload retained only for historical compatibility. External execution revoked. Canonical Customer Master uses the newer controlled signature.';

  end if;

end;
$legacy_rpc$;


-- ============================================================
-- 6. PRESERVE LEGACY SOURCE FIELDS
-- ============================================================

comment on column
public.customers.whatsapp
is
  'Legacy CRM source field. Preserved during Customer Master upgrade. Do not use for new writes.';


comment on column
public.customers.document_number
is
  'Legacy CRM source field. Preserved during Customer Master upgrade. No destructive cleanup in this migration.';


-- ============================================================
-- EXPLICIT CONTRACT
-- ============================================================

comment on table
public.customers
is
  'Canonical LIHEN Customer Master. Legacy CRM data is preserved and reconciled without inventing missing customer identity data.';
